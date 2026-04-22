import { createClient } from '@supabase/supabase-js';
import type { User, UserRole, UserActivity } from '../types/user.types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin Telegram IDs from environment (comma-separated)
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));

export class UserService {
  /** Get user by Telegram ID */
  static async getUserByTelegramId(telegramId: number): Promise<User | null> {
    if (!supabaseUrl || !supabaseKey) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[userService] Error fetching user:', error);
      }
      return null;
    }
    return data as User;
  }

  /** Get user by ID */
  static async getUserById(userId: string): Promise<User | null> {
    if (!supabaseUrl || !supabaseKey) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[userService] Error fetching user by ID:', error);
      return null;
    }
    return data as User;
  }

  /** Register or update user from Telegram */
  static async registerUser(telegramUser: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<User> {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const isAdmin = ADMIN_IDS.includes(telegramUser.id);
    const role: UserRole = isAdmin ? 'admin' : 'user';

    const { data, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: telegramUser.id,
        telegram_username: telegramUser.username || null,
        first_name: telegramUser.first_name || null,
        last_name: telegramUser.last_name || null,
        role,
        is_active: true,
        last_active_at: new Date().toISOString(),
      }, {
        onConflict: 'telegram_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[userService] Error registering user:', error);
      throw error;
    }

    return data as User;
  }

  /** Update user's last active timestamp */
  static async updateLastActive(userId: string): Promise<void> {
    if (!supabaseUrl || !supabaseKey) return;

    const { error } = await supabase
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[userService] Error updating last active:', error);
    }
  }

  /** Set user role */
  static async setUserRole(userId: string, role: UserRole): Promise<void> {
    if (!supabaseUrl || !supabaseKey) return;

    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId);

    if (error) {
      console.error('[userService] Error setting user role:', error);
      throw error;
    }
  }

  /** Deactivate user */
  static async deactivateUser(userId: string): Promise<void> {
    if (!supabaseUrl || !supabaseKey) return;

    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId);

    if (error) {
      console.error('[userService] Error deactivating user:', error);
      throw error;
    }
  }

  /** Get all users (admin only) */
  static async getAllUsers(limit = 50, offset = 0): Promise<User[]> {
    if (!supabaseUrl || !supabaseKey) return [];

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('registered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[userService] Error fetching all users:', error);
      return [];
    }
    return (data || []) as User[];
  }

  /** Get user count */
  static async getUserCount(): Promise<number> {
    if (!supabaseUrl || !supabaseKey) return 0;

    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[userService] Error counting users:', error);
      return 0;
    }
    return count || 0;
  }

  /** Log user activity */
  static async logActivity(
    userId: string,
    command: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!supabaseUrl || !supabaseKey) return;

    const { error } = await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        command,
        metadata: metadata || null,
      });

    if (error) {
      console.error('[userService] Error logging activity:', error);
    }
  }

  /** Get user activity history */
  static async getUserActivity(
    userId: string,
    limit = 20
  ): Promise<UserActivity[]> {
    if (!supabaseUrl || !supabaseKey) return [];

    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[userService] Error fetching user activity:', error);
      return [];
    }
    return (data || []) as UserActivity[];
  }

  /** Get activity stats (admin only) */
  static async getActivityStats(days = 7): Promise<{
    totalCommands: number;
    uniqueUsers: number;
    topCommands: { command: string; count: number }[];
  }> {
    if (!supabaseUrl || !supabaseKey) {
      return { totalCommands: 0, uniqueUsers: 0, topCommands: [] };
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('user_activity')
      .select('command, user_id')
      .gte('executed_at', since.toISOString());

    if (error || !data) {
      console.error('[userService] Error fetching activity stats:', error);
      return { totalCommands: 0, uniqueUsers: 0, topCommands: [] };
    }

    const uniqueUsers = new Set(data.map(a => a.user_id)).size;
    const commandCounts: Record<string, number> = {};
    for (const activity of data) {
      commandCounts[activity.command] = (commandCounts[activity.command] || 0) + 1;
    }

    const topCommands = Object.entries(commandCounts)
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCommands: data.length,
      uniqueUsers,
      topCommands,
    };
  }
}
