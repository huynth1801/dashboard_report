export type TransactionType =
  | "order_payment"
  | "return_refund"
  | "withdrawal"
  | "service_fee"
  | "commission_fee"
  | "voucher"
  | "adjustment"
  | "shipping_rebate"
  | "other";

export interface ParsedTransaction {
  id: string;
  date: string;
  type: TransactionType;
  typeRaw: string;
  detail: string;
  orderId: string;
  amount: number;
  period: string;
}

export interface ParseError {
  row: number;
  field?: string;
  message: string;
  rawData?: Record<string, unknown>;
}
