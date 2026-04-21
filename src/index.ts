import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { registerCommands } from './bot/commands';
import { startDailyJob } from './scheduler/cron';

// ─── Environment validation ───────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(
      `[init] FATAL: Environment variable "${key}" is missing or empty.\n` +
        `       Copy .env.example → .env and fill in the values.`
    );
    process.exit(1);
  }
  return value.trim();
}

const BOT_TOKEN = requireEnv('TELEGRAM_BOT_TOKEN');
const CHAT_ID = requireEnv('CHAT_ID');
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
const CRON_SCHEDULE = process.env['CRON_SCHEDULE']; // optional override

// ─── Bot initialisation ───────────────────────────────────────────────────────

console.log('[init] Starting GasBot...');

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
});

// ─── Global error handlers ────────────────────────────────────────────────────

/**
 * Catch polling errors (e.g. network blips, Telegram API 5xx).
 * Logging only – polling will automatically retry.
 */
bot.on('polling_error', (err) => {
  console.error('[bot] Polling error:', err.message);
});

/**
 * Catch unhandled promise rejections so the process stays alive.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection:', reason);
});

/**
 * Catch synchronous exceptions that escape all catch blocks.
 */
process.on('uncaughtException', (err) => {
  console.error('[process] Uncaught exception:', err);
  // Give the logger time to flush before we exit (if it truly is unrecoverable)
  // In most cases polling errors are handled above and won't reach here.
});

// ─── Register features ────────────────────────────────────────────────────────

registerCommands(bot);

// Gửi lúc 15:30 chiều (Thời điểm cập nhật giá chính thức)
startDailyJob(bot, CHAT_ID, '30 15 * * *');

console.log('[init] GasBot is running. Press Ctrl+C to stop.');
console.log(`[init] Daily schedule: 15:30 (Asia/Ho_Chi_Minh)`);

// ─── Health Check Server (For Deployment like Render) ─────────────────────────
import express, { Request, Response } from 'express';
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => res.send('GasBot is alive! ⛽'));
app.get('/health', (req: Request, res: Response) => res.status(200).send('OK'));

// Route để kích hoạt gửi tin nhắn từ bên ngoài
import { fetchTodayPrices } from './services/priceService';
import { buildDailyDigest } from './utils/formatter';
import { StorageService } from './services/storageService';

app.post('/trigger-broadcast', express.json(), async (req: Request, res: Response) => {
  try {
    const message = (req.body as { message: string })?.message;
    const chatIdParam = req.query.chatId as string;

    // Nếu có chatId param, chỉ gửi vào channel đó; ngược lại gửi tất cả
    const chatIds = chatIdParam
      ? [chatIdParam.trim()]
      : CHAT_ID.split(',').map(id => id.trim());

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Missing message in body' });
    }

    const sendPromises = chatIds.map(async (id) => {
      try {
        const lastMessageId = await StorageService.getLastMessageId(id);
        if (lastMessageId) {
          try {
            await bot.deleteMessage(id, lastMessageId);
          } catch (delErr: any) {
            console.error(`[trigger] Failed to delete previous message ${lastMessageId} in ${id}:`, delErr.message);
          }
        }

        const sentMessage = await bot.sendMessage(id, message, { parse_mode: 'HTML' });
        await StorageService.setLastMessageId(id, sentMessage.message_id);
      } catch (err: any) {
        console.error(`[trigger] Failed to send to ${id}:`, err.message);
      }
    });

    await Promise.all(sendPromises);
    return res.json({ success: true, sentTo: chatIds.length });
  } catch (err) {
    console.error('[trigger] Error during broadcast:', err);
    res.status(500).json({ error: 'Error triggering broadcast' });
  }
});

app.listen(PORT, () => {
  console.log(`[health] Health check server listening on port ${PORT}`);
});
