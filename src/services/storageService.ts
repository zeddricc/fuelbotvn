import { createClient } from '@supabase/supabase-js';

export interface UserBike {
  name: string;
  capacity: number;
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class StorageService {
  /** Gets all custom bikes for a specific chat from Supabase */
  static async getUserBikes(chatId: number): Promise<UserBike[]> {
    if (!supabaseUrl || !supabaseKey) return [];
    
    const { data, error } = await supabase
      .from('user_bikes')
      .select('name, capacity')
      .eq('chat_id', chatId.toString());

    if (error) {
      console.error('[storage] Error fetching from Supabase:', error);
      return [];
    }
    return data || [];
  }

  /** Adds or updates a bike using upsert in Supabase */
  static async addUserBike(chatId: number, bike: UserBike) {
    if (!supabaseUrl || !supabaseKey) return;

    const { error } = await supabase
      .from('user_bikes')
      .upsert({
        chat_id: chatId.toString(),
        name: bike.name,
        capacity: bike.capacity
      }, { onConflict: 'chat_id,name' });

    if (error) {
      console.error('[storage] Error saving to Supabase:', error);
    }
  }
}
