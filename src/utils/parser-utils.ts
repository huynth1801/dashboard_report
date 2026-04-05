import { PRODUCT_NAME_MAP } from "../constants/products.js";
import { TRANSACTION_TYPE_MAP } from "../constants/transactions.js";
import type { TransactionType } from "../types/transactions.js";

/**
 * Returns true if a Shopee order status represents a completed order.
 * Shopee completed statuses include "Đã giao hàng", "Hoàn thành", "Complete", etc.
 */
export function isCompletedOrder(status: string): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  const completedStatuses = [
    "đã giao hàng",
    "hoàn thành",
    "complete",
    "completed",
    "delivered",
    "đơn hàng đã hoàn thành",
  ];
  return completedStatuses.includes(normalized);
}

/**
 * Extracts unit count from a product variant string.
 * Handles patterns like "Set 3", "Combo 2", "Bộ 5", etc.
 * Returns 1 if no set/combo pattern is found.
 */
export function getUnitCount(variant: string): number {
  if (!variant) return 1;
  // Match "Set N", "Combo N", "Bộ N", "x N" (case-insensitive)
  const match = variant.match(/(?:set|combo|bộ|x)\s*(\d+)/i);
  if (match) {
    const n = parseInt(match[1], 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }
  return 1;
}

/**
 * Shortens a full product name to a display name using PRODUCT_NAME_MAP.
 * Falls back to the first 30 characters of the name if no mapping found.
 */
export function shortenProductName(fullName: string): string {
  if (!fullName) return "";
  const normalized = fullName.trim();

  // Check exact match first
  if (PRODUCT_NAME_MAP[normalized]) {
    return PRODUCT_NAME_MAP[normalized];
  }

  // Check case-insensitive substring match
  const lowerName = normalized.toLowerCase();
  for (const [key, shortName] of Object.entries(PRODUCT_NAME_MAP)) {
    if (lowerName.includes(key.toLowerCase())) {
      return shortName;
    }
  }

  // Fallback: truncate to 30 chars
  return normalized.length > 30 ? normalized.substring(0, 30) + "…" : normalized;
}

/**
 * Detects the YYYY-MM period from a date string.
 * Supports formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, and ISO 8601.
 * Returns empty string if date cannot be parsed.
 */
export function detectPeriod(date: string): string {
  if (!date) return "";
  const trimmed = date.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) {
    const year = dmyMatch[3];
    const month = dmyMatch[2].padStart(2, "0");
    return `${year}-${month}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    return `${year}-${month}`;
  }

  // Try native Date parsing as last resort
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  return "";
}

/**
 * Classifies a raw Shopee transaction type string into a normalized TransactionType.
 * Falls back to "other" for unknown types.
 */
export function classifyTransaction(rawType: string): TransactionType {
  if (!rawType) return "other";
  const trimmed = rawType.trim();

  // Exact match first
  if (TRANSACTION_TYPE_MAP[trimmed]) {
    return TRANSACTION_TYPE_MAP[trimmed];
  }

  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [key, type] of Object.entries(TRANSACTION_TYPE_MAP)) {
    if (key.toLowerCase() === lower) {
      return type;
    }
  }

  // Partial keyword matching
  if (lower.includes("thanh toán") || lower.includes("payment")) return "order_payment";
  if (lower.includes("hoàn tiền") || lower.includes("refund")) return "return_refund";
  if (lower.includes("rút tiền") || lower.includes("withdrawal")) return "withdrawal";
  if (lower.includes("hoa hồng") || lower.includes("commission")) return "commission_fee";
  if (lower.includes("phí dịch vụ") || lower.includes("service fee")) return "service_fee";
  if (lower.includes("voucher")) return "voucher";
  if (lower.includes("vận chuyển") || lower.includes("shipping")) return "shipping_rebate";
  if (lower.includes("điều chỉnh") || lower.includes("adjust")) return "adjustment";

  return "other";
}
