/**
 * Maps full Shopee product names to short display names.
 * Keys are substrings/patterns that appear in product names.
 * Values are the short product name used throughout the dashboard.
 */
export const PRODUCT_NAME_MAP: Record<string, string> = {
  // Add entries here as products are discovered.
  // Pattern matching is case-insensitive and checks if the product name INCLUDES the key.
  // Example:
  // "Kem dưỡng da mặt": "Kem mặt",
  // "Serum vitamin C": "Serum VC",
  // "Son môi": "Son",
  // "Tẩy trang": "Tẩy trang",
};
