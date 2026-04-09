import { TodayPrices, AlertResult, PriceAlert } from '../types/api.types';

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Format a VNĐ price with thousands separator, e.g. 20010 → "20.010" */
export function formatPrice(price: number): string {
  return price.toLocaleString('vi-VN');
}

/** Convert internal date string "YYYY-MM-DD" → "DD/MM/YYYY" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Today Prices Message ─────────────────────────────────────────────────────

/**
 * Builds the HTML-formatted Telegram message for today's Zone 1 prices.
 * Uses HTML parse mode for safe handling of Vietnamese special characters.
 */
export function buildTodayMessage(data: TodayPrices): string {
  const lines: string[] = [];

  lines.push(`⛽ <b>Giá Xăng Dầu Hôm Nay</b>`);
  lines.push(`📅 <b>${formatDate(data.date)}</b>`);
  lines.push('');

  // ── Petrolimex ────────────────────────────────────────────────────────────
  if (data.petrolimex.length > 0) {
    lines.push(`🔵 <b>PETROLIMEX (Vùng 1)</b>`);
    for (const item of data.petrolimex) {
      lines.push(`  • ${item.title}: <b>${formatPrice(item.zone1_price)} đ/lít</b>`);
    }
    lines.push('');
  }




  return lines.join('\n');
}

// ─── Alert Message ────────────────────────────────────────────────────────────

/** Format a single alert entry */
function formatAlert(alert: PriceAlert): string {
  const icon = alert.direction === '+' ? '📈' : '📉';
  const sign = alert.direction === '+' ? '+' : '-';
  return (
    `${icon} <b>${alert.fuelTitle}</b> <i>(${alert.source})</i>\n` +
    `   ${formatDate(alert.dateFrom)} → ${formatDate(alert.dateTo)}\n` +
    `   ${formatPrice(alert.priceBefore)} đ → ${formatPrice(alert.priceAfter)} đ ` +
    `(<b>${sign}${formatPrice(alert.delta)} đ</b>)`
  );
}

/**
 * Builds the HTML-formatted alert summary message.
 * Returns a "no alerts" message if nothing exceeded the threshold.
 */
export function buildAlertMessage(result: AlertResult): string {
  const lines: string[] = [];
  const windowLabel = `${formatDate(result.dateFrom)} – ${formatDate(result.dateTo)}`;

  lines.push(`🚨 <b>Biến Động Giá Xăng (${result.windowDays} ngày)</b>`);
  lines.push(`📆 Kỳ xem xét: <i>${windowLabel}</i>`);
  lines.push('');

  if (result.alerts.length === 0) {
    lines.push(`✅ Không có loại xăng nào biến động ≥ 1.000 đ trong ${result.windowDays} ngày qua.`);
  } else {
    lines.push(
      `⚠️ Phát hiện <b>${result.alerts.length}</b> loại biến động đáng kể:\n`
    );
    for (const alert of result.alerts) {
      lines.push(formatAlert(alert));
      lines.push('');
    }
  }



  return lines.join('\n');
}

// ─── Daily Digest (cron job) ──────────────────────────────────────────────────

import { format } from 'date-fns';

/** Builds the simplified daily message for broadcast */
export function buildDailyDigest(today: TodayPrices): string {
  const dateStr = format(new Date(), 'dd/MM/yyyy');
  let text = buildTodayMessage(today);
  
  // Chỉnh sửa tiêu đề để thêm thông tin cập nhật
  text = text.replace(`📅 <b>${dateStr}</b>`, `📅 <b>${dateStr}</b> (Cập nhật lúc 15:30)`);
  
  return text;
}

// ─── Error message ────────────────────────────────────────────────────────────

export function buildErrorMessage(context: string): string {
  return (
    `❌ <b>Lỗi khi lấy dữ liệu giá xăng</b>\n\n` +
    `Ngữ cảnh: <i>${context}</i>\n\n` +
    `API giaxanghomnay.com hiện tại không phản hồi hoặc trả về dữ liệu không hợp lệ.\n` +
    `Vui lòng thử lại sau giây lát.`
  );
}
