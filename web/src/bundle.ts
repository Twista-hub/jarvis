// Which uploaded files to read and in which order. Mirrors alarm/texte.py.

// Long legal boilerplate that rarely matters for a first assessment.
const SKIP = /tarifvertrag|verpflichtungserkl|sanktion|datenschutz|kennzettel/i;
const FIRST = /leistungsbeschreibung|aufforderung|^b0|^a0/i;
export const READABLE = /\.(pdf|docx|xlsx|xls|odt|ods|csv|txt|html?)$/i;
export const MAX_CHARS = 350_000;

export type Text = { name: string; text: string };

export function wanted(name: string): boolean {
  return READABLE.test(name) && !SKIP.test(name) && !name.startsWith("__MACOSX/");
}

/** All texts as one string, most important first; returns the names left out. */
export function bundle(texts: Text[], maxChars = MAX_CHARS): { text: string; skipped: string[] } {
  const order = (t: Text) => `${FIRST.test(baseName(t.name)) ? 0 : 1}${t.name}`;
  const parts: string[] = [];
  const skipped: string[] = [];
  let total = 0;
  for (const t of [...texts].sort((a, b) => order(a).localeCompare(order(b)))) {
    const clean = t.text.replace(/[ \t]{2,}/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    if (!clean) continue;
    if (total + clean.length > maxChars) {
      skipped.push(`${t.name} (zu lang)`);
      continue;
    }
    parts.push(`===== DATEI: ${t.name}\n${clean}`);
    total += clean.length;
  }
  return { text: parts.join("\n\n"), skipped };
}

export function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  txt: "text/plain",
  htm: "text/html",
  html: "text/html",
};

/** Workers AI needs the file type to convert a document. */
export function mimeType(name: string): string {
  return MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}
