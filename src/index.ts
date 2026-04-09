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

// Gửi lúc 07:00 sáng (Bản tin đầu ngày)
startDailyJob(bot, CHAT_ID, CRON_SCHEDULE || '0 7 * * *');

// Gửi lúc 15:30 chiều (Thời điểm thường có điều chỉnh giá)
startDailyJob(bot, CHAT_ID, '30 15 * * *');

console.log('[init] GasBot is running. Press Ctrl+C to stop.');
console.log(`[init] Daily schedules: 07:00 and 15:30 (Asia/Ho_Chi_Minh)`);

// ─── Health Check Server (For Deployment like Render) ─────────────────────────
import express, { Request, Response } from 'express';
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => res.send('GasBot is alive! ⛽'));
app.get('/health', (req: Request, res: Response) => res.status(200).send('OK'));

app.listen(PORT, () => {
  console.log(`[health] Health check server listening on port ${PORT}`);
});
