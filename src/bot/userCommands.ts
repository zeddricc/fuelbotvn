import TelegramBot from 'node-telegram-bot-api';
import { withAuth } from '../middleware/auth';
import { ActivityService } from '../services/activityService';
import { StorageService } from '../services/storageService';

// ─── Types ────────────────────────────────────────────────────────────────────

type BikeState = {
  name: string;
  capacity: number;
  step: 'name' | 'capacity';
};

// ─── State Management ────────────────────────────────────────────────────────

const userStates = new Map<number, BikeState>();

// ─── Command Handlers ────────────────────────────────────────────────────────

function buildRegisterBikeCommand(bot: TelegramBot) {
  return withAuth(bot, async (msg, user) => {
    const chatId = msg.chat.id;

    await bot.sendMessage(
      chatId,
      '🛵 <b>Đăng ký xe mới</b>\n\n' +
      'Nhập tên xe (ví dụ: Vision, SH, Air Blade):',
      { parse_mode: 'HTML' }
    );

    userStates.set(chatId, { name: '', capacity: 0, step: 'name' });
  });
}

function buildProfileCommand(bot: TelegramBot) {
  return withAuth(bot, async (msg, user) => {
    const chatId = msg.chat.id;

    const bikes = await StorageService.getUserBikes(chatId);
    const bikeList = bikes.length
      ? bikes.map(b => `  • ${b.name} (${b.capacity}L)`).join('\n')
      : '  Chưa có xe nào.';

    await bot.sendMessage(
      chatId,
      `👤 <b>Thông tin người dùng</b>\n\n` +
      `Telegram ID: <code>${user.telegram_id}</code>\n` +
      `Username: ${user.telegram_username || 'Không có'}\n` +
      `Đăng ký: ${new Date(user.registered_at).toLocaleDateString('vi-VN')}\n\n` +
      `🛵 <b>Danh sách xe (${bikes.length})</b>\n` +
      `${bikeList}`,
      { parse_mode: 'HTML' }
    );
  });
}

function buildStatsCommand(bot: TelegramBot) {
  return withAuth(bot, async (msg, user) => {
    const chatId = msg.chat.id;

    const bikes = await StorageService.getUserBikes(chatId);
    const totalCapacity = bikes.reduce((sum, b) => sum + b.capacity, 0);

    await bot.sendMessage(
      chatId,
      `📊 <b>Thống kê cá nhân</b>\n\n` +
      `Tổng số xe: ${bikes.length}\n` +
      `Tổng dung tích bình: ${totalCapacity}L`,
      { parse_mode: 'HTML' }
    );
  });
}

// ─── Message Handler for Multi-step Flow ─────────────────────────────────────

export function handleBikeInput(bot: TelegramBot, msg: TelegramBot.Message): boolean {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);

  if (!state) return false;

  if (state.step === 'name') {
    const name = msg.text?.trim();
    if (!name) {
      bot.sendMessage(chatId, '❌ Vui lòng nhập tên xe.');
      return true;
    }
    state.name = name;
    state.step = 'capacity';
    bot.sendMessage(chatId, `Nhập dung tích bình xăng của ${name} (L):`);
    return true;
  }

  if (state.step === 'capacity') {
    const capacity = parseFloat(msg.text?.trim() || '0');
    if (isNaN(capacity) || capacity <= 0) {
      bot.sendMessage(chatId, '❌ Vui lòng nhập dung tích hợp lệ.');
      return true;
    }
    state.capacity = capacity;

    // Save to storage
    StorageService.addUserBike(chatId, {
      name: state.name,
      capacity: state.capacity,
    });

    userStates.delete(chatId);
    bot.sendMessage(
      chatId,
      `✅ <b>Đã thêm xe!</b>\n\n` +
      `Tên xe: ${state.name}\n` +
      `Dung tích: ${state.capacity}L`,
      { parse_mode: 'HTML' }
    );
    return true;
  }

  return false;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerUserCommands(bot: TelegramBot): void {
  bot.onText(/\/register/, buildRegisterBikeCommand(bot));
  bot.onText(/\/profile/, buildProfileCommand(bot));
  bot.onText(/\/stats/, buildStatsCommand(bot));
}
