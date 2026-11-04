// Line icons instead of emojis on tiles and in the bottom bar (Benjamin 04.11.2026: calmer, more serious look).
// One stroke style (24×24, round caps, currentColor) so the icons follow each theme's colours.
const P: Record<string, string> = {
  dokument: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  klemmbrett: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  uhr: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  stoppuhr: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5"/>',
  eingang: '<path d="M4 13.5 6.5 5h11l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20"/>',
  stift: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/><path d="m17.5 3.5 3 3L13 14l-3.5.5.5-3.5z"/>',
  euro: '<path d="M17.5 6.5A7 7 0 1 0 17.5 17.5"/><path d="M4 10.5h9M4 13.5h9"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 5.8"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  welt: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  suche: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  gebaeude: '<path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5V21M14 10h4.5A1.5 1.5 0 0 1 20 11.5V21M2.5 21h19"/><path d="M7.5 8h3M7.5 12h3M7.5 16h3"/>',
  ziel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  waage: '<path d="M12 4v16M7 20h10M5 7h14M12 4.5 5 7M12 4.5 19 7"/><path d="m5 7-2.5 6a2.5 2 0 0 0 5 0zM19 7l-2.5 6a2.5 2 0 0 0 5 0z"/>',
  haken: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="m8 12.5 2.5 2.5 5.5-6"/>',
  sprechblase: '<path d="M20 12a7.5 7 0 0 1-11 6.2L4 19.5l1.3-4A7 7 0 1 1 20 12z"/>',
  pinn: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7"/>',
  brief: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  kalender: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  sonne: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  balken: '<path d="M4 20h16M7 17v-5M12 17V7M17 17v-8"/>',
  kreislauf: '<path d="M4 10a8 8 0 0 1 14-4l2 2M20 14a8 8 0 0 1-14 4l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/>',
  tuer: '<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h8A1.5 1.5 0 0 1 16 4.5V21M3 21h18M16 6h3v15"/><circle cx="12.5" cy="12" r=".9"/>',
  sanduhr: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
  weste: '<path d="M8 3 5 6v14h5v-6h4v6h5V6l-3-3-2 4h-4z"/><path d="M5 12h5M14 12h5"/>',
  stern: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8z"/>',
  handy: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  kurve: '<path d="M3.5 17 9 11.5l4 4 7.5-8"/><path d="M15.5 7.5h5v5"/>',
  beleg: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  kamera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
  rechner: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15v2.5M8.5 18h.01M12 18h.01"/>',
  kette: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  schild: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  saeulen: '<path d="M3 21h18M4.5 18h15M5 10h14M12 3 4 7.5h16zM7 10v8M12 10v8M17 10v8"/>',
  kompass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  transporter: '<path d="M2.5 16.5V7A1.5 1.5 0 0 1 4 5.5h10V16.5M14 9h3.5l3.5 4v3.5h-2"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/><path d="M9 17.5h6"/>',
  schloss: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  pfeil: '<path d="m9 5 7 7-7 7"/>',
  haus: '<path d="M4 11 12 4l8 7v8.5a1 1 0 0 1-1 1h-4.5V15h-5v5.5H5a1 1 0 0 1-1-1z"/>',
  glocke: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  raster: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  zahnrad: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
};

/** Emoji used on tiles → icon name. Unknown emojis stay as they are. */
const EMOJI: Record<string, string> = {
  "📋": "klemmbrett", "⏰": "uhr", "📥": "eingang", "📝": "stift", "💶": "euro", "👥": "team", "🌐": "welt", "🔎": "suche", "🔍": "suche",
  "🏗️": "gebaeude", "🏗": "gebaeude", "🎯": "ziel", "⚖️": "waage", "⚖": "waage", "✅": "haken", "🙋": "person", "💬": "sprechblase", "📌": "pinn",
  "📨": "brief", "📅": "kalender", "🗓️": "kalender", "🗓": "kalender", "🌴": "sonne", "📊": "balken", "🔁": "kreislauf", "🚪": "tuer", "⏳": "sanduhr",
  "🦺": "weste", "⭐": "stern", "📲": "handy", "📈": "kurve", "⏱️": "stoppuhr", "⏱": "stoppuhr", "🧾": "beleg", "📸": "kamera", "🧮": "rechner",
  "🏢": "gebaeude", "🔗": "kette", "🛡️": "schild", "🛡": "schild", "🏛️": "saeulen", "🏛": "saeulen", "🧭": "kompass", "🚐": "transporter", "🔐": "schloss",
  "🏠": "haus", "⚙️": "zahnrad", "⚙": "zahnrad",
};

export function symbol(name: string, groesse = 24): string {
  const p = P[name];
  return p ? `<svg class="symbol-svg" viewBox="0 0 24 24" width="${groesse}" height="${groesse}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>` : "";
}

/** Tile icons: emoji spans become line icons where we have one. */
export function kachelSymbole(html: string): string {
  return html.replace(/<span class="konto-icon" aria-hidden="true">([^<]{1,8})<\/span>/g, (ganz, e: string) => {
    const name = EMOJI[e.trim()];
    return name ? `<span class="konto-icon konto-symbol" aria-hidden="true">${symbol(name, 22)}</span>` : ganz;
  });
}
