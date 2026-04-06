import { describe, it, expect } from "vitest";
import { parseVndAmount } from "./parser-utils.js";

describe("parseVndAmount", () => {
  it("handles VND format with dots as thousands separators", () => {
    // From user's Excel screenshots
    expect(parseVndAmount("7.594.267")).toBe(7594267);
    expect(parseVndAmount("15.948.311")).toBe(15948311);
    expect(parseVndAmount("27.006.049")).toBe(27006049);
    expect(parseVndAmount("50.892.890")).toBe(50892890);
    expect(parseVndAmount("42.944.495")).toBe(42944495);
  });

  it("handles negative VND amounts (fees, deductions)", () => {
    expect(parseVndAmount("-1.344.600")).toBe(-1344600);
    expect(parseVndAmount("-2.970.000")).toBe(-2970000);
    expect(parseVndAmount("-3.510.000")).toBe(-3510000);
    expect(parseVndAmount("-7.878.600")).toBe(-7878600);
  });

  it("handles small negative amounts with single dot (shipping adjustments)", () => {
    // These are tricky: single dot could be decimal or thousands separator
    // In VND context, "50.355" = 50,355 (thousands separator)
    expect(parseVndAmount("-4.860")).toBe(-4860);
    expect(parseVndAmount("-50.355")).toBe(-50355);
    expect(parseVndAmount("-14.580")).toBe(-14580);
    expect(parseVndAmount("-69.795")).toBe(-69795);
  });

  it("handles small amounts like 344.263 as VND thousands", () => {
    expect(parseVndAmount("344.263")).toBe(344263);
    expect(parseVndAmount("-54.000")).toBe(-54000);
  });

  it("handles zero and empty values", () => {
    expect(parseVndAmount("0")).toBe(0);
    expect(parseVndAmount("")).toBe(0);
    expect(parseVndAmount("  ")).toBe(0);
  });

  it("handles plain integer amounts", () => {
    expect(parseVndAmount("1000")).toBe(1000);
    expect(parseVndAmount("290263")).toBe(290263);
  });

  it("handles currency symbols", () => {
    expect(parseVndAmount("7.594.267₫")).toBe(7594267);
    expect(parseVndAmount("7.594.267 đ")).toBe(7594267);
    expect(parseVndAmount("7.594.267 VND")).toBe(7594267);
  });

  it("handles comma-separated format", () => {
    expect(parseVndAmount("7,594,267")).toBe(7594267);
    expect(parseVndAmount("-1,344,600")).toBe(-1344600);
  });

  it("net revenue formula works", () => {
    // T1: 7,594,267 - 1,344,600 - 4,860 = 6,244,807
    const gross = parseVndAmount("7.594.267");
    const fees = Math.abs(parseVndAmount("-1.344.600"));
    const shipAdj = Math.abs(parseVndAmount("-4.860"));
    expect(gross - fees - shipAdj).toBe(6244807);

    // Total: 50,892,890 - 7,878,600 - 69,795 = 42,944,495
    const totalGross = parseVndAmount("50.892.890");
    const totalFees = Math.abs(parseVndAmount("-7.878.600"));
    const totalShip = Math.abs(parseVndAmount("-69.795"));
    expect(totalGross - totalFees - totalShip).toBe(42944495);
  });
});
