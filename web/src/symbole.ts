// Line icons (24px grid, stroke 1.7, currentColor) for tiles and navigation: one visual language instead of emojis,
// which look different on every phone. seite() swaps the emoji in <span class="konto-icon"> for the matching icon.
const PFADE: Record<string, string> = {
  dokument: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  uhr: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  eingang: '<path d="M4 13l2.5-7h11L20 13v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  stift: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  haken: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  rechner: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 0 1 5 5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
  globus: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  lupe: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  kran: '<path d="M4 21h16M6 21V7l6-4 6 4M6 7h12M15 7v6"/><path d="M15 13v2"/>',
  ziel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  waage: '<path d="M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>',
  senden: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  haus: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  zahnrad: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  kalender: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  sonne: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  balken: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pfeile: '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
  post: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  tuer: '<path d="M5 21V4a1 1 0 0 1 1-1h9l4 3v15M3 21h18"/><circle cx="13" cy="12" r=".8"/>',
  sanduhr: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  liste: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  weste: '<path d="M8 3l-4 3v15h6V9M16 3l4 3v15h-6V9M8 3l4 4 4-4"/>',
  stern: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  handy: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  kurve: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  stoppuhr: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  beleg: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  geld: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  gebaeude: '<path d="M4 21V5l8-2v18M12 7h8v14M2 21h20M8 9h.01M8 13h.01M8 17h.01M16 11h.01M16 15h.01"/>',
  schild: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  saeule: '<path d="M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8"/>',
  kompass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  transporter: '<path d="M2 17V7h11v10M13 10h4l4 4v3h-8"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  schloss: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-7a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 15.5L3 12a1.5 1.5 0 0 1 2.6-1.3L8 13"/>',
  pfeil: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  funke: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
};

/** Emoji used so far in tiles and navigation → icon name. */
const EMOJI: Record<string, string> = {
  "📋": "dokument", "⏰": "uhr", "📌": "pin", "📥": "eingang", "📝": "stift", "✅": "haken", "💶": "rechner", "👥": "team",
  "🌐": "globus", "🔎": "lupe", "🔍": "lupe", "🏗️": "kran", "🎯": "ziel", "⚖️": "waage", "📨": "senden", "🙋": "hand", "🏠": "haus",
  "⚙️": "zahnrad", "📅": "kalender", "🗓️": "kalender", "🌴": "sonne", "📊": "balken", "🔁": "pfeile", "🚪": "tuer", "⏳": "sanduhr",
  "🦺": "weste", "⭐": "stern", "📲": "handy", "📈": "kurve", "⏱️": "stoppuhr", "🧾": "beleg", "🏢": "gebaeude", "🛡️": "schild",
  "🏛️": "saeule", "🧭": "kompass", "🚐": "transporter", "🔐": "schloss", "👤": "person", "📍": "pin", "💼": "dokument",
};

export function symbol(name: string, klasse = "symbol"): string {
  const p = PFADE[name];
  return p ? `<svg class="${klasse}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>` : "";
}

/** Icon for an emoji, or the emoji itself when there is no matching icon. */
export function symbolFuer(emoji: string): string {
  const name = EMOJI[emoji.trim()] ?? EMOJI[emoji.trim().replace(/️/g, "")];
  return name ? symbol(name) : emoji;
}

/** Swaps the emoji inside every tile icon span for the line icon. */
export function symboleEinsetzen(html: string): string {
  return html.replace(/<span class="konto-icon" aria-hidden="true">([^<]{1,8})<\/span>/g, (_, e: string) => `<span class="konto-icon" aria-hidden="true">${symbolFuer(e)}</span>`);
}
