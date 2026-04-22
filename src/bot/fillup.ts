import TelegramBot from 'node-telegram-bot-api';
import { fetchTodayPrices } from '../services/priceService';
import { formatPrice } from '../utils/formatter';
import { StorageService, UserBike } from '../services/storageService';
import { withAuth } from '../middleware/auth';
import { ActivityService } from '../services/activityService';

// ─── Data ─────────────────────────────────────────────────────────────────────

const DEFAULT_MOTORBIKES: Record<string, number> = {
  'Wave Alpha': 3.7,
  Sirius: 3.8,
  Vision: 4.9,
  'Air Blade': 4.4,
  Exciter: 5.4,
  Lead: 6.0,
  SH: 7.0,
};

const CB_PREFIX = 'fillup:';
const CB_CUSTOM = 'fillup_custom';
const CB_ADD_BIKE = 'fillup_add_bike';
const CB_RESTART = 'fillup_restart';
const TARGET_FUEL_SUBSTRING = '95-III';

// ─── State Management ────────────────────────────────────────────────────────

type InputState =
  | { type: 'awaiting_liters' }
  | { type: 'awaiting_bike_name' }
  | { type: 'awaiting_bike_capacity', bikeName: string };

const userStates = new Map<number, InputState>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function calculateAndSendResult(
  bot: TelegramBot,
  chatId: number,
  label: string,
  capacity: number,
  editMessageId?: number
) {
  const method = editMessageId ? 'editMessageText' : 'sendMessage';
  const options: TelegramBot.SendMessageOptions & { chat_id?: number, message_id?: number } = {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '🔄 Quay lại', callback_data: CB_RESTART }]]
    }
  };
  if (editMessageId) {
    options.chat_id = chatId;
    options.message_id = editMessageId;
  }

  const todayData = await fetchTodayPrices();
  if (!todayData) {
    const errorMsg = '❌ <b>Không thể lấy giá xăng hôm nay.</b>';
    if (editMessageId) await bot.editMessageText(errorMsg, options as any);
    else await bot.sendMessage(chatId, errorMsg, options);
    return;
  }

  const ron95 = todayData.petrolimex.find(i => i.title.includes(TARGET_FUEL_SUBSTRING));
  if (!ron95) {
    const errorMsg = `❌ Không tìm thấy giá ${TARGET_FUEL_SUBSTRING}.`;
    if (editMessageId) await bot.editMessageText(errorMsg, options as any);
    else await bot.sendMessage(chatId, errorMsg, options);
    return;
  }

  const price = ron95.zone1_price;
  const total = Math.round(capacity * price);

  const text =
    `💰 <b>Kết Quả Tính Tiền</b>\n\n` +
    `Phương tiện: <b>${label}</b>\n` +
    `Dung tích: <b>${capacity}L</b>\n` +
    `Giá <b>RON 95-III</b>: <b>${formatPrice(price)} đ/L</b>\n\n` +
    `💴 Tổng cộng: <b>~${formatPrice(total)} VNĐ</b>\n\n`


  if (editMessageId) await bot.editMessageText(text, options as any);
  else await bot.sendMessage(chatId, text, options);
}

// ─── Keyboards ───────────────────────────────────────────────────────────────

async function buildFillupKeyboard(chatId: number): Promise<TelegramBot.InlineKeyboardMarkup> {
  const customBikes = await StorageService.getUserBikes(chatId);
  const rows: TelegramBot.InlineKeyboardButton[][] = [];

  // Merge default and custom
  const allBikes = { ...DEFAULT_MOTORBIKES };
  customBikes.forEach(b => { allBikes[b.name] = b.capacity; });

  const entries = Object.entries(allBikes);
  for (let i = 0; i < entries.length; i += 2) {
    const row: TelegramBot.InlineKeyboardButton[] = [];
    const [n1, c1] = entries[i];
    row.push({ text: `🏍️ ${n1} (${c1}L)`, callback_data: `${CB_PREFIX}${n1}` });
    if (entries[i + 1]) {
      const [n2, c2] = entries[i + 1];
      row.push({ text: `🏍️ ${n2} (${c2}L)`, callback_data: `${CB_PREFIX}${n2}` });
    }
    rows.push(row);
  }

  // Action buttons
  rows.push([
    { text: '🔢 Nhập số lít', callback_data: CB_CUSTOM },
    { text: '➕ Thêm xe của tôi', callback_data: CB_ADD_BIKE }
  ]);

  return { inline_keyboard: rows };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleFillupCommand(bot: TelegramBot, msg: TelegramBot.Message) {
  const user = (msg as any).user;
  if (!user) return;

  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '🛵 <b>Tính Tiền Đổ Đầy Bình</b>\nChọn xe hoặc nhập số lít:', {
    parse_mode: 'HTML',
    reply_markup: await buildFillupKeyboard(chatId)
  });
  await ActivityService.logCommand(user.id, 'fillup');
}

async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);
  if (!state || !msg.text) return;

  const text = msg.text.trim();

  if (state.type === 'awaiting_liters') {
    const liters = parseFloat(text.replace(',', '.'));
    if (isNaN(liters) || liters <= 0) {
      await bot.sendMessage(chatId, '❌ Vui lòng nhập một số hợp lệ (ví dụ: 5.5)');
      return;
    }
    userStates.delete(chatId);
    await calculateAndSendResult(bot, chatId, 'Số lít tùy chỉnh', liters);
  }
  else if (state.type === 'awaiting_bike_name') {
    userStates.set(chatId, { type: 'awaiting_bike_capacity', bikeName: text });
    await bot.sendMessage(chatId, `👌 Đã nhận tên xe: <b>${text}</b>\nBây giờ hãy nhập <b>dung tích bình xăng (Lít)</b>:`, { parse_mode: 'HTML' });
  }
  else if (state.type === 'awaiting_bike_capacity') {
    const cap = parseFloat(text.replace(',', '.'));
    if (isNaN(cap) || cap <= 0) {
      await bot.sendMessage(chatId, '❌ Vui lòng nhập số lít hợp lệ.');
      return;
    }
    await StorageService.addUserBike(chatId, { name: state.bikeName, capacity: cap });
    userStates.delete(chatId);
    await bot.sendMessage(chatId, `✅ Đã lưu xe <b>${state.bikeName} (${cap}L)</b> thành công!`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Tính tiền ngay', callback_data: CB_RESTART }]] }
    });
  }
}

// ─── Callback Handler ──────────────────────────────────────────────────────────

async function handleCallback(bot: TelegramBot, query: TelegramBot.CallbackQuery) {
  const data = query.data ?? '';
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  await bot.answerCallbackQuery(query.id).catch(() => null);

  if (data === CB_RESTART) {
    userStates.delete(chatId);
    await bot.editMessageText('🛵 <b>Tính Tiền Đổ Đầy Bình</b>\nChọn xe hoặc nhập số lít:', {
      chat_id: chatId,
      message_id: query.message?.message_id,
      parse_mode: 'HTML',
      reply_markup: await buildFillupKeyboard(chatId)
    });
  }
  else if (data === CB_CUSTOM) {
    userStates.set(chatId, { type: 'awaiting_liters' });
    await bot.sendMessage(chatId, '🔢 Vui lòng nhập <b>số lít</b> bạn muốn tính tiền (ví dụ: 5.2):', { parse_mode: 'HTML' });
  }
  else if (data === CB_ADD_BIKE) {
    userStates.set(chatId, { type: 'awaiting_bike_name' });
    await bot.sendMessage(chatId, '📝 Vui lòng nhập <b>Tên xe</b> của bạn:', { parse_mode: 'HTML' });
  }
  else if (data.startsWith(CB_PREFIX)) {
    const bikeName = data.slice(CB_PREFIX.length);
    const customBikes = await StorageService.getUserBikes(chatId);
    const capacity = DEFAULT_MOTORBIKES[bikeName] || customBikes.find(b => b.name === bikeName)?.capacity;

    if (capacity) {
      await calculateAndSendResult(bot, chatId, bikeName, capacity, query.message?.message_id);
    }
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerFillupCommand(bot: TelegramBot): void {
  bot.onText(/\/(fillup|doday)/, withAuth(bot, async (msg, user) => {
    await handleFillupCommand(bot, msg);
  }));

  bot.on('callback_query', (query) => handleCallback(bot, query));

  // Main message listener for custom input states
  bot.on('message', (msg) => {
    // Avoid processing commands as input
    if (msg.text?.startsWith('/')) return;
    handleMessage(bot, msg);
  });

  console.log('[fillup] Interactive features registered.');
}

