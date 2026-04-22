# ⛽ GasBot VN - Telegram Bot Cập Nhật Giá Xăng Dầu

Bot Telegram giúp theo dõi giá xăng dầu tại Việt Nam (Petrolimex Vùng 1) theo thời gian thực, tích hợp tính năng tính toán chi phí đổ xăng, cảnh báo biến động giá và quản lý người dùng.

## 🚀 Tính năng chính

-   🔔 **Bản tin tự động**: Gửi báo giá xăng 2 lần mỗi ngày (07:00 và 15:30 ICT).
-   📊 **Cảnh báo biến động**: Tự động phân tích dữ liệu 10 ngày gần nhất và cảnh báo nếu giá tăng/giảm mạnh (≥ 1.000đ).
-   🛵 **Tính tiền đổ đầy bình**: Công cụ tính chi phí đổ đầy bình cho các dòng xe phổ biến (Vision, SH, Air Blade...).
-   ➕ **Cá nhân hóa**: Cho phép người dùng tự thêm loại xe và dung tích bình xăng của riêng mình.
-   👥 **Quản lý người dùng**: Xác thực Telegram và lưu trữ hồ sơ người dùng.
-   📊 **Thống kê**: Theo dõi hoạt động và thống kê sử dụng bot.
-   👑 **Admin commands**: Quản lý người dùng và xem thống kê toàn bộ.

## 🛠 Tech Stack

-   **Language**: TypeScript / Node.js
-   **Database**: Supabase (PostgreSQL)
-   **API**: `giaxanghomnay.com` (Unofficial)
-   **Library**: `node-telegram-bot-api`
-   **Scheduler**: `node-cron`
-   **Deployment**: Hỗ trợ Render, Koyeb, VPS (PM2)

## 📖 Hướng dẫn cài đặt

### 1. Chuẩn bị
-   Tạo bot qua [@BotFather](https://t.me/BotFather) để lấy `TELEGRAM_BOT_TOKEN`.
-   Lấy `CHAT_ID` (có thể dùng bot @userinfobot).
-   Tạo project trên [Supabase](https://supabase.com/) và lấy `URL` + `Anon Key`.

### 2. Thiết lập Database
Chạy các migration sau trong Supabase SQL Editor theo thứ tự:

**Migration 1: Users table**
```sql
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  telegram_username text,
  first_name text,
  last_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_active boolean not null default true,
  registered_at timestamp with time zone not null default now(),
  last_active_at timestamp with time zone,
  metadata jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_users_telegram_id on users(telegram_id);
```

**Migration 2: User activity table**
```sql
create table if not exists user_activity (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  command text not null,
  executed_at timestamp with time zone not null default now(),
  metadata jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_user_activity_user_id on user_activity(user_id);
```

**Migration 3: User bikes table**
```sql
CREATE TABLE IF NOT EXISTS user_bikes (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity FLOAT8 NOT NULL,
  user_id uuid references users(id) on delete cascade,
  UNIQUE(chat_id, name)
);

create index if not exists idx_user_bikes_user_id on user_bikes(user_id);
```

### 3. Cấu hình môi trường (.env)
Tạo file `.env` từ `.env.example`:
```env
TELEGRAM_BOT_TOKEN=your_token
CHAT_ID=your_chat_id
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
ADMIN_TELEGRAM_IDS=your_admin_id_1,your_admin_id_2
```

### 4. Chạy Locally
```bash
npm install
npm run dev
```

## 🤖 Danh sách lệnh (Commands)

### Lệnh chung
-   `/start`: Khởi động và xem hướng dẫn.
-   `/today`: Xem giá xăng Petrolimex Vùng 1 hôm nay.
-   `/alert`: Kiểm tra biến động giá trong 10 ngày qua.
-   `/fillup` (hoặc `/doday`): Công cụ tính tiền đổ xăng.

### Lệnh người dùng
-   `/register`: Đăng ký xe mới.
-   `/profile`: Xem thông tin cá nhân và danh sách xe.
-   `/stats`: Xem thống kê cá nhân.

### Lệnh admin (yêu cầu quyền admin)
-   `/admin_users`: Xem danh sách người dùng.
-   `/admin_stats`: Xem thống kê toàn bộ (7 ngày qua).
-   `/admin_promote <telegram_id>`: Cấp quyền admin cho người dùng.
-   `/admin_ban <telegram_id>`: Cấm người dùng.

## 🔗 Deployment (Render)

1.  Đẩy code lên GitHub.
2.  Tạo **Web Service** trên Render.
    -   **Build Command**: `npm install && npm run build`
    -   **Start Command**: `node dist/index.js`
3.  Cấu hình **Environment Variables** đầy đủ như file `.env`.
4.  Dùng **UptimeRobot** ping vào URL của Render (mỗi 10 phút) để bot không bị "ngủ".

---
Dự án được phát triển bởi [zeddricc](https://github.com/zeddricc).
