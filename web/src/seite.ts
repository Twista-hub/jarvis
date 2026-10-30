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
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
  header { color: var(--muted); font-size: 14px; margin-bottom: 8px; }
  h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 16px; }
  h2 { font-size: 1.2rem; margin: 28px 0 8px; }
  a { color: var(--accent); }
  form { display: grid; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
  label { display: grid; gap: 6px; font-weight: 600; }
  textarea { min-height: 7em; }
  fieldset { border: 1px solid var(--line); border-radius: 8px; display: grid; gap: 10px; }
  .zeile { display: flex; gap: 8px; align-items: center; font-weight: 600; }
  .zeile input { width: auto; }
  input, select, textarea { font: inherit; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--text); width: 100%; }
  button { font: inherit; font-weight: 600; padding: 12px; border: 0; border-radius: 8px; background: var(--accent); color: var(--bg); cursor: pointer; }
  .knopf { display: block; text-align: center; font-weight: 700; font-size: 1.1rem; padding: 14px; border-radius: 10px; background: var(--accent); color: var(--bg); text-decoration: none; }
  .fehler { color: var(--error); font-weight: 600; }
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
  .konto-zurueck a { text-decoration: none; font-weight: 650; }
  .konto-linkliste, .fristen-liste { list-style: none; margin: 12px 0; padding: 0; }
  .konto-linkliste li, .fristen-liste li { display: grid; gap: 3px; padding: 14px 4px; border-bottom: 1px solid var(--line); }
  .fristen-liste time { font-weight: 700; }
  .konto-nav { display: none; }
  .reiter { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
  .reiter a { padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; text-decoration: none; }
  [aria-current="page"] { font-weight: 750; color: var(--accent) !important; }
  .frist-bald { color: var(--error); }
  @media (max-width: 600px) {
    main { padding-bottom: 104px; }
    .konto-kacheln { grid-template-columns: 1fr; gap: 10px; }
    .konto-kachel { min-height: 126px; }
    .konto-nav { position: fixed; z-index: 10; display: grid; grid-template-columns: repeat(4, 1fr); left: 0; right: 0; bottom: 0; padding: 8px 4px max(8px, env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--card); box-shadow: 0 -3px 12px #00000012; }
    .konto-nav a { display: grid; justify-items: center; gap: 1px; padding: 4px 0; color: var(--text); text-decoration: none; font-size: 1.2rem; }
    .konto-nav span { font-size: 11px; line-height: 1.2; }
  }
</style>
</head>
<body><main>
<header><a href="/">Jarvis</a> · Ausschreibungs-Alarm · <a href="/konto">Konto</a></header>
${kontoBereich ? `<p class="konto-zurueck"><a href="/konto">← Zurück</a></p>` : ""}
${inhalt.trimStart().startsWith("<h1") ? "" : `<h1>${escape(titel)}</h1>`}
${inhalt.replace(/<table>/g, '<div class="tabelle"><table>').replace(/<\/table>/g, "</table></div>")}
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

/** Model output may contain text from the documents: escape all HTML, allow only http(s) links. */
export function markdown(md: string): string {
  const safe = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return marked.parse(safe, {
    async: false,
    walkTokens(token) {
      if (token.type === "link" && !/^https?:\/\//i.test(token.href)) token.href = "#";
    },
  }) as string;
}
