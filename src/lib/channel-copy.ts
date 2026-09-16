import type { ConditionGrade } from "@/lib/types";
import { buildEbayTitle, clipTitle } from "@/lib/pricing";
import { formatLabel } from "@/lib/condition";

export function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function gradeCopy(grade: ConditionGrade | string): string {
  if (grade === "LN") {
    return "Like New. Looks unread. Tight binding, clean pages. No highlighting, underlining, or writing noted.";
  }
  if (grade === "VG") {
    return "Very Good. Light shelf wear. Complete and clean. No highlighting, underlining, or writing noted.";
  }
  if (grade === "G") {
    return "Good. Obvious reading wear. Complete and readable. All pages present.";
  }
  if (grade === "A") {
    return "Acceptable. Worn but complete. All pages present. Packed as a reading copy.";
  }
  return "Used copy. Complete. Packed as described.";
}

export type CopySource = {
  isbn13: string;
  title: string;
  author: string;
  publisher?: string;
  publishedYear?: string;
  format: string;
  pages?: number | null;
  language?: string;
  subjects?: string;
  catalogBlurb?: string;
  conditionGrade: ConditionGrade | string;
};

/** Amazon ISBN listing: catalog already has the blurb. This is THIS copy only. */
export function amazonItemNote(src: CopySource): string {
  const bits = [
    gradeCopy(src.conditionGrade),
    "This is the copy that ships.",
    "Packed from Lincoln, Nebraska via USPS Media Mail.",
  ];
  return bits.join(" ").slice(0, 1000);
}

/** eBay is a one-off listing. Buyer never sees an Amazon catalog page. */
export function ebayListingDescription(src: CopySource): string {
  const blurb = stripHtml(src.catalogBlurb || "").slice(0, 1200);
  const meta = [
    src.format ? formatLabel(src.format) : "",
    src.publisher,
    src.publishedYear,
    src.pages ? `${src.pages} pages` : "",
    src.language || "English",
  ]
    .filter(Boolean)
    .join(" · ");
  const parts = [
    src.title,
    src.author ? `by ${src.author}` : "",
    meta,
    src.isbn13 ? `ISBN ${src.isbn13}` : "",
    "",
    blurb
      ? blurb
      : src.subjects
        ? `About this book: ${src.subjects}.`
        : "Used copy of the edition on the barcode. Open the photos and the ISBN if you need to match a classroom list.",
    "",
    "This copy",
    gradeCopy(src.conditionGrade),
    "",
    "Ships from Lincoln, Nebraska via USPS Media Mail. Packed to survive the trip. Combined shipping when the cart allows.",
  ];
  return parts.filter((l, i) => !(l === "" && parts[i - 1] === "")).join("\n");
}

export function fallbackChannelCopy(src: CopySource): {
  isbn13: string;
  ebayTitle: string;
  ebayDescription: string;
  amazonItemNote: string;
  conditionDescription: string;
  polished: boolean;
} {
  return {
    isbn13: src.isbn13,
    ebayTitle: clipTitle(
      buildEbayTitle({
        title: src.title,
        author: src.author,
        format: src.format,
        publishedYear: src.publishedYear ?? "",
        conditionGrade: (src.conditionGrade || "VG") as ConditionGrade,
      }),
    ),
    ebayDescription: ebayListingDescription(src),
    amazonItemNote: amazonItemNote(src),
    conditionDescription: gradeCopy(src.conditionGrade),
    polished: false,
  };
}
