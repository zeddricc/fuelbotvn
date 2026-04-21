#!/usr/bin/env ts-node
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { StorageService } from './services/storageService';

// ─── Environment ──────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'];
const CHAT_ID = process.env['CHAT_ID'];

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or CHAT_ID in .env');
  process.exit(1);
}

// ─── Parse arguments ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let messageFile = 'broadcast.txt';
let targetChatId: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-c' && args[i + 1]) {
    targetChatId = args[i + 1];
    i++;
  } else if (!args[i].startsWith('-')) {
    messageFile = args[i];
  }
}

const filePath = path.join(process.cwd(), messageFile);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const message = fs.readFileSync(filePath, 'utf-8').trim();

if (!message) {
  console.error('Message is empty');
  process.exit(1);
}

console.log(`[broadcast] Reading message from: ${messageFile}`);
console.log(`[broadcast] Message preview: ${message.substring(0, 100)}...`);

// ─── Determine target chat(s) ─────────────────────────────────────────────────

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const chatIds = targetChatId ? [targetChatId.trim()] : CHAT_ID.split(',').map(id => id.trim());

console.log(`[broadcast] Sending to ${chatIds.length} chat(s)...`);
if (targetChatId) {
  console.log(`[broadcast] Target chat: ${targetChatId}`);
}

// ─── Send broadcast ───────────────────────────────────────────────────────────

async function sendBroadcast() {
  for (const chatId of chatIds) {
    try {
      // Delete previous message if exists
      const lastMessageId = await StorageService.getLastMessageId(chatId);
      if (lastMessageId) {
        try {
          await bot.deleteMessage(chatId, lastMessageId);
          console.log(`[broadcast] ✓ Deleted previous message ${lastMessageId}`);
        } catch (delErr: any) {
          console.log(`[broadcast] - No previous message to delete`);
        }
      }

      console.log(`[broadcast] Sending to ${chatId}...`);
      const sentMessage = await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      await StorageService.setLastMessageId(chatId, sentMessage.message_id);
      console.log(`[broadcast] ✓ Sent to ${chatId} (message_id: ${sentMessage.message_id})`);
    } catch (err: any) {
      console.error(`[broadcast] ✗ Failed to send to ${chatId}:`, err.message);
    }
  }

  console.log('[broadcast] Done!');
  process.exit(0);
}

sendBroadcast();
