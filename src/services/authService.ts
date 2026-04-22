import type TelegramBot from 'node-telegram-bot-api';
import { UserService } from './userService';
import type { User } from '../types/user.types';

export class AuthService {
  /** Authenticate user - register if new, update if existing */
  static async authenticateUser(
    telegramUser: TelegramBot.User
  ): Promise<User> {
    let user = await UserService.getUserByTelegramId(telegramUser.id);

    if (!user) {
      user = await UserService.registerUser({
        id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
      });
    } else {
      // Update last active time
      await UserService.updateLastActive(user.id);
    }

    return user;
  }

  /** Check if user is admin */
  static isAdmin(user: User): boolean {
    return user.role === 'admin';
  }

  /** Check if user is active */
  static isActive(user: User): boolean {
    return user.is_active;
  }

  /** Verify user is admin and active */
  static verifyAdmin(user: User): boolean {
    return this.isAdmin(user) && this.isActive(user);
  }
}
