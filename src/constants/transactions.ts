import type { TransactionType } from "../types/transactions.js";

/**
 * Maps Shopee's raw transaction type strings to normalized TransactionType values.
 * Keys are the exact strings as they appear in Shopee balance export files.
 */
export const TRANSACTION_TYPE_MAP: Record<string, TransactionType> = {
  // Shopee Vietnamese labels
  "Thanh toán đơn hàng": "order_payment",
  "Hoàn tiền người mua": "return_refund",
  "Hoàn tiền": "return_refund",
  "Rút tiền": "withdrawal",
  "Phí dịch vụ": "service_fee",
  "Phí hoa hồng": "commission_fee",
  "Hoa hồng": "commission_fee",
  "Voucher": "voucher",
  "Voucher từ Shopee": "voucher",
  "Điều chỉnh": "adjustment",
  "Hoàn phí vận chuyển": "shipping_rebate",
  "Phụ cấp vận chuyển": "shipping_rebate",

  // Shopee English labels (some exports use English)
  "Order Payment": "order_payment",
  "Buyer Return Refund": "return_refund",
  "Refund": "return_refund",
  "Withdrawal": "withdrawal",
  "Service Fee": "service_fee",
  "Commission Fee": "commission_fee",
  "Shopee Voucher": "voucher",
  "Adjustment": "adjustment",
  "Shipping Rebate": "shipping_rebate",
};
