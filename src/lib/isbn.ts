/** ISBN / EAN helpers for grocery-style HID scanners. */

export function digitsOnly(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isbn13CheckDigit(body12: string): string {
  const sum = body12.split("").reduce((acc, ch, i) => {
    const n = Number(ch);
    return acc + n * (i % 2 === 0 ? 1 : 3);
  }, 0);
  return String((10 - (sum % 10)) % 10);
}

function isbn10CheckDigit(body9: string): string {
  const sum = body9.split("").reduce((acc, ch, i) => acc + Number(ch) * (10 - i), 0);
  const rem = (11 - (sum % 11)) % 11;
  return rem === 10 ? "X" : String(rem);
}

export function isIsbn13(code: string): boolean {
  const d = digitsOnly(code);
  if (d.length !== 13 || !/^\d{13}$/.test(d)) return false;
  return isbn13CheckDigit(d.slice(0, 12)) === d[12];
}

export function isIsbn10(code: string): boolean {
  const d = digitsOnly(code);
  if (d.length !== 10 || !/^\d{9}[\dX]$/.test(d)) return false;
  return isbn10CheckDigit(d.slice(0, 9)) === d[9];
}

export function isbn10To13(isbn10: string): string {
  const d = digitsOnly(isbn10);
  const body = `978${d.slice(0, 9)}`;
  return body + isbn13CheckDigit(body);
}

export function isbn13To10(isbn13: string): string {
  const d = digitsOnly(isbn13);
  if (!d.startsWith("978") || d.length !== 13) return "";
  const body = d.slice(3, 12);
  return body + isbn10CheckDigit(body);
}

/**
 * HID grocery scanners type EAN-13, sometimes with a 5-digit price add-on.
 * Some US paperbacks are UPC-A (12). Accept the useful subset and normalize.
 */
export function normalizeScannedCode(raw: string): string | null {
  const d = digitsOnly(raw);
  if (!d) return null;

  // EAN-13 + 5-digit add-on
  if (d.length === 18 && (d.startsWith("978") || d.startsWith("979"))) {
    const isbn = d.slice(0, 13);
    return isIsbn13(isbn) ? isbn : isbn;
  }

  if (d.length === 13) {
    if (isIsbn13(d)) return d;
    // Still return it — some damaged barcodes fail the check but lookup may work
    if (d.startsWith("978") || d.startsWith("979")) return d;
    return d;
  }

  if (d.length === 12) {
    // UPC-A → EAN-13
    const ean = `0${d}`;
    return ean;
  }

  if (d.length === 10 && isIsbn10(d)) {
    return isbn10To13(d);
  }

  if (d.length === 10) return isbn10To13(d);

  return null;
}

export function looksLikeScanBurst(code: string): boolean {
  const d = digitsOnly(code);
  return d.length >= 10 && d.length <= 18;
}

/** Pull unique ISBNs out of a pasted pallet list, spreadsheet dump, or notes. */
export function extractIsbns(text: string): string[] {
  const chunks = text.match(/[0-9Xx][0-9Xx \-]{8,20}[0-9Xx]/g) ?? [];
  const out: string[] = [];
  for (const chunk of chunks) {
    const n = normalizeScannedCode(chunk);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function formatIsbnDisplay(isbn13: string): string {
  const d = digitsOnly(isbn13);
  if (d.length !== 13) return isbn13;
  return `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9, 12)}-${d.slice(12)}`;
}
