import cron from 'node-cron';
import TelegramBot from 'node-telegram-bot-api';
import {
  fetchTodayPrices,
  detect10DayFluctuations,
} from '../services/priceService';
import { buildDailyDigest, buildErrorMessage } from '../utils/formatter';

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

// ─── Job ──────────────────────────────────────────────────────────────────────

/**
 * Starts the daily price broadcast cron job.
 *
 * @param bot      Initialised bot instance.
 * @param chatId   Target chat / channel ID to broadcast to.
 * @param schedule Optional override for the cron schedule string.
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
    async () => {
      console.log(`[scheduler] Running daily price broadcast at ${new Date().toISOString()}`);

      try {
        const todayData = await fetchTodayPrices();
        if (todayData) {
          const digest = buildDailyDigest(todayData);
          await bot.sendMessage(chatId, digest, { parse_mode: 'HTML' });
        } else {
          await bot.sendMessage(chatId, buildErrorMessage('cron daily job'), {
            parse_mode: 'HTML',
          });
        }
      } catch (err) {
        // Surface unexpected errors to the log but don't let the process die
        console.error('[scheduler] Unexpected error during daily job:', err);

        try {
          await bot.sendMessage(
            chatId,
            buildErrorMessage('cron daily job – unexpected error'),
            { parse_mode: 'HTML' }
          );
        } catch {
          // If even the error message can't be sent, just log and move on
          console.error('[scheduler] Could not send error message to Telegram.');
        }
      }
    },
    {
      // Use ICT timezone so the schedule is always correct regardless of
      // what timezone the host server runs in.
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );
}
