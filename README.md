# ⛽ GasBot VN - Telegram Bot Cập Nhật Giá Xăng Dầu

Bot Telegram giúp theo dõi giá xăng dầu tại Việt Nam (Petrolimex Vùng 1) theo thời gian thực, tích hợp tính năng tính toán chi phí đổ xăng và cảnh báo biến động giá.

## 🚀 Tính năng chính

-   🔔 **Bản tin tự động**: Gửi báo giá xăng 2 lần mỗi ngày (07:00 và 15:30 ICT).
-   📊 **Cảnh báo biến động**: Tự động phân tích dữ liệu 10 ngày gần nhất và cảnh báo nếu giá tăng/giảm mạnh (≥ 1.000đ).
-   🛵 **Tính tiền đổ đầy bình**: Công cụ tính chi phí đổ đầy bình cho các dòng xe phổ biến (Vision, SH, Air Blade...).
-   ➕ **Cá nhân hóa**: Cho phép người dùng tự thêm loại xe và dung tích bình xăng của riêng mình.
-   💾 **Lưu trữ vĩnh viễn**: Tích hợp Supabase để lưu loại xe của người dùng ngay cả khi server restart.

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
Chạy đoạn SQL sau trong Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS user_bikes (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity FLOAT8 NOT NULL,
  UNIQUE(chat_id, name)
);
```

### 3. Cấu hình môi trường (.env)
Tạo file `.env` từ `.env.example`:
```env
TELEGRAM_BOT_TOKEN=your_token
CHAT_ID=your_chat_id
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### 4. Chạy Locally
```bash
npm install
npm run dev
```

## 🤖 Danh sách lệnh (Commands)

-   `/start`: Khởi động và xem hướng dẫn.
-   `/today`: Xem giá xăng Petrolimex Vùng 1 hôm nay.
-   `/alert`: Kiểm tra biến động giá trong 10 ngày qua.
-   `/fillup` (hoặc `/doday`): Công cụ tính tiền đổ xăng.

## 🔗 Deployment (Render)

1.  Đẩy code lên GitHub.
2.  Tạo **Web Service** trên Render.
    -   **Build Command**: `npm install && npm run build`
    -   **Start Command**: `node dist/index.js`
3.  Cấu hình **Environment Variables** đầy đủ như file `.env`.
4.  Dùng **UptimeRobot** ping vào URL của Render (mỗi 10 phút) để bot không bị "ngủ".

---
Dự án được phát triển bởi [zeddricc](https://github.com/zeddricc).
