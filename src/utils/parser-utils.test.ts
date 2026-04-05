import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  isCompletedOrder,
  getUnitCount,
  shortenProductName,
  detectPeriod,
  classifyTransaction,
} from "./parser-utils.js";

// Mock PRODUCT_NAME_MAP so tests are independent of constant changes
vi.mock("../constants/products.js", () => ({
  PRODUCT_NAME_MAP: {
    "Kem dưỡng da mặt": "Kem mặt",
    "Serum vitamin C": "Serum VC",
  },
}));

describe("isCompletedOrder", () => {
  it("returns true for Vietnamese completed statuses", () => {
    expect(isCompletedOrder("Đã giao hàng")).toBe(true);
    expect(isCompletedOrder("Hoàn thành")).toBe(true);
    expect(isCompletedOrder("đã giao hàng")).toBe(true); // case-insensitive
  });

  it("returns true for English completed statuses", () => {
    expect(isCompletedOrder("Complete")).toBe(true);
    expect(isCompletedOrder("Completed")).toBe(true);
    expect(isCompletedOrder("Delivered")).toBe(true);
  });

  it("returns false for non-completed statuses", () => {
    expect(isCompletedOrder("Đang vận chuyển")).toBe(false);
    expect(isCompletedOrder("Chờ xác nhận")).toBe(false);
    expect(isCompletedOrder("Cancelled")).toBe(false);
    expect(isCompletedOrder("Đã hủy")).toBe(false);
  });

  it("returns false for empty or null-like inputs", () => {
    expect(isCompletedOrder("")).toBe(false);
    expect(isCompletedOrder("   ")).toBe(false);
  });
});

describe("getUnitCount", () => {
  it("extracts count from Set N pattern", () => {
    expect(getUnitCount("Set 3")).toBe(3);
    expect(getUnitCount("Set3")).toBe(3);
    expect(getUnitCount("set 5")).toBe(5);
  });

  it("extracts count from Combo N pattern", () => {
    expect(getUnitCount("Combo 2")).toBe(2);
    expect(getUnitCount("combo2")).toBe(2);
    expect(getUnitCount("COMBO 10")).toBe(10);
  });

  it("extracts count from Bộ N pattern", () => {
    expect(getUnitCount("Bộ 4")).toBe(4);
    expect(getUnitCount("bộ 6")).toBe(6);
  });

  it("returns 1 when no set/combo pattern found", () => {
    expect(getUnitCount("Màu đỏ - Size M")).toBe(1);
    expect(getUnitCount("")).toBe(1);
    expect(getUnitCount("Standard")).toBe(1);
  });

  it("returns 1 for invalid numbers", () => {
    expect(getUnitCount("Set 0")).toBe(1);
  });
});

describe("shortenProductName", () => {
  it("returns mapped name for exact match", () => {
    expect(shortenProductName("Kem dưỡng da mặt")).toBe("Kem mặt");
    expect(shortenProductName("Serum vitamin C")).toBe("Serum VC");
  });

  it("returns mapped name for case-insensitive substring match", () => {
    expect(shortenProductName("Kem dưỡng da mặt loại A")).toBe("Kem mặt");
  });

  it("truncates long unmapped names to 30 chars", () => {
    const longName = "A".repeat(50);
    const result = shortenProductName(longName);
    expect(result.length).toBeLessThanOrEqual(32); // 30 + ellipsis
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns short names unchanged", () => {
    expect(shortenProductName("Son")).toBe("Son");
  });

  it("returns empty string for empty input", () => {
    expect(shortenProductName("")).toBe("");
  });
});

describe("detectPeriod", () => {
  it("parses DD/MM/YYYY format", () => {
    expect(detectPeriod("15/03/2024")).toBe("2024-03");
    expect(detectPeriod("01/12/2023")).toBe("2023-12");
  });

  it("parses DD-MM-YYYY format", () => {
    expect(detectPeriod("15-03-2024")).toBe("2024-03");
  });

  it("parses YYYY-MM-DD format", () => {
    expect(detectPeriod("2024-03-15")).toBe("2024-03");
    expect(detectPeriod("2023-12-01")).toBe("2023-12");
  });

  it("handles single-digit months and days", () => {
    expect(detectPeriod("5/3/2024")).toBe("2024-03");
    expect(detectPeriod("1/1/2024")).toBe("2024-01");
  });

  it("returns empty string for invalid/empty input", () => {
    expect(detectPeriod("")).toBe("");
    expect(detectPeriod("not-a-date")).toBe("");
  });
});

describe("classifyTransaction", () => {
  it("classifies Vietnamese payment types", () => {
    expect(classifyTransaction("Thanh toán đơn hàng")).toBe("order_payment");
    expect(classifyTransaction("Hoàn tiền người mua")).toBe("return_refund");
    expect(classifyTransaction("Rút tiền")).toBe("withdrawal");
    expect(classifyTransaction("Phí dịch vụ")).toBe("service_fee");
    expect(classifyTransaction("Phí hoa hồng")).toBe("commission_fee");
    expect(classifyTransaction("Voucher từ Shopee")).toBe("voucher");
    expect(classifyTransaction("Hoàn phí vận chuyển")).toBe("shipping_rebate");
  });

  it("classifies English payment types", () => {
    expect(classifyTransaction("Order Payment")).toBe("order_payment");
    expect(classifyTransaction("Refund")).toBe("return_refund");
    expect(classifyTransaction("Commission Fee")).toBe("commission_fee");
    expect(classifyTransaction("Withdrawal")).toBe("withdrawal");
  });

  it("returns other for unknown types", () => {
    expect(classifyTransaction("Unknown Type XYZ")).toBe("other");
    expect(classifyTransaction("")).toBe("other");
  });

  it("uses partial keyword matching as fallback", () => {
    expect(classifyTransaction("Partial thanh toán")).toBe("order_payment");
    expect(classifyTransaction("Some hoàn tiền case")).toBe("return_refund");
  });
});
