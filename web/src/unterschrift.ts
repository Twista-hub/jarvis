// T39: signatures drawn on the phone. The browser sends a PNG as data URL; Jarvis checks it and keeps it in R2.
import { escape } from "./seite.ts";

/** PNG from a data URL; null when it is not a small, real PNG (max. 300 KB). */
export function pngAusDataUrl(wert: string): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(wert.trim());
  if (!m || m[1].length > 400_000) return null;
  let bin: string;
  try { bin = atob(m[1]); } catch { return null; }
  const b = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return b.length > 100 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? b : null;
}

/** Drawing field; `pflicht` refuses sending without a signature (except buttons with data-ohne-unterschrift). */
export const unterschriftFeld = (name: string, o: { pflicht?: boolean; text?: string } = {}) =>
  `<div class="unterschrift-feld"><span class="klein">${escape(o.text ?? "Mit dem Finger unterschreiben")}</span><canvas data-unterschrift="${name}"${o.pflicht ? " data-pflicht" : ""} width="600" height="240" aria-label="Unterschriftsfeld"></canvas><input type="hidden" name="${name}"><button type="button" class="zweit" data-unterschrift-leeren>Leeren</button></div>`;

export const schluessel = { person: (firma: string, id: string) => `unterschriften/${firma}/${id}.png`, kunde: (firma: string, id: string) => `nachweis/${firma}/${id}.png` };
