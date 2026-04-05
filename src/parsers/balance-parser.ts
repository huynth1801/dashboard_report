import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import type { ParsedTransaction, ParseError } from "../types/transactions.js";
import { classifyTransaction, detectPeriod } from "../utils/parser-utils.js";

/**
 * Shopee balance/finance export has metadata rows before the actual headers.
 * Header row is at index 17 (0-based), so data starts at index 18.
 */
const HEADER_ROW_INDEX = 17;

const COL = {
  id: ["No.", "Số thứ tự", "ID"],
  date: ["Ngày/Giờ", "Date/Time", "Date", "Ngày"],
  typeRaw: ["Loại", "Type"],
  detail: ["Mô tả", "Description", "Detail", "Chi tiết"],
  orderId: ["Mã đơn hàng", "Order ID"],
  amount: ["Số tiền", "Amount", "Giá trị"],
};

function findColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h && h.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

interface ColIndexes {
  id: number;
  date: number;
  typeRaw: number;
  detail: number;
  orderId: number;
  amount: number;
}

function resolveColumns(headers: string[]): ColIndexes {
  return {
    id: findColumn(headers, COL.id),
    date: findColumn(headers, COL.date),
    typeRaw: findColumn(headers, COL.typeRaw),
    detail: findColumn(headers, COL.detail),
    orderId: findColumn(headers, COL.orderId),
    amount: findColumn(headers, COL.amount),
  };
}

/**
 * Parses a Shopee balance export xlsx file.
 * Header row is at index 17 (Shopee special format with metadata rows).
 * Amount signs: positive = income, negative = expense.
 */
export function parseBalanceFile(buffer: Buffer): {
  transactions: ParsedTransaction[];
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

  const transactions: ParsedTransaction[] = [];
  const errors: ParseError[] = [];
  let period = "";

  if (rows.length <= HEADER_ROW_INDEX) {
    errors.push({
      row: 0,
      message: `File has fewer than ${HEADER_ROW_INDEX + 1} rows; cannot find header row`,
    });
    return { transactions, errors, period };
  }

  const headers = (rows[HEADER_ROW_INDEX] as string[]).map((h) =>
    String(h ?? "")
  );
  const cols = resolveColumns(headers);

  if (cols.amount === -1 && cols.typeRaw === -1) {
    errors.push({
      row: HEADER_ROW_INDEX + 1,
      message: "Cannot find required columns (Amount, Type) in header row",
    });
    return { transactions, errors, period };
  }

  for (let i = HEADER_ROW_INDEX + 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const rowNum = i + 1;

    // Skip completely empty rows
    const hasData = row.some((cell) => String(cell ?? "").trim() !== "");
    if (!hasData) continue;

    const rawDate = cols.date !== -1 ? String(row[cols.date] ?? "").trim() : "";
    const rawTypeRaw =
      cols.typeRaw !== -1 ? String(row[cols.typeRaw] ?? "").trim() : "";
    const rawDetail =
      cols.detail !== -1 ? String(row[cols.detail] ?? "").trim() : "";
    const rawOrderId =
      cols.orderId !== -1 ? String(row[cols.orderId] ?? "").trim() : "";

    // Parse amount — Shopee uses positive for income, negative for expense
    const rawAmount =
      cols.amount !== -1 ? String(row[cols.amount] ?? "0").trim() : "0";
    // Remove thousand separators (commas or dots used as thousands) then parse
    const cleanAmount = rawAmount.replace(/[^\d.\-]/g, "");
    const amount = parseFloat(cleanAmount) || 0;

    if (!rawDate) {
      errors.push({ row: rowNum, field: "date", message: "Missing date" });
      continue;
    }

    const detectedPeriod = detectPeriod(rawDate);
    if (detectedPeriod && !period) {
      period = detectedPeriod;
    }

    // Generate a stable ID from row index if no id column
    const rowId =
      cols.id !== -1
        ? String(row[cols.id] ?? "").trim() || `tx-${i}`
        : `tx-${i}`;

    const type = classifyTransaction(rawTypeRaw);

    transactions.push({
      id: rowId,
      date: rawDate,
      type,
      typeRaw: rawTypeRaw,
      detail: rawDetail,
      orderId: rawOrderId,
      amount,
      period: detectedPeriod || period,
    });
  }

  if (!period && transactions.length > 0) {
    period = transactions[0].period;
  }

  return { transactions, errors, period };
}

export function generateBatchId(): string {
  return randomUUID();
}
