import { createClient } from '@supabase/supabase-js';
import { UserService } from './userService';

export interface UserBike {
  name: string;
  capacity: number;
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class StorageService {
  /** Gets all custom bikes for a specific user by chat ID */
  static async getUserBikes(chatId: number): Promise<UserBike[]> {
    if (!supabaseUrl || !supabaseKey) return [];

    // First, get or create user from chat ID
    const user = await UserService.getUserByTelegramId(chatId);
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_bikes')
      .select('name, capacity')
      .eq('user_id', user.id);

    if (error) {
      console.error('[storage] Error fetching from Supabase:', error);
      return [];
    }
    return data || [];
  }

  /** Adds or updates a bike using upsert in Supabase */
  static async addUserBike(chatId: number, bike: UserBike) {
    if (!supabaseUrl || !supabaseKey) return;

    // First, get or create user from chat ID
    const user = await UserService.getUserByTelegramId(chatId);
    if (!user) return;

    const { error } = await supabase
      .from('user_bikes')
      .upsert({
        user_id: user.id,
        name: bike.name,
        capacity: bike.capacity
      }, { onConflict: 'user_id,name' });

    if (error) {
      console.error('[storage] Error saving to Supabase:', error);
    }
  }

  /** Gets the last broadcast message id for a chat */
  static async getLastMessageId(chatId: string): Promise<number | null> {
    if (!supabaseUrl || !supabaseKey) return null;

    const { data, error } = await supabase
      .from('broadcast_messages')
      .select('message_id')
      .eq('chat_id', chatId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // PGRST116 is "Row not found", which is fine for first time
        console.error('[storage] Error fetching last message from Supabase:', error);
      }
      return null;
    }
    return data?.message_id || null;
  }

  /** Saves the latest broadcast message id for a chat */
  static async setLastMessageId(chatId: string, messageId: number) {
    if (!supabaseUrl || !supabaseKey) return;

    const { error } = await supabase
      .from('broadcast_messages')
      .upsert({
        chat_id: chatId,
        message_id: messageId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chat_id' });

    if (error) {
      console.error('[storage] Error saving last message to Supabase:', error);
    }
  }
}
