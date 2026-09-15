import type { ConditionGrade, DefectId, BookFormat } from "@/lib/types";
import { CONDITION_GRADES, DEFECTS } from "@/lib/types";

export const EBAY_CONDITION_ID: Record<ConditionGrade, string> = {
  LN: "2750",
  VG: "4000",
  G: "5000",
  A: "6000",
};

export const EBAY_CONDITION_NAME: Record<ConditionGrade, string> = {
  LN: "Like New",
  VG: "Very Good",
  G: "Good",
  A: "Acceptable",
};

export function gradeLabel(id: ConditionGrade | ""): string {
  if (!id) return "Ungraded";
  return CONDITION_GRADES.find((g) => g.id === id)?.label ?? id;
}

export function defectLabel(id: DefectId): string {
  return DEFECTS.find((d) => d.id === id)?.label ?? id;
}

export function formatLabel(format: BookFormat | string): string {
  switch (format) {
    case "hardcover":
      return "Hardcover";
    case "paperback":
      return "Paperback";
    case "mass-market":
      return "Mass Market Paperback";
    case "trade":
      return "Trade Paperback";
    case "textbook":
      return "Textbook";
    default:
      return "Book";
  }
}

export function estimateWeightOz(format: BookFormat | string, pages: number | null): number {
  const p = pages ?? 300;
  if (format === "hardcover" || format === "textbook") return Math.max(16, Math.round(p * 0.08));
  if (format === "mass-market") return Math.max(6, Math.round(p * 0.04));
  return Math.max(8, Math.round(p * 0.055));
}

export function buildConditionDescription(
  grade: ConditionGrade | "",
  defects: DefectId[],
  notes: string,
): string {
  const g = gradeLabel(grade);
  if (!grade) return notes.trim();
  const parts: string[] = [`Condition: ${g}.`];
  if (defects.length === 0) {
    parts.push("No highlighting, underlining, or writing noted.");
  } else {
    parts.push(`Noted: ${defects.map(defectLabel).join(", ").toLowerCase()}.`);
  }
  if (notes.trim()) parts.push(notes.trim());
  parts.push("Photos and notes describe the actual copy that ships.");
  return parts.join(" ");
}

export function nextBin(existing: string[]): string {
  const used = new Set(existing.filter(Boolean));
  const rows = "ABCDEFGH";
  for (const row of rows) {
    for (let n = 1; n <= 24; n += 1) {
      const loc = `${row}-${String(n).padStart(2, "0")}`;
      const count = existing.filter((b) => b === loc).length;
      if (!used.has(loc) || count < 18) return loc;
    }
  }
  return `X-${String(existing.length + 1).padStart(3, "0")}`;
}
