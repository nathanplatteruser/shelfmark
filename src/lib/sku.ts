export function todayStamp(d = new Date()): string {
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildSku(seq: number, d = new Date()): string {
  return `SM-${todayStamp(d)}-${String(seq).padStart(4, "0")}`;
}

export function parseSeq(sku: string): number {
  const m = sku.match(/SM-\d{6}-(\d+)/);
  return m ? Number(m[1]) : 0;
}
