export interface ParsedOrder {
  orderId: string;
  orderDate: string;
  status: string;
  isCompleted: boolean;
  productName: string;
  productShort: string;
  sku: string;
  variant: string;
  quantity: number;
  unitCount: number;
  revenue: number;
  period: string;
}

export interface ParseError {
  row: number;
  field?: string;
  message: string;
  rawData?: Record<string, unknown>;
}
