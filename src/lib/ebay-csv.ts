import type { CopyRecord } from "@/lib/types";
import { EBAY_CONDITION_ID, formatLabel } from "@/lib/condition";
import { clipTitle } from "@/lib/pricing";

/** Seller Hub Reports / File Exchange-style add file for Books. */
export const EBAY_BOOKS_CATEGORY = "261186";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const HEADERS = [
  "Action",
  "CustomLabel",
  "Category",
  "Title",
  "Description",
  "Format",
  "Duration",
  "StartPrice",
  "BuyItNowPrice",
  "Quantity",
  "ConditionID",
  "ConditionDescription",
  "PicURL",
  "P:ISBN",
  "C:Author",
  "C:Book Title",
  "C:Language",
  "C:Format",
  "C:Publisher",
  "C:Publication Year",
  "Location",
  "PostalCode",
  "ShippingType",
  "ShippingService-1:Option",
  "ShippingService-1:FreeShipping",
  "DispatchTimeMax",
  "ReturnsAcceptedOption",
  "ReturnsWithinOption",
  "RefundOption",
  "ShippingCostPaidByOption",
  "BestOfferEnabled",
] as const;

export function copiesToEbayCsv(copies: CopyRecord[]): string {
  const rows = copies.map((c) => {
    const isAuction = c.listFormat === "auction";
    const title = clipTitle(c.ebayTitle || c.title);
    const desc = (c.ebayDescription || c.conditionDescription || c.title).replace(/\r?\n/g, "<br>");
    const start = isAuction
      ? String(c.auctionStart ?? 9.99)
      : String(c.listPrice ?? 9.99);
    const bin = isAuction ? "" : String(c.listPrice ?? 9.99);
    const condId =
      c.conditionGrade && c.conditionGrade in EBAY_CONDITION_ID
        ? EBAY_CONDITION_ID[c.conditionGrade]
        : "5000";

    const values: string[] = [
      "Add",
      c.sku,
      EBAY_BOOKS_CATEGORY,
      title,
      desc,
      isAuction ? "Auction" : "FixedPrice",
      isAuction ? "7" : "GTC",
      start,
      bin,
      "1",
      condId,
      c.conditionDescription,
      c.coverUrl,
      c.isbn13,
      c.author,
      c.title,
      c.language || "English",
      formatLabel(c.format),
      c.publisher,
      c.publishedYear,
      "Lincoln, NE",
      "68508",
      "Flat",
      "USPSMedia",
      "0",
      "1",
      "ReturnsAccepted",
      "Days_30",
      "MoneyBack",
      "Buyer",
      c.listFormat === "offer" || c.listFormat === "bin" ? "1" : "0",
    ];
    return values.map(csvEscape).join(",");
  });
  return [HEADERS.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
