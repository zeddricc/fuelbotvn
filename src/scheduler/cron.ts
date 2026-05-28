import cron from 'node-cron';
import TelegramBot from 'node-telegram-bot-api';
import { fetchTodayPrices } from '../services/priceService';
import { buildDailyDigest, buildErrorMessage } from '../utils/formatter';
import { StorageService } from '../services/storageService';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default schedule: every day at 07:00 in the server's local timezone.
 *
 * If the server runs in UTC (common on cloud hosts), set TZ=Asia/Ho_Chi_Minh
 * in the environment, or adjust the hour to 0 (UTC 00:00 = ICT 07:00).
 *
 * node-cron format: "second minute hour dayOfMonth month dayOfWeek"
 */
const DEFAULT_CRON_SCHEDULE = '0 7 * * *';

// ─── Broadcast logic ──────────────────────────────────────────────────────────

export interface BroadcastResult {
  success: boolean;
  sentTo: number;
  failed: number;
  reason?: string;
}

/**
 * Fetches today's prices and broadcasts the digest to every chat ID in the
 * comma-separated `chatId` string. Reused by the in-process cron and by the
 * external HTTP trigger endpoint.
 */
export async function runDailyBroadcast(
  bot: TelegramBot,
  chatId: string,
  source: string = 'manual'
): Promise<BroadcastResult> {
  console.log(`[broadcast:${source}] Running daily price broadcast at ${new Date().toISOString()}`);

  const chatIds = chatId.split(',').map((id) => id.trim()).filter(Boolean);
  let sentTo = 0;
  let failed = 0;

  try {
    const todayData = await fetchTodayPrices();

    if (!todayData) {
      for (const id of chatIds) {
        try {
          await bot.sendMessage(id, buildErrorMessage(`${source} broadcast`), {
            parse_mode: 'HTML',
          });
        } catch (err) {
          console.error(`[broadcast:${source}] Failed to send error message to ${id}:`, err);
        }
      }
      return { success: false, sentTo: 0, failed: chatIds.length, reason: 'no_data' };
    }

    const digest = buildDailyDigest(todayData);

    for (const id of chatIds) {
      try {
        const lastMessageId = await StorageService.getLastMessageId(id);
        if (lastMessageId) {
          try {
            await bot.deleteMessage(id, lastMessageId);
          } catch (delErr: any) {
            console.error(
              `[broadcast:${source}] Failed to delete previous message ${lastMessageId} in ${id}:`,
              delErr.message
            );
          }
        }

        const sentMessage = await bot.sendMessage(id, digest, { parse_mode: 'HTML' });
        await StorageService.setLastMessageId(id, sentMessage.message_id);
        sentTo++;
      } catch (err) {
        failed++;
        console.error(`[broadcast:${source}] Failed to send to ${id}:`, err);
      }
    }

    return { success: failed === 0, sentTo, failed };
  } catch (err) {
    console.error(`[broadcast:${source}] Unexpected error:`, err);
    return { success: false, sentTo, failed: chatIds.length - sentTo, reason: 'exception' };
  }
}

// ─── Job ──────────────────────────────────────────────────────────────────────

/**
 * Starts the daily price broadcast cron job.
 */
export function startDailyJob(
  bot: TelegramBot,
  chatId: string,
  schedule: string = DEFAULT_CRON_SCHEDULE
): void {
  if (!cron.validate(schedule)) {
    console.error(
      `[scheduler] Invalid cron schedule: "${schedule}". Defaulting to ${DEFAULT_CRON_SCHEDULE}.`
    );
    schedule = DEFAULT_CRON_SCHEDULE;
  }

  console.log(`[scheduler] Daily job scheduled: "${schedule}" → chat ${chatId}`);

  cron.schedule(
    schedule,
    () => runDailyBroadcast(bot, chatId, 'cron'),
    {
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );
}
