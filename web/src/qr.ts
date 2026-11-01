// T43: QR code as inline SVG, without a library. Byte mode, error correction level M, versions 1–10 (up to 213 bytes),
// enough for an invitation link. Follows ISO/IEC 18004 (finder, timing, alignment, format and version bits, mask choice
// by penalty score).

// [total codewords, EC codewords per block, blocks in group 1, data codewords per block in group 1, blocks in group 2]
const TABELLE_M: [number, number, number, number, number][] = [
  [26, 10, 1, 16, 0], [44, 16, 1, 28, 0], [70, 26, 1, 44, 0], [100, 18, 2, 32, 0], [134, 24, 2, 43, 0],
  [172, 16, 4, 27, 0], [196, 18, 4, 31, 0], [242, 22, 2, 38, 2], [292, 22, 3, 36, 2], [346, 26, 4, 43, 1],
];
const AUSRICHTUNG = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const EXP = new Array<number>(512), LOG = new Array<number>(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mal = (a: number, b: number) => a && b ? EXP[LOG[a] + LOG[b]] : 0;

/** Reed–Solomon error correction codewords for one block. */
export function fehlerkorrektur(daten: number[], n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) { const neu = new Array(g.length + 1).fill(0); g.forEach((c, j) => { neu[j] ^= c; neu[j + 1] ^= mal(c, EXP[i]); }); g = neu; }
  const rest = new Array(n).fill(0);
  for (const b of daten) { const f = b ^ rest.shift()!; rest.push(0); for (let i = 0; i < n; i++) rest[i] ^= mal(g[i + 1], f); }
  return rest;
}

/** Module matrix (true = dark) for the text, or null if it is too long. */
export function qrMatrix(text: string): boolean[][] | null {
  const bytes = [...new TextEncoder().encode(text)];
  const v = TABELLE_M.findIndex(([, , b1, d1, b2], i) => (4 + (i < 9 ? 8 : 16) + 8 * bytes.length) <= (b1 * d1 + b2 * (d1 + 1)) * 8) + 1;
  if (v < 1) return null;
  const [, ec, b1, d1, b2] = TABELLE_M[v - 1];
  const kapazitaet = b1 * d1 + b2 * (d1 + 1), zaehlbits = v < 10 ? 8 : 16;
  // Bit stream: mode 0100, count, data, terminator, padding.
  const bits: number[] = [];
  const schreib = (wert: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((wert >>> i) & 1); };
  schreib(4, 4); schreib(bytes.length, zaehlbits); bytes.forEach((b) => schreib(b, 8));
  schreib(0, Math.min(4, kapazitaet * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const daten: number[] = [];
  for (let i = 0; i < bits.length; i += 8) daten.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let p = 0; daten.length < kapazitaet; p++) daten.push(p % 2 ? 0x11 : 0xec);
  // Blocks, error correction, interleaving.
  const bloecke: number[][] = [];
  let pos = 0;
  for (let i = 0; i < b1 + b2; i++) { const n = i < b1 ? d1 : d1 + 1; bloecke.push(daten.slice(pos, pos + n)); pos += n; }
  const ecs = bloecke.map((b) => fehlerkorrektur(b, ec));
  const folge: number[] = [];
  for (let i = 0; i <= d1; i++) for (const b of bloecke) if (i < b.length) folge.push(b[i]);
  for (let i = 0; i < ec; i++) for (const e of ecs) folge.push(e[i]);

  const n = 17 + 4 * v;
  const m: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const fest: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const setze = (x: number, y: number, d: boolean) => { if (x >= 0 && y >= 0 && x < n && y < n) { m[y][x] = d; fest[y][x] = true; } };
  for (let i = 0; i < n; i++) { setze(6, i, i % 2 === 0); setze(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); setze(cx + dx, cy + dy, d !== 2 && d !== 4); }
  const a = AUSRICHTUNG[v - 1], l = a.length - 1;
  a.forEach((x, i) => a.forEach((y, j) => { if ((i === 0 && j === 0) || (i === 0 && j === l) || (i === l && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setze(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const format = (maske: number) => {
    const d = maske; // level M = 00
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i: number) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setze(8, i, bit(i));
    setze(8, 7, bit(6)); setze(8, 8, bit(7)); setze(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setze(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setze(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setze(8, n - 15 + i, bit(i));
    setze(8, n - 8, true);
  };
  format(0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const d = ((b >>> i) & 1) === 1, x = n - 11 + (i % 3), y = Math.floor(i / 3); setze(x, y, d); setze(y, x, d); }
  }
  // Data in the zigzag.
  let i = 0;
  for (let rechts = n - 1; rechts >= 1; rechts -= 2) {
    if (rechts === 6) rechts = 5;
    for (let s = 0; s < n; s++) for (let j = 0; j < 2; j++) {
      const x = rechts - j, hoch = ((rechts + 1) & 2) === 0, y = hoch ? n - 1 - s : s;
      if (!fest[y][x]) { m[y][x] = i < folge.length * 8 && ((folge[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  const MASKEN = [(x: number, y: number) => (x + y) % 2 === 0, (_: number, y: number) => y % 2 === 0, (x: number) => x % 3 === 0, (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x: number, y: number) => (x * y) % 2 + (x * y) % 3 === 0,
    (x: number, y: number) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x: number, y: number) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
  const anwenden = (k: number) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fest[y][x] && MASKEN[k](x, y)) m[y][x] = !m[y][x]; };
  let beste = 0, punkte = Infinity;
  for (let k = 0; k < 8; k++) {
    anwenden(k); format(k);
    const p = strafe(m);
    if (p < punkte) { punkte = p; beste = k; }
    anwenden(k);
  }
  anwenden(beste); format(beste);
  return m;
}

/** Penalty score (ISO 18004 rules 1–4): lower is easier to scan. */
function strafe(m: boolean[][]): number {
  const n = m.length;
  let p = 0, dunkel = 0;
  const zeile = (get: (i: number) => boolean) => {
    let lauf = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) lauf++;
      else { if (lauf >= 5) p += 3 + lauf - 5; lauf = 1; }
    }
    const muster = [true, false, true, true, true, false, true];
    for (let i = 0; i + 7 <= n; i++) {
      if (!muster.every((b, k) => get(i + k) === b)) continue;
      const vorher = i >= 4 && [1, 2, 3, 4].every((k) => !get(i - k)), nachher = i + 11 <= n && [7, 8, 9, 10].every((k) => !get(i + k));
      if (vorher || nachher) p += 40;
    }
  };
  for (let y = 0; y < n; y++) zeile((x) => m[y][x]);
  for (let x = 0; x < n; x++) zeile((y) => m[y][x]);
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
  for (const r of m) for (const c of r) if (c) dunkel++;
  return p + 10 * Math.floor(Math.abs(dunkel * 20 - n * n * 10) / (n * n));
}

/** QR code as SVG (with quiet zone), or "" if the text is too long. */
export function qrSvg(text: string, titel = "QR-Code"): string {
  const m = qrMatrix(text);
  if (!m) return "";
  const n = m.length, rand = 4;
  let d = "";
  m.forEach((r, y) => r.forEach((c, x) => { if (c) d += `M${x + rand} ${y + rand}h1v1h-1z`; }));
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * rand} ${n + 2 * rand}" role="img" aria-label="${titel.replace(/[<>&"]/g, "")}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
