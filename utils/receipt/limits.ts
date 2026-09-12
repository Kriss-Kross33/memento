/** Defensive caps — long supermarket receipts are valid; unbounded arrays are not. */
export const MAX_RECEIPT_ITEMS = 400;
export const MAX_ITEM_LABEL_LENGTH = 120;
export const MAX_ITEM_QUANTITY = 999;
export const MAX_RECEIPT_PAGES = 12;
export const AMOUNT_ROUNDING_TOLERANCE = 0.08;
export const AMOUNT_RELATIVE_TOLERANCE = 0.015;
