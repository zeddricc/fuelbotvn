import TelegramBot from 'node-telegram-bot-api';
import { AuthService } from '../services/authService';
import type { User } from '../types/user.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthenticatedHandler = (
  msg: TelegramBot.Message,
  user: User
) => Promise<void>;

// ─── Auth Middleware ──────────────────────────────────────────────────────────

/**
 * Wraps a command handler with authentication.
 * Automatically registers new users and attaches user context to message.
 */
export function withAuth(
  bot: TelegramBot,
  handler: AuthenticatedHandler
): (msg: TelegramBot.Message) => Promise<void> {
  return async (msg) => {
    const chatId = msg.chat.id;

    if (!msg.from) {
      await bot.sendMessage(chatId, '❌ Không thể xác định người dùng.');
      return;
    }

    let user: User;

    try {
      user = await AuthService.authenticateUser(msg.from);
    } catch (err) {
      console.error('[auth] Authentication error:', err);
      await bot.sendMessage(
        chatId,
        '❌ Có lỗi xảy ra khi xác thực. Vui lòng thử lại sau.'
      );
      return;
    }

    if (!user.is_active) {
      await bot.sendMessage(
        chatId,
        '❌ Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.'
      );
      return;
    }

    // Attach user to message for handler access
    (msg as any).user = user;

    try {
      await handler(msg, user);
    } catch (err) {
      console.error('[auth] Handler error:', err);
      await bot.sendMessage(
        chatId,
        '❌ Có lỗi xảy ra khi xử lý lệnh. Vui lòng thử lại sau.'
      );
    }
  };
}

/**
 * Wraps a command handler with admin-only access.
 */
export function withAdminAuth(
  bot: TelegramBot,
  handler: AuthenticatedHandler
): (msg: TelegramBot.Message) => Promise<void> {
  return async (msg) => {
    const chatId = msg.chat.id;

    if (!msg.from) {
      await bot.sendMessage(chatId, '❌ Không thể xác định người dùng.');
      return;
    }

    let user: User;

    try {
      user = await AuthService.authenticateUser(msg.from);
    } catch (err) {
      console.error('[auth] Authentication error:', err);
      await bot.sendMessage(
        chatId,
        '❌ Có lỗi xảy ra khi xác thực. Vui lòng thử lại sau.'
      );
      return;
    }

    if (!AuthService.isAdmin(user)) {
      await bot.sendMessage(chatId, '❌ Bạn không có quyền truy cập lệnh này.');
      return;
    }

    if (!user.is_active) {
      await bot.sendMessage(
        chatId,
        '❌ Tài khoản của bạn đã bị vô hiệu hóa.'
      );
      return;
    }

    (msg as any).user = user;

    try {
      await handler(msg, user);
    } catch (err) {
      console.error('[auth] Admin handler error:', err);
      await bot.sendMessage(
        chatId,
        '❌ Có lỗi xảy ra khi xử lý lệnh. Vui lòng thử lại sau.'
      );
    }
  };
}
