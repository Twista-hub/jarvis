import { marked } from "marked";

// Page frame: plain HTML (the only script is /app.js, see app.ts), readable on a phone, light and dark.

export function seite(titel: string, inhalt: string, neuLadenSekunden = 0, kontoBereich?: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${neuLadenSekunden ? `<meta http-equiv="refresh" content="${neuLadenSekunden}">` : ""}
<title>${escape(titel)} · Jarvis</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-192.png">
<meta name="theme-color" content="#1f5f8b">
<script src="/app.js" defer></script>
<style>
  :root { --bg: #f7f7f5; --text: #1d1d1b; --muted: #66665f; --card: #fff; --line: #ddddd6; --accent: #1f5f8b; --error: #a8321f; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #161615; --text: #ececea; --muted: #a3a39c; --card: #20201e; --line: #3a3a36; --accent: #7cb6e0; --error: #f0907c; }
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; overflow-wrap: anywhere; }
  header { color: var(--muted); font-size: 14px; margin-bottom: 8px; }
  .konto-kopf { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
  .konto-marke { text-decoration: none; font-size: 1.1rem; font-weight: 750; }
  .konto-aktionen { display: flex; align-items: center; gap: 10px; }
  .profil-icon { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border: 1px solid var(--line); border-radius: 50%; background: var(--card); }
  .profil-icon svg { width: 24px; height: 24px; }
  h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 16px; }
  h2 { font-size: 1.2rem; margin: 28px 0 8px; }
  a { color: var(--accent); }
  a:focus-visible, button:focus-visible, summary:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  form { min-width: 0; display: grid; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
  label { min-width: 0; display: grid; gap: 6px; font-weight: 600; }
  textarea { min-height: 7em; resize: vertical; }
  .mitarbeiter-liste { display: grid; gap: 14px; margin-bottom: 24px; }
  .mitarbeiter-liste h3 { margin-top: 0; }
  fieldset { min-width: 0; border: 1px solid var(--line); border-radius: 8px; display: grid; gap: 10px; }
  .zeile { display: flex; gap: 8px; align-items: center; font-weight: 600; }
  .zeile input { width: auto; }
  input, select, textarea { min-width: 0; max-width: 100%; font: inherit; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--text); width: 100%; }
  button { font: inherit; font-weight: 600; padding: 12px; border: 0; border-radius: 8px; background: var(--accent); color: var(--bg); cursor: pointer; }
  button, input, select { min-height: 44px; }
  input[type="checkbox"], input[type="radio"] { width: 22px; height: 22px; min-height: 22px; flex: 0 0 22px; accent-color: var(--accent); }
  .knopf { display: block; text-align: center; font-weight: 700; font-size: 1.1rem; padding: 14px; border-radius: 10px; background: var(--accent); color: var(--bg); text-decoration: none; }
  .hilfe { margin: 4px 0; max-width: 100%; }
  .hilfe[open] { border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
  .hilfe summary { display: flex; align-items: center; justify-content: center; width: 44px; min-height: 44px; cursor: pointer; color: var(--accent); list-style: none; }
  .hilfe summary::-webkit-details-marker { display: none; }
  .hilfe p { margin: 0; padding: 0 12px 12px; color: var(--muted); font-size: 14px; }
  .fehler { color: var(--error); font-weight: 600; }
  .laedt { display: flex; gap: 12px; align-items: flex-start; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
  .kreisel { flex-shrink: 0; width: 24px; height: 24px; margin-top: 2px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: kreisen 0.9s linear infinite; }
  @keyframes kreisen { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .kreisel { animation-duration: 3s; } }
  .klein { color: var(--muted); font-size: 14px; }
  .tabelle { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 15px; }
  th, td { border: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: var(--card); }
  .konto-kacheln { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 18px 0 36px; }
  .konto-kachel { position: relative; display: flex; flex-direction: column; min-height: 156px; gap: 7px; padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); color: var(--text); text-decoration: none; box-shadow: 0 2px 8px #0000000a; }
  .konto-kachel:hover, .konto-kachel:focus-visible { border-color: var(--accent); outline-color: var(--accent); }
  .konto-icon { font-size: 2rem; }
  .konto-kachel strong { font-size: 1.12rem; }
  .konto-pfeil { position: absolute; right: 16px; top: 18px; font-size: 1.5rem; color: var(--accent); }
  .konto-zurueck { margin: 0 0 10px; }
  .konto-zurueck a { display: inline-grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 50%; background: var(--card); text-decoration: none; font-size: 24px; }
  .standort-kacheln { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important; gap: 10px !important; margin: 10px 0 24px !important; }
  .standort-kacheln .konto-kachel { min-height: 0 !important; padding: 14px 30px 14px 14px; gap: 4px; }
  .standort-kacheln .konto-icon { font-size: 1.4rem; }
  .standort-kacheln strong { font-size: 1rem; }
  .standort-kacheln .konto-pfeil { top: 12px; right: 12px; }
  .einsatz-liste { list-style: none; margin: 10px 0; padding: 0; display: grid; gap: 8px; }
  .einsatz-zeile { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .einsatz-zeile > div:first-child { display: grid; gap: 2px; }
  .einsatz-status, .einsatz-zeile form { padding: 0; border: 0; background: none; }
  .einsatz-zeile .person-aktionen { align-items: center; }
  .einsatz-zeile .knopf-leise { padding: 8px 12px; }
  .einsatz-kurz { margin: 0; padding-left: 0; list-style: none; font-size: 14px; display: grid; gap: 2px; }
  .einplanen { margin-top: 10px; }
  @media (min-width: 601px) { .einsatz-zeile { grid-template-columns: 1fr auto auto; align-items: center; } }
  .personal-liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin: 14px 0 20px; }
  .person-karte { min-width: 0; display: grid; gap: 8px; align-content: start; padding: 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); box-shadow: 0 2px 8px #0000000a; }
  .person-karte h3 { margin: 0; font-size: 1.05rem; }
  .person-karte p { margin: 0; }
  .person-kopf { display: flex; gap: 12px; align-items: center; }
  .person-kopf > div { flex: 1; min-width: 0; }
  .person-avatar { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; background: var(--accent); color: var(--bg); font-weight: 700; }
  .stift { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border: 1px solid var(--line); border-radius: 50%; text-decoration: none; background: var(--bg); }
  .status { font-size: 13px; color: var(--muted); }
  .marke { display: inline-block; margin: 0 6px 6px 0; padding: 3px 10px; border-radius: 999px; background: var(--bg); border: 1px solid var(--line); font-size: 13px; }
  .person-aktionen { display: flex; flex-wrap: wrap; gap: 8px; }
  .person-aktionen.gross { margin: 16px 0; }
  .knopf-klein { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 8px 14px; border: 1px solid var(--accent); border-radius: 999px; color: var(--accent); text-decoration: none; font-weight: 600; font-size: 14px; }
  .knopf-leise { background: transparent; color: var(--error); border: 1px solid var(--line); }
  .knopf.whatsapp { background: #1f8f4e; color: #fff; padding: 12px 18px; }
  .bearbeiten summary, .neu-person summary { cursor: pointer; font-weight: 600; color: var(--accent); }
  .neu-person { margin: 16px 0; }
  .qualifikationen-verwalten { margin: 20px 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .qualifikationen-verwalten > summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--accent); font-weight: 650; }
  .qualifikationen-verwalten ul { padding-left: 20px; }
  .inline-form { display: inline-flex; margin-left: 8px; padding: 0; border: 0; background: transparent; vertical-align: middle; }
  .standort-leitung { padding: 10px 14px; border-left: 4px solid var(--accent); border-radius: 8px; background: var(--card); }
  .zwei { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
  .filter-leiste { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; padding: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
  .chips label { display: inline-flex; font-weight: 500; }
  .chips input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .chips span { display: inline-flex; align-items: center; min-height: 44px; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); font-size: 14px; cursor: pointer; }
  .chips input:checked + span { background: var(--accent); border-color: var(--accent); color: var(--bg); }
  .chips input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
  details > summary { cursor: pointer; }
  .auswahl-liste { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 8px; }
  .auswahl-liste a { position: relative; display: grid; gap: 4px; padding: 12px 36px 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: var(--text); text-decoration: none; }
  .auswahl-liste a:hover, .auswahl-liste a:focus-visible { border-color: var(--accent); }
  .auswahl-liste strong { font-size: 0.95rem; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .auswahl-liste .konto-pfeil { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 1.4rem; }
  .konto-linkliste, .fristen-liste { list-style: none; margin: 12px 0; padding: 0; }
  .konto-linkliste li, .fristen-liste li { display: grid; gap: 3px; padding: 14px 4px; border-bottom: 1px solid var(--line); }
  .fristen-liste time { font-weight: 700; }
  .konto-nav { display: none; }
  .reiter { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; padding: 5px; margin: 22px 0; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
  .reiter a { display: grid; place-items: center; min-height: 44px; padding: 10px 6px; border-radius: 11px; text-decoration: none; color: var(--muted); font-size: 14px; font-weight: 600; text-align: center; }
  .reiter a[aria-current="page"] { background: var(--accent); color: var(--bg) !important; box-shadow: 0 2px 5px #00000012; }
  [aria-current="page"] { font-weight: 750; color: var(--accent) !important; }
  .treffer-filter { grid-template-columns: minmax(0, 1fr) auto; align-items: end; margin-bottom: 18px; padding: 0; border: 0; background: none; }
  .treffer-filter label { min-width: 0; font-size: 14px; color: var(--muted); }
  .treffer-filter select { min-width: 0; background: var(--card); color: var(--text); }
  .treffer-filter button { min-height: 46px; font-size: 14px; }
  .treffer-liste { display: grid; gap: 16px; list-style: none; padding: 0; margin: 0 0 28px; }
  .treffer-liste > li { min-width: 0; }
  .treffer-karte { min-width: 0; padding: 20px; border: 1px solid var(--line); border-radius: 18px; background: var(--card); box-shadow: 0 3px 12px #00000005; overflow-wrap: anywhere; }
  .treffer-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 12px; }
  .treffer-punkte { padding: 5px 9px; border-radius: 7px; color: var(--accent); background: var(--bg); font-weight: 750; }
  .treffer-status { color: var(--muted); }
  .treffer-karte h2 { margin: 16px 0 8px; font-size: 1.12rem; line-height: 1.45; }
  .treffer-karte h2 a { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; color: var(--text); text-decoration: none; }
  .treffer-karte h2 a:hover { color: var(--accent); }
  .treffer-karte h2 a > span:last-child { color: var(--accent); }
  .treffer-bereich { margin: 0; color: var(--muted); font-size: 14px; }
  .treffer-frist { display: grid; gap: 2px; margin: 18px 0; font-size: 15px; }
  .treffer-frist > span { color: var(--muted); font-size: 12px; }
  .treffer-frist time { font-weight: 650; }
  .treffer-stand { border-top: 1px solid var(--line); }
  .treffer-stand summary { padding: 12px 0 0; font-size: 14px; color: var(--accent); font-weight: 650; cursor: pointer; min-height: 44px; }
  .treffer-stand form { grid-template-columns: minmax(0, 1fr) auto; align-items: end; padding: 14px 0 0; border: 0; }
  .treffer-stand label { min-width: 0; font-size: 13px; }
  .treffer-stand select { min-width: 0; max-width: 100%; font-size: 14px; }
  .treffer-stand button { min-height: 44px; font-size: 14px; }
  .treffer-leer { padding: 28px 20px; border: 1px dashed var(--line); border-radius: 18px; text-align: center; color: var(--muted); }
  .treffer-leer h2 { margin-top: 0; color: var(--text); }
  .frist-bald { color: var(--error); }
  .aktionsleiste { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin: 0 0 16px; }
  .aktionsleiste a { display: grid; place-items: center; min-height: 52px; padding: 8px; border-radius: 10px; background: var(--accent); color: var(--bg); text-decoration: none; text-align: center; font-weight: 650; font-size: 14px; line-height: 1.3; }
  .aktionsleiste a.zweit { background: var(--card); color: var(--accent); border: 1px solid var(--line); }
  details.nachweis-fehlt { display: inline; }
  details.nachweis-fehlt summary { display: inline; cursor: pointer; list-style: none; }
  details.nachweis-fehlt summary::-webkit-details-marker { display: none; }
  .nachweis-popup { display: block; margin: 6px 0; padding: 10px 12px; border: 1px solid var(--error); border-radius: 10px; background: var(--card); font-size: 14px; font-weight: 400; }
  @media (max-width: 420px) {
    .reiter { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .treffer-karte { padding: 16px; }
    .treffer-stand form { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 600px) {
    main { padding-bottom: 104px; }
    form { gap: 12px; padding: 14px; border-radius: 14px; }
    .konto-kopf { margin-bottom: 14px; }
    .aktionsleiste a { min-height: 56px; }
    /* Tables become stacked cards on the phone: no sideways scrolling. */
    table.stapel, table.stapel tbody, table.stapel tr, table.stapel td { display: block; width: 100%; }
    table.stapel thead { display: none; }
    table.stapel tr { margin: 0 0 10px; padding: 6px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
    table.stapel td { border: 0; padding: 4px 0; }
    table.stapel td[data-label]::before { content: attr(data-label) ": "; color: var(--muted); font-weight: 650; }
    .konto-kacheln { grid-template-columns: 1fr; gap: 10px; }
    .konto-kachel { min-height: 126px; }
    .konto-nav { position: fixed; z-index: 10; display: grid; grid-template-columns: repeat(4, 1fr); left: 0; right: 0; bottom: 0; padding: 8px 4px max(8px, env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--card); box-shadow: 0 -3px 12px #00000012; }
    .konto-nav a { display: grid; justify-items: center; gap: 1px; padding: 4px 0; color: var(--text); text-decoration: none; font-size: 1.2rem; }
    .konto-nav span { font-size: 11px; line-height: 1.2; }
  }
  @media (max-width: 380px) {
    main { padding-right: 12px; padding-left: 12px; }
    .konto-kacheln { gap: 8px; }
    .konto-zurueck a, .profil-icon { width: 44px; height: 44px; }
  }
</style>
</head>
<body><main>
${kontoBereich !== undefined ? `<header class="konto-kopf"><a class="konto-marke" href="/konto">Jarvis</a><div class="konto-aktionen"><a class="profil-icon" href="/konto/profil" aria-label="Mein Profil" title="Mein Profil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></a></div></header>` : `<header><a href="/">Jarvis</a> · Ausschreibungs-Alarm · <a href="/konto">Konto</a></header>`}
${kontoBereich ? `<p class="konto-zurueck"><a href="/konto" aria-label="Zur Übersicht" title="Zur Übersicht"><span aria-hidden="true">←</span></a></p>` : ""}
${inhalt.trimStart().startsWith("<h1") ? "" : `<h1>${escape(titel)}</h1>`}
${inhalt.replace(/<table(\s[^>]*)?>/g, '<div class="tabelle"><table$1>').replace(/<\/table>/g, "</table></div>")}
<p class="klein">WP Digital Ranger · <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a> · <a href="/nutzungsbedingungen">Nutzungsbedingungen</a> · <a href="/avv">Auftragsverarbeitung</a></p>
</main>${kontoBereich !== undefined ? kontoNavigation(kontoBereich) : ""}</body>
</html>`;
}

export function kontoNavigation(aktiv: string): string {
  return `<nav class="konto-nav" aria-label="Konto-Navigation">${[["", "🏠", "Übersicht"], ["treffer", "🔎", "Treffer"], ["fristen", "⏰", "Fristen"], ["einstellungen", "⚙️", "Mehr"]].map(([pfad, icon, text]) => `<a href="/konto${pfad ? `/${pfad}` : ""}"${aktiv === pfad ? ' aria-current="page"' : ""}><span aria-hidden="true">${icon}</span><span>${text}</span></a>`).join("")}</nav>`;
}

export function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Small, collapsed plain-language explanation for a screen or action. */
export function hilfe(titel: string, text: string): string {
  return `<details class="hilfe"><summary aria-label="${escape(titel)}" title="${escape(titel)}"><span aria-hidden="true">ℹ️</span></summary><p>${escape(text)}</p></details>`;
}

/** Model output may contain text from the documents: escape all HTML, allow only http(s) links. */
export function markdown(md: string): string {
  const safe = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return stapeln(marked.parse(safe, {
    async: false,
    walkTokens(token) {
      if (token.type === "link" && !/^https?:\/\//i.test(token.href)) token.href = "#";
    },
  }) as string);
}

/** Gives each table cell its column heading (data-label), so the phone can show rows as stacked cards. */
export function stapeln(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (_t, inner: string) => {
    const kopf = [...(inner.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? "").matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
    const rumpf = inner.replace(/<tr>([\s\S]*?)<\/tr>/g, (_r, zellen: string) => {
      let i = 0;
      return `<tr>${zellen.replace(/<td([^>]*)>/g, (m, a: string) => (kopf[i] ? `<td${a} data-label="${kopf[i++].replace(/"/g, "&quot;")}">` : (i++, m)))}</tr>`;
    });
    return `<table class="stapel">${rumpf}</table>`;
  });
}
