import { UserService } from './userService';
import type { UserActivity } from '../types/user.types';

export class ActivityService {
  /** Log a user command execution */
  static async logCommand(
    userId: string,
    command: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await UserService.logActivity(userId, command, metadata);
  }

  /** Get recent user activity */
  static async getUserActivity(
    userId: string,
    limit = 20
  ): Promise<UserActivity[]> {
    return UserService.getUserActivity(userId, limit);
  }

  /** Get activity stats (admin only) */
  static async getStats(days = 7): Promise<{
    totalCommands: number;
    uniqueUsers: number;
    topCommands: { command: string; count: number }[];
  }> {
    return UserService.getActivityStats(days);
  }
}
