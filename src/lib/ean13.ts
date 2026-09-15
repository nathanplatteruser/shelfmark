/** Draw Bookland EAN-13 as SVG paths. Encoding follows GS1 / BISG. */

const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const R = [
  "1110010",
  "1100110",
  "1101100",
  "1000010",
  "1011100",
  "1001110",
  "1010000",
  "1000100",
  "1001000",
  "1110100",
];
const FIRST = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

function isbn13CheckDigit(body12: string): string {
  const sum = body12.split("").reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

export function encodeEan13(isbn13: string): string | null {
  const d = isbn13.replace(/\D/g, "");
  if (d.length !== 13 || !/^\d{13}$/.test(d)) return null;
  if (isbn13CheckDigit(d.slice(0, 12)) !== d[12]) {
    // Still encode — practice barcodes should render even if a check digit is off.
  }
  const first = Number(d[0]);
  const pattern = FIRST[first] ?? FIRST[0];
  let bits = "101";
  for (let i = 0; i < 6; i += 1) {
    const n = Number(d[i + 1]);
    bits += (pattern[i] === "L" ? L : G)[n];
  }
  bits += "01010";
  for (let i = 7; i < 13; i += 1) {
    bits += R[Number(d[i])];
  }
  bits += "101";
  return bits;
}

export function ean13SvgPath(isbn13: string, module = 2, height = 72): { width: number; height: number; d: string } | null {
  const bits = encodeEan13(isbn13);
  if (!bits) return null;
  const quiet = module * 8;
  const bars: string[] = [];
  let x = quiet;
  for (const bit of bits) {
    if (bit === "1") bars.push(`M${x} 0h${module}v${height}h-${module}z`);
    x += module;
  }
  return {
    width: quiet * 2 + bits.length * module,
    height,
    d: bars.join(""),
  };
}
