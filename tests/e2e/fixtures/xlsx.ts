/**
 * Synthetic XLSX fixture generators for Shopee export formats.
 * Mirrors the exact column structure expected by the parsers in src/parsers/.
 *
 * These fixtures use synthetic data by default but are designed so that
 * real Shopee XLSX exports can be substituted by passing them in directly
 * via Buffer when running tests against production data.
 */

import * as XLSX from "xlsx";

export interface SyntheticOrder {
  orderId: string;
  orderDate: string; // DD/MM/YYYY
  status: string;
  productName: string;
  sku: string;
  variant: string;
  quantity: number;
  revenue: number;
}

/**
 * Creates a synthetic Shopee order export XLSX buffer.
 * Header row uses Vietnamese column names matching order-parser.ts COL map.
 */
export function createOrderXlsx(rows: SyntheticOrder[]): Buffer {
  const headers = [
    "Mã đơn hàng",
    "Thời gian đặt hàng",
    "Trạng thái đơn hàng",
    "Tên sản phẩm",
    "SKU sản phẩm",
    "Phân loại hàng",
    "Số lượng",
    "Tổng giá trị đơn hàng",
  ];

  const data = rows.map((r) => [
    r.orderId,
    r.orderDate,
    r.status,
    r.productName,
    r.sku,
    r.variant,
    r.quantity,
    r.revenue,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export interface SyntheticTransaction {
  no: string;
  date: string; // DD/MM/YYYY
  typeRaw: string;
  detail: string;
  orderId: string;
  amount: number;
}

/**
 * Creates a synthetic Shopee balance export XLSX buffer.
 * Shopee balance exports have metadata rows 0–16, header at row 17,
 * data starting at row 18. This matches balance-parser.ts HEADER_ROW_INDEX = 17.
 */
export function createBalanceXlsx(rows: SyntheticTransaction[]): Buffer {
  const headers = [
    "No.",
    "Ngày/Giờ",
    "Loại",
    "Mô tả",
    "Mã đơn hàng",
    "Số tiền",
  ];

  // 17 filler rows (indices 0–16) mimicking Shopee's metadata section
  const fillerRows = Array.from({ length: 17 }, (_, i) => [
    `Shopee Balance Statement Row ${i}`,
    "",
    "",
    "",
    "",
    "",
  ]);

  const data = rows.map((r, i) => [
    r.no || String(i + 1),
    r.date,
    r.typeRaw,
    r.detail,
    r.orderId,
    r.amount,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...fillerRows, headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ---------------------------------------------------------------------------
// Pre-built fixture data for period 2024-03
// ---------------------------------------------------------------------------

export const TEST_PERIOD = "2024-03";

/** 3 completed + 1 pending order in March 2024 */
export const SAMPLE_ORDERS: SyntheticOrder[] = [
  {
    orderId: "ORD-001",
    orderDate: "05/03/2024",
    status: "Đã giao hàng",
    productName: "Kem dưỡng da mặt Premium",
    sku: "SKU-KEM-001",
    variant: "Standard",
    quantity: 2,
    revenue: 300000,
  },
  {
    orderId: "ORD-002",
    orderDate: "10/03/2024",
    status: "Hoàn thành",
    productName: "Serum vitamin C Gold",
    sku: "SKU-SER-001",
    variant: "Set 3",
    quantity: 1,
    revenue: 450000,
  },
  {
    orderId: "ORD-003",
    orderDate: "15/03/2024",
    status: "Đã giao hàng",
    productName: "Kem dưỡng da mặt Premium",
    sku: "SKU-KEM-001",
    variant: "Standard",
    quantity: 1,
    revenue: 150000,
  },
  {
    // Non-completed order — should be excluded from analytics
    orderId: "ORD-004",
    orderDate: "20/03/2024",
    status: "Đã hủy",
    productName: "Son môi đỏ",
    sku: "SKU-SON-001",
    variant: "Màu đỏ",
    quantity: 1,
    revenue: 200000,
  },
];

/** Transactions for March 2024 matching the completed orders above */
export const SAMPLE_TRANSACTIONS: SyntheticTransaction[] = [
  {
    no: "1",
    date: "05/03/2024",
    typeRaw: "Thanh toán đơn hàng",
    detail: "Payment for ORD-001",
    orderId: "ORD-001",
    amount: 300000,
  },
  {
    no: "2",
    date: "10/03/2024",
    typeRaw: "Thanh toán đơn hàng",
    detail: "Payment for ORD-002",
    orderId: "ORD-002",
    amount: 450000,
  },
  {
    no: "3",
    date: "15/03/2024",
    typeRaw: "Phí hoa hồng",
    detail: "Commission fee March",
    orderId: "",
    amount: -45000,
  },
  {
    no: "4",
    date: "20/03/2024",
    typeRaw: "Hoàn tiền người mua",
    detail: "Refund for ORD-003",
    orderId: "ORD-003",
    amount: -150000,
  },
];
