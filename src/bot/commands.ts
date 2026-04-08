import TelegramBot from 'node-telegram-bot-api';
import {
  fetchTodayPrices,
  detect10DayFluctuations,
} from '../services/priceService';
import {
  buildTodayMessage,
  buildAlertMessage,
  buildErrorMessage,
} from '../utils/formatter';
import { registerFillupCommand } from './fillup';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageHandler = (msg: TelegramBot.Message) => Promise<void>;

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Safe reply wrapper – catches Telegram API errors so an unresponsive bot
 * API won't crash the process.
 */
async function safeReply(
  bot: TelegramBot,
  chatId: number | string,
  html: string
): Promise<void> {
  try {
    await bot.sendMessage(chatId, html, { parse_mode: 'HTML' });
  } catch (err) {
    console.error(`[commands] Failed to send message to ${chatId}:`, err);
  }
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

function buildStartHandler(bot: TelegramBot): MessageHandler {
  return async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name ?? 'bạn';

    const welcomeText =
      `👋 Xin chào, <b>${firstName}</b>!\n\n` +
      `🛢️ Tôi là <b>GasBot</b> – bot cập nhật giá xăng dầu Việt Nam mỗi ngày.\n\n` +
      `<b>Các lệnh có sẵn:</b>\n` +
      `  /today – Giá xăng hôm nay (Vùng 1)\n` +
      `  /alert – Kiểm tra biến động giá ≥ 1.000đ trong 10 ngày qua\n` +
      `  /fillup – Tính tiền đổ đầy bình xăng 🏍️\n\n` +
      `⏰ Bot sẽ tự động gửi cập nhật lúc <b>07:00 sáng</b> mỗi ngày.\n\n` +
      `ℹ️ <i>Dữ liệu từ giaxanghomnay.com</i>`;

    await safeReply(bot, chatId, welcomeText);
  };
}

function buildTodayHandler(bot: TelegramBot): MessageHandler {
  return async (msg) => {
    const chatId = msg.chat.id;

    // Send a "loading" indicator first for better UX
    const loadingMsg = await bot
      .sendMessage(chatId, '⏳ Đang lấy giá xăng hôm nay...', {
        parse_mode: 'HTML',
      })
      .catch(() => null);

    const data = await fetchTodayPrices();

    // Delete the loading message if possible
    if (loadingMsg) {
      bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => null);
    }

    if (!data) {
      await safeReply(bot, chatId, buildErrorMessage('/today'));
      return;
    }

    await safeReply(bot, chatId, buildTodayMessage(data));
  };
}

function buildAlertHandler(bot: TelegramBot): MessageHandler {
  return async (msg) => {
    const chatId = msg.chat.id;

    const loadingMsg = await bot
      .sendMessage(chatId, '⏳ Đang phân tích biến động giá 10 ngày qua...\n<i>(Đang tải song song, vui lòng chờ tối đa ~15s)</i>', {
        parse_mode: 'HTML',
      })
      .catch(() => null);

    const alertResult = await detect10DayFluctuations();

    if (loadingMsg) {
      bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => null);
    }

    await safeReply(bot, chatId, buildAlertMessage(alertResult));
  };
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Registers all bot commands on the provided bot instance.
 * Call this once during initialisation.
 */
export function registerCommands(bot: TelegramBot): void {
  bot.onText(/\/start/, buildStartHandler(bot));
  bot.onText(/\/today/, buildTodayHandler(bot));
  bot.onText(/\/alert/, buildAlertHandler(bot));

  // Register the /fillup feature (command + callback_query listener)
  registerFillupCommand(bot);

  // Set the command list so Telegram shows the "/" menu
  bot
    .setMyCommands([
      { command: 'start', description: 'Bắt đầu & xem hướng dẫn' },
      { command: 'today', description: 'Giá xăng hôm nay (Vùng 1)' },
      {
        command: 'alert',
        description: 'Kiểm tra biến động ≥1.000đ trong 10 ngày',
      },
      {
        command: 'fillup',
        description: 'Tính tiền đổ đầy bình xăng 🏍️',
      },
    ])
    .catch((err) =>
      console.warn('[commands] Could not set bot commands list:', err)
    );

  console.log('[commands] All command handlers registered.');
}
