import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import type { ParsedOrder, ParseError } from "../types/orders.js";
import {
  isCompletedOrder,
  getUnitCount,
  shortenProductName,
  detectPeriod,
  parseVndAmount,
} from "../utils/parser-utils.js";

/**
 * Column header mappings for Shopee order export files.
 * Shopee uses Vietnamese headers in their exports.
 */
const COL = {
  orderId: [
    "Mã đơn hàng", "Order ID", "order id", "Mã Đơn Hàng",
  ],
  orderDate: [
    "Ngày đặt hàng", "Thời gian đặt hàng", "Order Creation Date",
    "Ngày Đặt Hàng", "Ngày tạo đơn", "Created Date",
  ],
  status: [
    "Trạng Thái Đơn Hàng", "Trạng thái đơn hàng", "Order Status", "Status",
    "Tình trạng đơn hàng",
  ],
  productName: [
    "Tên sản phẩm", "Product Name", "product name", "Tên Sản Phẩm",
  ],
  sku: [
    "SKU sản phẩm", "Product SKU", "SKU", "SKU Reference No.",
    "Mã SKU", "SKU Reference",
  ],
  variant: [
    "Tên phân loại hàng", "Phân loại hàng", "Variation", "Variation Name",
    "Tên phân loại", "Phân Loại Hàng",
  ],
  quantity: [
    "Số lượng", "Quantity", "Số Lượng",
  ],
  revenue: [
    // Priority 1: Total order value — this is what we want
    "Tổng giá trị đơn hàng (VND)", "Tổng giá trị đơn hàng",
    "Tổng số tiền Người mua thanh toán", "Tổng số tiền người mua thanh toán",
    // Priority 2: Other total amount columns
    "Thành tiền", "Tổng số tiền", "Tổng số tiền (VND)",
    "Người mua thanh toán",
    // Priority 3: Unit price (fallback — will be multiplied by quantity if needed)
    "Giá ưu đãi", "Đơn giá", "Đơn giá sản phẩm",
    "Giá bán", "Giá sản phẩm",
    // English variants
    "Total Order Price", "Revenue", "Total Amount",
    "Deal Price", "Product Price", "Total Product Price",
    "Buyer Paid", "Buyer Total Payment",
  ],
};

function findColumn(
  headers: string[],
  candidates: string[]
): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h && h.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

interface ColIndexes {
  orderId: number;
  orderDate: number;
  status: number;
  productName: number;
  sku: number;
  variant: number;
  quantity: number;
  revenue: number;
}

function resolveColumns(headers: string[]): ColIndexes {
  return {
    orderId: findColumn(headers, COL.orderId),
    orderDate: findColumn(headers, COL.orderDate),
    status: findColumn(headers, COL.status),
    productName: findColumn(headers, COL.productName),
    sku: findColumn(headers, COL.sku),
    variant: findColumn(headers, COL.variant),
    quantity: findColumn(headers, COL.quantity),
    revenue: findColumn(headers, COL.revenue),
  };
}

export function parseOrderFile(buffer: Buffer): {
  orders: ParsedOrder[];
  errors: ParseError[];
  period: string;
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const orders: ParsedOrder[] = [];
  const errors: ParseError[] = [];
  let period = "";

  if (rows.length < 2) {
    errors.push({ row: 0, message: "File is empty or has no data rows" });
    return { orders, errors, period };
  }

  // Auto-detect header row — Shopee exports may have metadata rows before headers
  let headerRowIndex = -1;
  let headers: string[] = [];
  let cols: ColIndexes = { orderId: -1, orderDate: -1, status: -1, productName: -1, sku: -1, variant: -1, quantity: -1, revenue: -1 };

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = (rows[r] as string[]).map((h) => String(h ?? ""));
    const testCols = resolveColumns(row);
    if (testCols.orderId !== -1) {
      headerRowIndex = r;
      headers = row;
      cols = testCols;
      break;
    }
  }

  if (headerRowIndex === -1 || cols.orderId === -1) {
    errors.push({ row: 0, message: "Cannot find Order ID column in any row (scanned first 30 rows)" });
    return { orders, errors, period };
  }

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const rowNum = i + 1;

    const rawOrderId = String(row[cols.orderId] ?? "").trim();
    if (!rawOrderId) continue; // skip empty rows

    const rawStatus = cols.status !== -1 ? String(row[cols.status] ?? "").trim() : "";
    const isCompleted = isCompletedOrder(rawStatus);

    // Only include completed orders
    if (!isCompleted) continue;

    const rawOrderDate =
      cols.orderDate !== -1 ? String(row[cols.orderDate] ?? "").trim() : "";
    const detectedPeriod = detectPeriod(rawOrderDate);
    if (detectedPeriod && !period) {
      period = detectedPeriod;
    }

    const rawProductName =
      cols.productName !== -1 ? String(row[cols.productName] ?? "").trim() : "";
    const rawVariant =
      cols.variant !== -1 ? String(row[cols.variant] ?? "").trim() : "";
    const rawSku = cols.sku !== -1 ? String(row[cols.sku] ?? "").trim() : "";

    const rawQuantity =
      cols.quantity !== -1 ? String(row[cols.quantity] ?? "0").trim() : "0";
    const quantity = parseInt(rawQuantity.replace(/[^0-9]/g, ""), 10) || 0;

    const rawRevenue =
      cols.revenue !== -1 ? String(row[cols.revenue] ?? "0").trim() : "0";
    const revenue = parseVndAmount(rawRevenue);

    if (!rawProductName) {
      errors.push({ row: rowNum, field: "productName", message: "Missing product name", rawData: { orderId: rawOrderId } });
    }

    const productShort = shortenProductName(rawProductName);
    const unitCount = getUnitCount(rawVariant) * quantity;

    orders.push({
      orderId: rawOrderId,
      orderDate: rawOrderDate,
      status: rawStatus,
      isCompleted: true,
      productName: rawProductName,
      productShort,
      sku: rawSku,
      variant: rawVariant,
      quantity,
      unitCount,
      revenue,
      period: detectedPeriod || period,
    });
  }

  // Use the most common period if still empty
  if (!period && orders.length > 0) {
    period = orders[0].period;
  }

  return { orders, errors, period };
}

export function generateBatchId(): string {
  return randomUUID();
}
