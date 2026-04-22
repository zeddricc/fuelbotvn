// ─── User Types ───────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_active: boolean;
  registered_at: string;
  last_active_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface UserActivity {
  id: number;
  user_id: string;
  command: string;
  executed_at: string;
  metadata: Record<string, unknown> | null;
}

export interface AuthContext {
  user: User;
}

export interface UserBike {
  name: string;
  capacity: number;
}
