// Small Word (.docx) builder without a template: headings, paragraphs and two-column tables. Used for the
// suitability declaration (T2) and staff profiles (T7).
import { strToU8, zipSync } from "fflate";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const absatz = (text: string, o: { fett?: boolean; groesse?: number; abstand?: number; grau?: boolean } = {}) =>
  `<w:p>${o.abstand !== undefined ? `<w:pPr><w:spacing w:after="${o.abstand}"/></w:pPr>` : ""}${text.split("\n").map((t, i) => `${i ? "<w:r><w:br/></w:r>" : ""}<w:r><w:rPr>${o.fett ? "<w:b/>" : ""}${o.grau ? '<w:color w:val="666666"/>' : ""}${o.groesse ? `<w:sz w:val="${o.groesse}"/>` : ""}</w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`).join("")}</w:p>`;
export const ueberschrift = (text: string, groesse = 26) => absatz(text, { fett: true, groesse, abstand: 120 });

const zelle = (text: string, breite: number, kopf = false) =>
  `<w:tc><w:tcPr><w:tcW w:w="${breite}" w:type="dxa"/>${kopf ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF3"/>' : ""}</w:tcPr>${absatz(text || " ", { fett: kopf, groesse: 20 })}</w:tc>`;
/** Table with fixed column widths (twentieths of a point); the first row can be a header. */
export function tabelle(zeilen: string[][], breiten: number[], kopf = false): string {
  const rand = "<w:tblBorders>" + ["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join("") + "</w:tblBorders>";
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${rand}<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${breiten.map((b) => `<w:gridCol w:w="${b}"/>`).join("")}</w:tblGrid>`
    + zeilen.map((z, i) => `<w:tr><w:trPr><w:cantSplit/>${kopf && i === 0 ? "<w:tblHeader/>" : ""}</w:trPr>${z.map((t, j) => zelle(t, breiten[j] ?? 2000, kopf && i === 0)).join("")}</w:tr>`).join("") + "</w:tbl>" + absatz("", { abstand: 120 });
}

/** A4 portrait document from body XML. */
export function wordDokument(body: string): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1100" w:right="1100" w:bottom="1100" w:left="1100" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr></w:body></w:document>`),
  });
}

export function wordAntwort(daten: Uint8Array, dateiname: string, cookies: string[] = []): Response {
  const headers = new Headers({ "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(dateiname)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(daten, { headers });
}
