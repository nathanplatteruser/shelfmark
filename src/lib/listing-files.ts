import type { CopyRecord } from "@/lib/types";
import { gradeLabel } from "@/lib/condition";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function tsvEscape(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

/** Biblio custom upload: SKU, author, title, description, price, plus status for deletes. */
export function copiesToBiblioCsv(copies: CopyRecord[], mode: "add" | "delete"): string {
  const headers = ["Book ID", "Status", "Price", "Author", "Title", "Condition", "ISBN", "Description"];
  const rows = copies.map((c) => {
    const status = mode === "delete" ? "D" : "A";
    const price = mode === "delete" ? "0" : String(c.listPrice ?? 9.99);
    const cond = c.conditionGrade ? gradeLabel(c.conditionGrade) : "Good";
    const desc = (c.conditionDescription || cond).replace(/\r?\n/g, " ");
    return [c.sku, status, price, c.author, c.title, cond, c.isbn13, desc].map(csvEscape).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

/** Alibris skinny: ISBN, condition, price — their catalog fills the rest. */
export function copiesToAlibrisCsv(copies: CopyRecord[], mode: "add" | "delete"): string {
  const headers = ["ISBN", "SKU", "Condition", "Price", "Quantity"];
  const rows = copies.map((c) => {
    const qty = mode === "delete" ? "0" : "1";
    const price = mode === "delete" ? "0" : String(c.listPrice ?? 9.99);
    const cond = c.conditionGrade ? gradeLabel(c.conditionGrade) : "Good";
    return [c.isbn13 || c.isbn10, c.sku, cond, price, qty].map(csvEscape).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

/** Amazon Inventory Loader (tab-separated). product-id-type 2 = ISBN. MFN, not FBA. */
function amazonCondition(grade: string): string {
  if (grade === "LN") return "1";
  if (grade === "VG") return "2";
  if (grade === "G") return "3";
  if (grade === "A") return "4";
  return "3";
}

export function copiesToAmazonLoader(copies: CopyRecord[], mode: "add" | "delete" = "add"): string {
  const headers = [
    "sku",
    "product-id",
    "product-id-type",
    "price",
    "item-condition",
    "quantity",
    "add-delete",
    "item-note",
    "fulfillment-center-id",
    "will-ship-internationally",
    "expedited-shipping",
  ];
  const rows = copies.map((c) => {
    const note = (c.conditionDescription || "").slice(0, 1000);
    const values = [
      c.sku,
      c.isbn13 || c.isbn10,
      c.isbn13 ? "2" : "3",
      mode === "delete" ? "0" : String(c.listPrice ?? 9.99),
      amazonCondition(c.conditionGrade),
      mode === "delete" ? "0" : "1",
      mode === "delete" ? "d" : "a",
      note,
      "DEFAULT",
      "6",
      "n",
    ];
    return values.map(tsvEscape).join("\t");
  });
  return [headers.join("\t"), ...rows].join("\n");
}

/** Homebase ledger — what the scan hydrated. Open in Excel. Not an eBay/Amazon upload. */
export function copiesToShelfmarkCsv(copies: CopyRecord[]): string {
  const headers = [
    "sku",
    "isbn13",
    "isbn10",
    "title",
    "author",
    "publisher",
    "published_year",
    "format",
    "condition",
    "list_price",
    "bin",
    "status",
    "listed_at",
    "sold_at",
    "skip_reason",
    "ebay_title",
    "ebay_description",
    "amazon_item_note",
  ];
  const rows = copies.map((c) =>
    [
      c.sku,
      c.isbn13,
      c.isbn10,
      c.title,
      c.author,
      c.publisher,
      c.publishedYear,
      c.format,
      gradeLabel(c.conditionGrade),
      c.listPrice == null ? "" : String(c.listPrice),
      c.binLocation,
      c.status,
      c.listedAt ?? "",
      c.soldAt ?? "",
      c.skipReason,
      c.ebayTitle,
      c.ebayDescription,
      c.conditionDescription,
    ]
      .map((v) => csvEscape(String(v ?? "")))
      .join(","),
  );
  return `\uFEFF${[headers.join(","), ...rows].join("\n")}`;
}

export { downloadText } from "@/lib/ebay-csv";
