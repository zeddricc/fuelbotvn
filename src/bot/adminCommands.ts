import TelegramBot from 'node-telegram-bot-api';
import { withAdminAuth } from '../middleware/auth';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';

// ─── Command Handlers ────────────────────────────────────────────────────────

function buildUsersCommand(bot: TelegramBot) {
  return withAdminAuth(bot, async (msg, user) => {
    const users = await UserService.getAllUsers(20);
    const total = await UserService.getUserCount();

    if (users.length === 0) {
      await bot.sendMessage(msg.chat.id, 'Không có người dùng nào.');
      return;
    }

    const userList = users
      .map(u => {
        const role = u.role === 'admin' ? '👑' : '👤';
        const status = u.is_active ? '✅' : '❌';
        return `${role} ${u.first_name || u.telegram_username || u.telegram_id} ${status}`;
      })
      .join('\n');

    await bot.sendMessage(
      msg.chat.id,
      `👥 <b>Danh sách người dùng</b> (${total} tổng)\n\n${userList}`,
      { parse_mode: 'HTML' }
    );
  });
}

function buildStatsAllCommand(bot: TelegramBot) {
  return withAdminAuth(bot, async (msg, user) => {
    const stats = await ActivityService.getStats(7);
    const totalUsers = await UserService.getUserCount();

    const topCommands = stats.topCommands
      .map(c => `  • /${c.command}: ${c.count}`)
      .join('\n');

    await bot.sendMessage(
      msg.chat.id,
      `📊 <b>Thống kê 7 ngày qua</b>\n\n` +
      `Tổng người dùng: ${totalUsers}\n` +
      `Lệnh đã thực hiện: ${stats.totalCommands}\n` +
      `Người dùng hoạt động: ${stats.uniqueUsers}\n\n` +
      `<b>Top lệnh:</b>\n${topCommands || 'Không có dữ liệu'}`,
      { parse_mode: 'HTML' }
    );
  });
}

function buildPromoteCommand(bot: TelegramBot) {
  return withAdminAuth(bot, async (msg, user) => {
    const text = msg.text || '';
    const parts = text.split(' ');
    const telegramId = parseInt(parts[1], 10);

    if (isNaN(telegramId)) {
      await bot.sendMessage(msg.chat.id, '❌ Cách dùng: /promote <telegram_id>');
      return;
    }

    const targetUser = await UserService.getUserByTelegramId(telegramId);
    if (!targetUser) {
      await bot.sendMessage(msg.chat.id, '❌ Không tìm thấy người dùng.');
      return;
    }

    await UserService.setUserRole(targetUser.id, 'admin');
    await bot.sendMessage(
      msg.chat.id,
      `✅ Đã cấp quyền admin cho ${targetUser.first_name || targetUser.telegram_username || telegramId}`
    );
  });
}

function buildBanCommand(bot: TelegramBot) {
  return withAdminAuth(bot, async (msg, user) => {
    const text = msg.text || '';
    const parts = text.split(' ');
    const telegramId = parseInt(parts[1], 10);

    if (isNaN(telegramId)) {
      await bot.sendMessage(msg.chat.id, '❌ Cách dùng: /ban <telegram_id>');
      return;
    }

    const targetUser = await UserService.getUserByTelegramId(telegramId);
    if (!targetUser) {
      await bot.sendMessage(msg.chat.id, '❌ Không tìm thấy người dùng.');
      return;
    }

    if (targetUser.role === 'admin') {
      await bot.sendMessage(msg.chat.id, '❌ Không thể cấm admin.');
      return;
    }

    await UserService.deactivateUser(targetUser.id);
    await bot.sendMessage(
      msg.chat.id,
      `✅ Đã cấm ${targetUser.first_name || targetUser.telegram_username || telegramId}`
    );
  });
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerAdminCommands(bot: TelegramBot): void {
  bot.onText(/\/admin_users/, buildUsersCommand(bot));
  bot.onText(/\/admin_stats/, buildStatsAllCommand(bot));
  bot.onText(/\/admin_promote/, buildPromoteCommand(bot));
  bot.onText(/\/admin_ban/, buildBanCommand(bot));
}
