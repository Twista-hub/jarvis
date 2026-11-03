import { marked } from "marked";

// Page frame: plain HTML (the only script is /app.js, see app.ts), readable on a phone, light and dark.

export const ZEICHEN = `<svg viewBox="-540 -540 1080 1080" aria-hidden="true"><rect x="-540" y="-540" width="1080" height="1080" rx="250" fill="#15324b"/><circle r="300" fill="none" stroke="#fff" stroke-width="88" stroke-linecap="round" stroke-dasharray="1450 1885" transform="rotate(40)"/><circle r="300" fill="none" stroke="#ff6b35" stroke-width="88" stroke-linecap="round" stroke-dasharray="1 1884" transform="rotate(40)"/><path d="M-115 5 L-30 90 L130 -85" fill="none" stroke="#ff6b35" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/><circle cx="-130" cy="-120" r="34" fill="#168aad"/><circle cx="-30" cy="-160" r="34" fill="#168aad"/></svg>`;

export function seite(titel: string, inhalt: string, neuLadenSekunden = 0, kontoBereich?: string): string {
  // Collect only the controlled markup emitted by hilfe(), after access checks have built this page.
  // One icon next to the title replaces separate rows for every contextual explanation.
  const hinweise: string[] = [];
  inhalt = inhalt.replace(/<details class="hilfe"><summary aria-label="([^"]*)" title="[^"]*"><span aria-hidden="true">ℹ️<\/span><\/summary><p>([\s\S]*?)<\/p><\/details>/g, (_block, name, text) => {
    hinweise.push(`<p><strong>${name}</strong><br>${text}</p>`);
    return "";
  });
  const info = hinweise.length ? `<details class="seiten-hilfe"><summary aria-label="Hinweise zu ${escape(titel)}" title="Hinweise"><span aria-hidden="true">ℹ️</span></summary><div class="hilfe-inhalt">${hinweise.join("")}</div></details>` : "";
  const titelzeile = (h: string) => `<div class="seiten-titel">${h}${info}</div>`;
  // A page may bring its own back link (e.g. back to "Firma & Team"); then it replaces the default one.
  const eigenerZurueck = inhalt.trimStart().match(/^<p class="konto-zurueck">[\s\S]*?<\/p>/)?.[0] ?? "";
  if (eigenerZurueck) inhalt = inhalt.trimStart().slice(eigenerZurueck.length);
  let kopf = titelzeile(`<h1>${escape(titel)}</h1>`);
  // The landing page brings its own hero with the heading inside.
  if (inhalt.trimStart().startsWith('<section class="start-held')) kopf = "";
  else if (inhalt.trimStart().startsWith("<h1")) {
    kopf = "";
    inhalt = inhalt.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/, titelzeile);
  }
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${neuLadenSekunden ? `<meta http-equiv="refresh" content="${neuLadenSekunden}">` : ""}
<title>${escape(titel)} · Crewtender</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-v2-192.png">
<link rel="apple-touch-icon" href="/icon-v2-192.png">
<meta name="theme-color" content="#1f5f8b">
<script src="/app.js" defer></script>
<style>
  :root { --bg: #f7f7f5; --text: #1d1d1b; --muted: #66665f; --card: #fff; --line: #ddddd6; --accent: #1f5f8b; --error: #a8321f; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --bg: #161615; --text: #ececea; --muted: #a3a39c; --card: #20201e; --line: #3a3a36; --accent: #7cb6e0; --error: #f0907c; }
  }
  /* Own choice in the settings (cookie jv_darstellung): dark mode and larger text. */
  :root[data-theme="dark"] { --bg: #161615; --text: #ececea; --muted: #a3a39c; --card: #20201e; --line: #3a3a36; --accent: #7cb6e0; --error: #f0907c; }
  :root[data-schrift="gross"] body { font-size: 18.5px; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; overflow-wrap: anywhere; }
  header { color: var(--muted); font-size: 14px; margin-bottom: 8px; }
  .konto-kopf { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
  .konto-marke { display: inline-flex; align-items: center; gap: 9px; min-width: 0; color: var(--text); text-decoration: none; }
  .konto-marke > svg { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 10px; }
  .konto-marke > span { display: grid; line-height: 1.15; }
  .konto-marke strong { font-size: 1.08rem; }
  .konto-marke small { margin-top: 3px; color: var(--muted); font-size: .68rem; font-weight: 550; }
  .konto-aktionen { display: flex; align-items: center; gap: 10px; }
  .profil-icon { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border: 1px solid var(--line); border-radius: 50%; background: var(--card); }
  .profil-icon svg { width: 24px; height: 24px; }
  h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 16px; }

  .oeffentlich-kopf { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 1rem; }
  .oeffentlich-marke { display: inline-flex; align-items: center; gap: 9px; color: var(--text); text-decoration: none; font-size: 1.12rem; }
  .oeffentlich-marke svg { width: 34px; height: 34px; border-radius: 9px; }
  .oeffentlich-login { padding: 8px 16px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); font-weight: 650; text-decoration: none; }
  /* Public landing page: light blue hero, glass cards, stacked buttons on phones. */
  .start-held { position: relative; margin: 4px -4px 8px; padding: 26px 20px 22px; border-radius: 24px; overflow: hidden;
    background: radial-gradient(120% 90% at 100% 0%, rgba(124,198,240,.55), transparent 60%), radial-gradient(90% 80% at 0% 100%, rgba(22,138,173,.28), transparent 65%), linear-gradient(160deg, #eaf6fd 0%, #d6ecfa 55%, #c4e3f7 100%);
    border: 1px solid rgba(255,255,255,.7); box-shadow: 0 18px 40px -22px rgba(21,50,75,.45), inset 0 1px 0 rgba(255,255,255,.9); color: #15324b; }
  .start-held::after { content: ""; position: absolute; inset: 0 0 auto 0; height: 46%; background: linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0)); pointer-events: none; }
  .start-held > * { position: relative; z-index: 1; }
  .start-marke { display: flex; align-items: center; gap: 10px; margin: 0 0 18px; font-weight: 800; font-size: 1.15rem; letter-spacing: .01em; }
  .start-marke svg { width: 40px; height: 40px; border-radius: 11px; box-shadow: 0 6px 14px -6px rgba(21,50,75,.6); }
  .start-fuer { display: inline-block; margin: 0 0 12px; padding: 5px 12px; border-radius: 999px; background: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.85); font-size: .82rem; font-weight: 650; color: #1f5f8b; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  .start-held h1 { font-size: clamp(1.7rem, 6.4vw, 2.35rem); line-height: 1.15; letter-spacing: -.01em; margin: 0 0 12px; color: #102a40; }
  .start-unter { margin: 0 0 18px; font-size: 1.04rem; color: #2a4a63; }
  .start-knoepfe { display: grid; gap: 10px; }
  @media (min-width: 560px) { .start-knoepfe { grid-template-columns: auto auto; justify-content: start; } }
  .start-knopf { display: block; text-align: center; padding: 15px 22px; border-radius: 14px; font-weight: 750; font-size: 1.06rem; text-decoration: none; color: #fff;
    background: linear-gradient(180deg, #4fb3ea 0%, #2a8fd0 48%, #1f6fa8 100%); border: 1px solid rgba(255,255,255,.45);
    box-shadow: 0 10px 22px -10px rgba(31,95,139,.9), inset 0 1px 0 rgba(255,255,255,.55); }
  .start-knopf:hover { filter: brightness(1.06); }
  .start-knopf.glas { color: #15324b; background: rgba(255,255,255,.55); border: 1px solid rgba(255,255,255,.9); box-shadow: 0 8px 20px -14px rgba(21,50,75,.6), inset 0 1px 0 rgba(255,255,255,.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  .start-klein { margin: 12px 0 0; font-size: .92rem; color: #2a4a63; }
  .start-held a:not(.start-knopf) { color: #1f5f8b; font-weight: 650; }
  .start-chips { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 16px 0 0; padding: 0; list-style: none; font-size: .86rem; font-weight: 600; color: #24506e; }
  .start-h2 { margin: 30px 0 12px; font-size: 1.3rem; }
  .start-raster { display: grid; gap: 12px; }
  @media (min-width: 640px) { .start-raster { grid-template-columns: repeat(3, 1fr); } }
  .start-karte { padding: 16px 16px 12px; border-radius: 18px; background: linear-gradient(180deg, rgba(234,246,253,.9), var(--card)); border: 1px solid var(--line); box-shadow: 0 10px 24px -20px rgba(21,50,75,.5); }
  .start-karte h3 { margin: 8px 0 4px; font-size: 1.04rem; }
  .start-karte p { margin: 0; color: var(--muted); font-size: .95rem; }
  .start-icon { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; font-size: 1.3rem; background: rgba(79,179,234,.18); }
  .start-mehr { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
  .start-mehr li { overflow-wrap: normal; hyphens: auto; -webkit-hyphens: auto; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 14px; background: var(--card); border: 1px solid var(--line); font-size: .9rem; font-weight: 600; line-height: 1.3; }
  .start-mehr li span { flex: 0 0 auto; font-size: 1.1rem; line-height: 1.2; }
  .start-mehr-link { margin: 12px 0 0; font-weight: 700; }
  .start-schluss { margin-top: 30px; }
  .start-schluss h2 { margin: 0 0 8px; color: #102a40; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .start-karte { background: var(--card); } }
  :root[data-theme="dark"] .start-karte { background: var(--card); }

  h2 { font-size: 1.2rem; margin: 28px 0 8px; }
  a { color: var(--accent); }
  a:focus-visible, button:focus-visible, summary:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  form { min-width: 0; display: grid; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
  label { min-width: 0; display: grid; gap: 6px; font-weight: 600; }
  textarea { min-height: 7em; resize: vertical; }
  .mitarbeiter-liste { display: grid; gap: 14px; margin-bottom: 24px; }
  .mitarbeiter-liste h3 { margin-top: 0; }
  fieldset { min-width: 0; border: 1px solid var(--line); border-radius: 8px; display: grid; gap: 10px; }
  button.zweit, a.knopf.zweit { background: var(--card); color: var(--accent); border: 1px solid var(--line); }
  .zeile { display: flex; gap: 8px; align-items: center; font-weight: 600; }
  .zeile input { width: auto; }
  .firmen-erkenntnisse { min-width: 0; border: 1px solid var(--line); border-radius: 14px; background: var(--bg); padding: 4px 14px 14px; }
  .firmen-erkenntnisse > summary { min-height: 48px; padding: 10px 0; font-weight: 700; cursor: pointer; }
  .firmen-fund-karten { display: grid; gap: 12px; margin-top: 8px; }
  .firmen-fund { min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .firmen-fund h3 { color: var(--accent); font-size: 1rem; margin: 0 0 8px; }
  .firmen-fund p { margin: 0 0 10px; }
  .firmen-fund-text { white-space: pre-line; line-height: 1.65; }
  .einrichtungs-schritte { display: flex; flex-wrap: wrap; gap: 6px 16px; list-style: none; padding: 0; margin: 0 0 20px; color: var(--muted); font-size: .85rem; }
  .einrichtungs-schritte [aria-current] { color: var(--accent); font-weight: 600; }
  .firmenpruefung { border: 1px solid var(--line); border-radius: 14px; background: var(--card); padding: 18px; }
  .firmenpruefung h2 { margin-top: 0; }
  .firmenpruefung form { border: 0; padding: 0; }
  .firmen-standorte { grid-column: 1 / -1; }
  .firmen-standorte ul { list-style: none; padding: 0; margin: 0 0 12px; }
  .firmen-standorte li { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding: 8px 0; font-size: .95rem; }
  .firmen-standorte li a { flex-shrink: 0; font-size: .8rem; }
  .fund-bearbeiten { font-size: .9rem; }
  .fund-bearbeiten > summary { min-height: 44px; padding: 10px 0; color: var(--accent); cursor: pointer; }
  .firmen-quellen { margin-top: 14px; font-size: .88rem; }
  .firmen-quellen ul { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 8px 0 0; }
  .firmen-quellen li { min-width: 0; max-width: 100%; }
  .firmen-quellen a { display: block; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); overflow-wrap: anywhere; }
  .arbeitsauswahl { min-width: 0; display: grid; gap: 12px; border: 1px solid var(--line); border-radius: 12px; padding: 14px; background: var(--bg); }
  .arbeits-chips { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
  .arbeits-chip { display: flex; align-items: stretch; min-width: 0; max-width: 100%; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: var(--card); }
  .arbeits-chip button { background: transparent; color: var(--accent); border-radius: 0; }
  .arbeits-chip-name { min-width: 0; padding: 8px 10px; text-align: left; font-size: .9rem; overflow-wrap: anywhere; }
  .arbeits-chip-entfernen { flex: 0 0 44px; padding: 4px 8px; font-size: 1.3rem; border-left: 1px solid var(--line); }
  .arbeits-editor { display: grid; gap: 10px; }
  .arbeits-editor fieldset { margin: 0; background: var(--card); }
  .arbeit-dropdown { min-width: 0; border: 1px solid var(--line); border-radius: 9px; background: var(--card); }
  .arbeit-dropdown > summary { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; min-height: 44px; cursor: pointer; list-style: none; font-size: 1rem; font-weight: 500; }
  .arbeit-dropdown > summary::-webkit-details-marker { display: none; }
  .arbeit-filtern { padding: 0 12px 10px; font-size: .875rem; font-weight: 400; }
  .arbeit-filtern input { font-size: 1rem; }
  .arbeit-optionen { max-height: 320px; max-height: min(320px, 50dvh); overflow-y: auto; overscroll-behavior: contain; padding: 0 12px 12px; }
  .arbeit-optionen h3 { margin: 12px 0 4px; color: var(--muted); font-size: .8rem; font-weight: 500; text-align: left; }
  .arbeit-optionen button { display: block; width: 100%; margin: 0; padding: 10px 0; min-height: 44px; border-radius: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--text); font-size: 1rem; line-height: 1.4; font-weight: 400; text-align: left; overflow-wrap: anywhere; }
  .arbeit-optionen button:hover, .arbeit-optionen button:focus-visible { color: var(--accent); }
  .arbeit-optionen button:disabled { opacity: .5; cursor: default; }
  .eigene-arbeit { display: grid; gap: 10px; }
  @media (min-width: 640px) { .firmen-fund-karten { grid-template-columns: repeat(2, minmax(0, 1fr)); } .eigene-arbeit { grid-template-columns: minmax(0, 1fr) auto; align-items: end; } }
  input, select, textarea { min-width: 0; max-width: 100%; font: inherit; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--text); width: 100%; }
  button { font: inherit; font-weight: 600; padding: 12px; border: 0; border-radius: 8px; background: var(--accent); color: var(--bg); cursor: pointer; }
  button, input, select { min-height: 44px; }
  input[type="checkbox"], input[type="radio"] { width: 22px; height: 22px; min-height: 22px; flex: 0 0 22px; accent-color: var(--accent); }
  .knopf { display: block; text-align: center; font-weight: 700; font-size: 1.1rem; padding: 14px; border-radius: 10px; background: var(--accent); color: var(--bg); text-decoration: none; }
  .seiten-titel { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .seiten-titel h1 { min-width: 0; }
  .seiten-hilfe { flex: 0 0 44px; align-self: center; }
  .seiten-hilfe summary { display: flex; align-items: center; justify-content: center; width: 44px; min-height: 44px; cursor: pointer; color: var(--accent); list-style: none; border-radius: 8px; }
  .seiten-hilfe summary::-webkit-details-marker { display: none; }
  .hilfe-inhalt { position: absolute; top: 100%; right: 0; z-index: 20; width: min(360px, 100%); max-height: 55vh; overflow-y: auto; border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: var(--card); box-shadow: 0 4px 16px #0002; }
  .hilfe-inhalt p { margin: 0 0 12px; color: var(--muted); font-size: 14px; }
  .hilfe-inhalt p:last-child { margin-bottom: 0; }
  .fehler { color: var(--error); font-weight: 600; }
  .neu-person > summary { display: flex; align-items: center; justify-content: space-between; min-height: 44px; cursor: pointer; list-style: none; }
  .neu-person > summary::-webkit-details-marker { display: none; }
  .qualifikationen-dropdown > summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; cursor: pointer; list-style: none; }
  .qualifikationen-dropdown > summary::-webkit-details-marker { display: none; }
  .qualifikationen-dropdown > summary span { font-size: 24px; }
  .qualifikationen-dropdown[open] > summary span { transform: rotate(90deg); }
  .leitung-zuordnen > summary { min-height: 44px; padding: 8px 0; cursor: pointer; }
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
  /* One compact look for all fold-outs (like the search profile cards): rounded box, small accent title, arrow. */
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown, .firmen-erkenntnisse)) { min-width: 0; margin: 10px 0; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown, .firmen-erkenntnisse))[open] { padding-bottom: 14px; }
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown, .firmen-erkenntnisse)) > summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; padding: 10px 0; list-style: none; color: var(--accent); font-size: .95rem; font-weight: 600; }
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown, .firmen-erkenntnisse)) > summary::-webkit-details-marker { display: none; }
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown, .firmen-erkenntnisse)) > summary::after { content: "›"; flex: 0 0 auto; font-size: 1.35rem; line-height: 1; color: var(--muted); transition: transform .15s; }
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown, .firmen-erkenntnisse))[open] > summary::after { transform: rotate(90deg); }
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown, .firmen-erkenntnisse))[open] > summary { margin-bottom: 6px; border-bottom: 1px solid var(--line); }
  .steckbrief-karte { min-width: 0; padding: 4px 16px 8px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
  .steckbrief-karte h2, .steckbrief-karte h3 { margin: 18px 0 6px; color: var(--accent); font-size: 1.02rem; }
  .steckbrief-karte p { margin: 0 0 10px; }
  /* Forms inside a fold-out are already in a box: no second frame. */
  details > form, details details > form { border: 0; padding: 0; background: transparent; }
  /* Compact selects with their own arrow; long option texts are cut instead of widening the page. */
  select { appearance: none; -webkit-appearance: none; padding: 9px 36px 9px 11px; font-size: .95rem; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%); background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
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
  .treffer-filter { gap: 8px; margin-bottom: 18px; padding: 0; border: 0; background: none; }
  .treffer-filter-zeile { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
  .treffer-filter input, .treffer-filter select { background-color: var(--card); color: var(--text); }
  .unsichtbar { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .treffer-fakten { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0 0 12px; padding: 0; }
  .treffer-fakten li { display: inline-flex; align-items: baseline; gap: 5px; padding: 4px 9px; border-radius: 8px; background: var(--bg); font-size: 13px; font-weight: 600; }
  .treffer-fakten li span { color: var(--muted); font-weight: 500; font-size: 12px; }
  .treffer-gesucht { margin: 0 0 4px; font-weight: 600; }
  .treffer-warum { margin: 0; color: var(--muted); font-size: 14px; }
  .treffer-unten { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin: 16px 0 4px; }
  .treffer-unten .treffer-frist { margin: 0; }
  .treffer-frist small { color: var(--muted); font-size: 12px; }
  .frist-abstand { font-style: normal; font-size: 13px; font-weight: 600; margin-left: 4px; color: var(--muted); } .frist-abstand.frist-rot { color: #c0392b; } .frist-abstand.frist-gelb { color: #b9770e; }
  .daumen-leiste { display: flex; gap: 6px; }
  .daumen-form { display: block; padding: 0; border: 0; background: none; }
  button.daumen { width: 44px; height: 44px; padding: 0; border: 1px solid var(--line); border-radius: 50%; background: var(--card); font-size: 18px; filter: grayscale(1); opacity: .7; }
  button.daumen.gewaehlt { border-color: var(--accent); background: var(--bg); filter: none; opacity: 1; }
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
  .kalender { margin: 8px 0 18px; padding: 8px 12px 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
  .kalender-kopf { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .kalender-kopf a { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; text-decoration: none; font-size: 1.4rem; }
  .kalender-raster { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; text-align: center; font-size: 13px; }
  .kalender-raster .wtag { color: var(--muted); font-size: 11px; padding-bottom: 2px; }
  .kalender-raster .tag { display: grid; place-items: center; width: 32px; height: 32px; margin: 0 auto; border-radius: 50%; color: var(--text); text-decoration: none; }
  .kalender-raster .heute { outline: 2px solid var(--accent); outline-offset: -2px; font-weight: 700; }
  .kalender-raster .mit-frist { color: #fff; font-weight: 700; }
  .mit-frist.rot { background: #c0392b; } .mit-frist.gelb { background: #d68910; } .mit-frist.gruen { background: #2e8b57; } .mit-frist.grau { background: var(--muted); }
  .frist-gruppe { margin: 22px 0 6px; font-size: .95rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .fristen-liste li.frist { gap: 6px; margin-bottom: 8px; padding: 12px 14px; border: 1px solid var(--line); border-left: 5px solid var(--muted); border-radius: 12px; background: var(--card); }
  .fristen-liste li.frist.rot { border-left-color: #c0392b; } .fristen-liste li.frist.gelb { border-left-color: #d68910; } .fristen-liste li.frist.gruen { border-left-color: #2e8b57; }
  .frist-kopf { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
  .frist-abstand { color: var(--muted); font-weight: 600; margin-left: auto; }
  .frist-art { margin-right: 6px; font-weight: 700; color: var(--accent); }
  .frist.rot .frist-abstand { color: #c0392b; }
  .frist-titel { color: var(--text); font-weight: 600; text-decoration: none; }
  .frist-info { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; color: var(--muted); }
  .frist-info .fehlt { padding: 2px 8px; border-radius: 7px; background: var(--bg); color: var(--error); font-weight: 600; }
  .frist-ics { margin-left: auto; font-weight: 600; text-decoration: none; }
  .ablauf-warnung { margin: 0 0 16px; padding: 12px 14px; border: 1px solid #d68910; border-radius: 12px; background: var(--card); }
  .ablauf-warnung ul { list-style: none; margin: 8px 0; padding: 0; }
  .ablauf-warnung li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
  .ablauf-warnung .bald { color: #b9770e; font-weight: 600; } .ablauf-warnung .abgelaufen { color: var(--error); font-weight: 700; }
  .ablauf-warnung a { font-size: 14px; font-weight: 600; }
  .listen-filter { margin: 4px 0 8px; background-color: var(--card); }
  input[type=file] { padding: 18px 12px; border: 2px dashed var(--line); border-radius: 12px; background: var(--bg); cursor: pointer; font-size: .9rem; }
  input[type=file].ziehen, input[type=file]:hover { border-color: var(--accent); background: var(--card); }
  input[type=file]::file-selector-button { margin-right: 10px; padding: 8px 12px; border: 0; border-radius: 8px; background: var(--accent); color: var(--bg); font: inherit; font-weight: 600; cursor: pointer; }
  progress { display: block; width: 100%; height: 6px; margin-top: 8px; accent-color: var(--accent); }
  .check-zahl { margin-left: auto; white-space: nowrap; padding: 2px 8px; border-radius: 7px; background: var(--bg); color: var(--muted); font-size: 12px; font-weight: 600; }
  .live-satz { position: sticky; top: 0; z-index: 5; display: grid; gap: 2px; margin: 0; padding: 12px 14px; border: 1px solid var(--accent); border-radius: 12px; background: var(--card); font-size: 15px; }
  .live-satz strong { font-size: 1.35rem; color: var(--accent); }
  details.kalk-gruppe > summary { flex-wrap: wrap; }
  .kalk-kurz { flex: 1 1 100%; color: var(--muted); font-size: 12px; font-weight: 500; order: 3; }
  .kalk-gruppe label { margin-top: 10px; }
  .tarif-wahl { margin-bottom: 4px; }
  .szenarien { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }
  .szenario { display: grid; gap: 2px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); text-align: center; }
  .szenario span { color: var(--muted); font-size: 12px; font-weight: 600; }
  .szenario strong { font-size: 1.05rem; }
  .szenario small { color: var(--muted); font-size: 11px; }
  .szenario.normal { border-color: var(--accent); }
  .export-leiste { display: flex; flex-wrap: wrap; gap: 8px; }
  .export-leiste > * { flex: 1 1 140px; font-size: .95rem; }
  @media print { .konto-nav, .konto-kopf, form, .export-leiste, footer, details:not([open]) { display: none !important; } body { background: #fff; color: #000; } }
  .standort-liste { display: grid; margin: 8px 0 20px; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: 12px; background: var(--card); overflow: hidden; }
  .standort-zeile { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 10px 14px; border-bottom: 1px solid var(--line); color: var(--text); text-decoration: none; }
  .standort-zeile:last-child { border-bottom: 0; }
  .standort-zeile:hover { background: var(--bg); }
  .standort-icon { font-size: 1.15rem; }
  .standort-text { display: grid; flex: 1; min-width: 0; }
  .standort-text strong { font-size: .98rem; }
  .standort-zeile .konto-pfeil { position: static; color: var(--accent); font-size: 1.3rem; }
  .rechte-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 4px; padding: 0; list-style: none; }
  .rechte-chips li { padding: 3px 8px; border-radius: 7px; background: var(--bg); font-size: 12px; font-weight: 600; color: var(--muted); }
  .rechte-chips li.stark { color: var(--accent); }
  .einladungen-liste { list-style: none; margin: 8px 0 14px; padding: 0; display: grid; gap: 8px; }
  .einladungen-liste li { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); font-size: 14px; }
  .einladungen-liste .knoepfe { display: flex; gap: 6px; }
  .einladungen-liste form { padding: 0; border: 0; background: none; }
  .einladungen-liste button { min-height: 36px; padding: 6px 10px; font-size: 13px; }
  .kosten-hinweis { margin: 4px 0; padding: 10px 12px; border-radius: 10px; background: var(--bg); color: var(--muted); font-size: 13px; }
  .leistung-treffer { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 8px 0 16px; padding: 0; }
  .leistung-treffer li { display: inline-flex; gap: 6px; align-items: baseline; padding: 5px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--card); font-size: 13px; font-weight: 600; }
  .leistung-treffer li span { color: var(--accent); }
  .leistung-treffer li.leer span { color: var(--muted); }
  .heute-wichtig { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 4px 0 18px; padding: 0; }
  .heute-wichtig a { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 20px; background: var(--card); color: var(--text); font-size: 14px; font-weight: 600; text-decoration: none; }
  .heute-wichtig a strong { color: var(--accent); }
  .heute-wichtig a.dringend strong { color: var(--error); }
  .einstellungs-liste { margin: 0 0 20px; }
  .darstellung { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .suchkarte { margin: 12px 0 18px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
  .suchkarte svg { display: block; width: 100%; max-width: 360px; height: auto; margin: 0 auto; }
  .suchkarte .land { fill: var(--bg); stroke: var(--muted); stroke-width: 1.2; }
  .suchkarte .grenzen { fill: none; stroke: var(--line); stroke-width: .8; }
  .suchkarte .radius { fill: var(--accent); fill-opacity: .14; stroke: var(--accent); stroke-opacity: .5; stroke-width: 1; }
  .suchkarte .ort { fill: var(--accent); stroke: var(--card); stroke-width: 2; }
  .suchkarte figcaption { display: grid; gap: 2px; margin-top: 8px; text-align: center; font-size: 14px; font-weight: 600; }
  .suchkarte figcaption .klein { font-size: 11px; font-weight: 400; }
  .nachweis-check { margin: 18px 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
  .nachweis-check h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 1.05rem; }
  .nachweis-check ul { list-style: none; margin: 0; padding: 0; }
  .nachweis-check li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .nachweis-check li > span:first-child { flex: 0 0 22px; font-weight: 800; }
  .nachweis-check li.ok > span:first-child { color: #2e8b57; } .nachweis-check li.fehlt > span:first-child { color: var(--error); }
  .nachweis-check li > span:nth-child(2) { flex: 1; min-width: 0; }
  .nachweis-check li a { font-size: 14px; font-weight: 600; white-space: nowrap; }
  .frist-schalter { margin: 16px 0 6px; font-size: 14px; }
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
  /* Compact look (Benjamin, 01.11.): smaller type, fields and buttons, less padding, short fields side by side.
     Inputs keep 16px text so phones do not zoom in while typing. */
  body { font-size: 15px; line-height: 1.5; }
  main { padding-top: 16px; }
  h1 { font-size: 1.38rem; margin-bottom: 12px; }
  h2 { font-size: 1.06rem; margin: 22px 0 8px; }
  h3 { font-size: .98rem; margin: 16px 0 6px; }
  p { margin: 0 0 10px; }
  form { gap: 10px; padding: 12px 14px; border-radius: 12px; }
  label { gap: 4px; font-size: .9rem; }
  input, select, textarea { padding: 7px 10px; font-size: 16px; border-radius: 8px; }
  select { padding-right: 32px; font-size: 15px; }
  textarea { min-height: 5em; }
  button, input, select { min-height: 40px; }
  input[type=checkbox], input[type=radio] { min-height: 20px; width: 20px; height: 20px; flex-basis: 20px; }
  button { padding: 9px 14px; font-size: .92rem; border-radius: 9px; }
  .knopf { padding: 10px 14px; font-size: .95rem; border-radius: 10px; }
  fieldset { gap: 8px; padding: 10px 12px; border-radius: 10px; }
  legend { font-size: .9rem; font-weight: 650; padding: 0 4px; }
  .klein { font-size: 12.5px; }
  /* Fold-outs: slimmer boxes; inside cards and fieldsets only a light row with arrow, no box in a box. */
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown)) { margin: 8px 0; padding: 0 12px; border-radius: 10px; }
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown))[open] { padding-bottom: 12px; }
  details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown)) > summary { min-height: 38px; padding: 7px 0; font-size: .9rem; }
  :is(fieldset, article, .treffer-karte, .firmen-fund, form form, details details) > details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown)) { margin: 4px 0 0; padding: 0; border: 0; border-radius: 0; background: none; }
  :is(fieldset, article, .treffer-karte, .firmen-fund, form form, details details) > details:where(:not(.hilfe, .seiten-hilfe, .nachweis-fehlt, .arbeit-dropdown, .qualifikationen-dropdown))[open] > summary { border-bottom: 0; }
  /* The research box used the old black triangle: same look as all other fold-outs now. */
  .firmen-erkenntnisse { padding: 0 12px; background: var(--card); border-radius: 12px; }
  .firmen-erkenntnisse > summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 38px; padding: 7px 0; list-style: none; color: var(--accent); font-size: .9rem; font-weight: 600; }
  .firmen-erkenntnisse > summary::-webkit-details-marker { display: none; }
  .firmen-erkenntnisse > summary::after { content: "›"; font-size: 1.35rem; line-height: 1; color: var(--muted); transition: transform .15s; }
  .firmen-erkenntnisse[open] > summary::after { transform: rotate(90deg); }
  .firmen-fund { padding: 12px; border-radius: 10px; }
  .firmen-fund h3 { font-size: .92rem; }
  /* Pseudo-selects (work and qualification pickers) look like a normal compact select. */
  .arbeit-dropdown > summary, .qualifikationen-dropdown > summary { min-height: 40px; padding: 7px 10px; font-size: .95rem; }
  .qualifikationen-dropdown { border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
  .qualifikationen-dropdown > summary span { font-size: 1.2rem; color: var(--muted); }
  .arbeit-optionen button { min-height: 38px; padding: 7px 0; font-size: .95rem; }
  /* Overview tiles: small rows, two per line. */
  .konto-kacheln { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0 24px; }
  .konto-kachel { min-height: 0; gap: 2px; padding: 12px 26px 12px 12px; border-radius: 12px; }
  .konto-icon { font-size: 1.35rem; }
  .konto-kachel strong { font-size: .95rem; line-height: 1.25; }
  .konto-kachel .klein { line-height: 1.3; }
  .konto-pfeil { right: 10px; top: 10px; font-size: 1.2rem; }
  .treffer-karte { padding: 14px; border-radius: 14px; }
  .treffer-karte h2 { margin: 10px 0 8px; font-size: 1rem; }
  .treffer-liste { gap: 10px; }
  .reiter { margin: 14px 0; }
  .reiter a { min-height: 36px; padding: 7px 6px; font-size: 13px; }
  .konto-zurueck a, .profil-icon { width: 38px; height: 38px; }
  .konto-zurueck a { font-size: 20px; }
  .live-satz strong { font-size: 1.2rem; }
  button.daumen { width: 38px; height: 38px; font-size: 16px; }
  /* Search profile editor: works and locations as plain rows instead of boxes inside the form box. */
  .arbeitsauswahl { padding: 0; border: 0; background: none; }
  .arbeits-editor fieldset, form[action$="/einrichtung/speichern"] fieldset { padding: 8px 0; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: none; }
  .kalk-felder { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 10px; align-items: start; }
  .aktionsleiste a { display: flex !important; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px; min-height: 40px !important; padding: 8px 10px !important; font-size: .9rem !important; }
  .neu-person > summary > span[aria-hidden] { display: none; }
  .firmen-erkenntnisse .firmen-fund { border: 0; background: var(--bg); }
  /* Search status: one muted line, details fold out. */
  details.suchstand { margin: 0 0 12px; padding: 0; border: 0; background: none; }
  details.suchstand > summary { min-height: 28px; padding: 2px 0; color: var(--muted); font-size: 13px; font-weight: 600; }
  details.suchstand[open] > summary { border-bottom: 0; margin-bottom: 0; }
  p.suchstand { color: var(--muted); font-size: 13px; font-weight: 600; }
  .einfuehrung { margin: 0 0 16px; padding: 12px 14px; border: 1px solid var(--accent); border-radius: 12px; background: var(--card); }
  .einfuehrung h2 { margin: 0 0 8px; font-size: 1rem; }
  .einfuehrung ol { list-style: none; margin: 0 0 6px; padding: 0; display: grid; gap: 6px; }
  .einfuehrung li { display: flex; align-items: center; gap: 10px; }
  .einfuehrung li a { display: grid; color: var(--text); text-decoration: none; }
  .einfuehrung li a strong { font-size: .92rem; }
  .schritt-nr { display: grid; place-items: center; flex: 0 0 26px; height: 26px; border-radius: 50%; background: var(--accent); color: var(--bg); font-size: 13px; font-weight: 700; }
  .einfuehrung li.erledigt .schritt-nr { background: #2e8b57; }
  .einfuehrung li.erledigt strong { text-decoration: line-through; color: var(--muted); }
  .ansicht-umschalter { display: flex; justify-content: flex-end; gap: 4px; margin: -6px 0 10px; }
  .ansicht-umschalter a { padding: 5px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--muted); font-size: 13px; font-weight: 600; text-decoration: none; }
  .ansicht-umschalter a[aria-current] { border-color: var(--accent); color: var(--accent); }
  .massen-leiste { position: sticky; top: 8px; z-index: 6; display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding: 8px 10px; border: 1px solid var(--accent); border-radius: 12px; background: var(--card); box-shadow: 0 3px 12px #0000001a; }
  .massen-leiste[hidden] { display: none; }
  .massen-leiste span { flex: 1; font-size: 14px; font-weight: 600; }
  .massen-leiste button { min-height: 36px; padding: 6px 12px; }
  .auswahl { display: inline-flex; margin-right: 6px; }
  .neu-etikett { color: var(--accent); font-size: 12px; font-weight: 700; }
  .neu-punkt { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--accent); vertical-align: middle; }
  .schnell { display: flex; gap: 6px; margin: 8px 0 0; }
  .schnell form { flex: 1; padding: 0; border: 0; background: none; }
  .schnell button { width: 100%; min-height: 36px; padding: 6px 10px; font-size: 13px; }
  .treffer-meta { justify-content: flex-start; }
  .treffer-meta .treffer-status { margin-left: auto; }
  .treffer-kompakt { list-style: none; margin: 0 0 24px; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); overflow: hidden; }
  .treffer-kompakt li { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--line); }
  .treffer-kompakt li:last-child { border-bottom: 0; }
  .treffer-kompakt .kp { flex: 0 0 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; background: var(--bg); color: var(--accent); font-size: 13px; font-weight: 800; }
  .treffer-kompakt a { display: grid; flex: 1; min-width: 0; color: var(--text); text-decoration: none; }
  .treffer-kompakt a strong { font-size: .92rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kopf-chips { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: -4px 0 10px; padding: 0; }
  .kopf-chips li { padding: 4px 10px; border-radius: 8px; background: var(--card); border: 1px solid var(--line); font-size: 13px; font-weight: 600; }
  .kopf-chips li.punkte { color: var(--accent); }
  .kopf-chips li.frist.rot { border-color: #c0392b; color: #c0392b; } .kopf-chips li.frist.gelb { border-color: #d68910; color: #b9770e; } .kopf-chips li.frist.gruen { border-color: #2e8b57; color: #2e8b57; }
  .portal-knopf { margin: 0 0 10px; }
  .sprungleiste { position: sticky; top: 0; z-index: 4; display: flex; gap: 6px; margin: 0 -16px 10px; padding: 8px 16px; overflow-x: auto; background: var(--bg); border-bottom: 1px solid var(--line); scrollbar-width: none; }
  .sprungleiste a { flex: 0 0 auto; padding: 5px 11px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); color: var(--accent); font-size: 13px; font-weight: 600; text-decoration: none; }
  :target { scroll-margin-top: 60px; }
  h2[id], section[id] { scroll-margin-top: 60px; }
  .notiz-form textarea { min-height: 3.5em; }
  .notizen { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 8px; }
  .notizen li { padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
  .notizen li p { margin: 0 0 4px; }
  .notizen li form { display: inline; padding: 0; border: 0; background: none; }
  .notizen li button { min-height: 28px; padding: 2px 8px; margin-left: 8px; font-size: 12px; }
  details.zustaendigkeit { margin-top: 18px; }
  .kalender-raster .gewaehlt { outline: 3px solid var(--text); outline-offset: 1px; }
  .tag-filter { display: flex; justify-content: space-between; gap: 8px; margin: 0 0 8px; font-weight: 600; font-size: 14px; }
  .tag-filter a { font-weight: 600; text-decoration: none; }
  .zeitleiste { height: 5px; border-radius: 3px; background: var(--bg); overflow: hidden; }
  .zeitleiste span { display: block; height: 100%; border-radius: 3px; background: #2e8b57; }
  .frist.gelb .zeitleiste span { background: #d68910; } .frist.rot .zeitleiste span { background: #c0392b; } .frist.grau .zeitleiste span { background: var(--muted); }
  .termin-weg { display: inline; margin-left: auto; padding: 0; border: 0; background: none; }
  .termin-weg button { min-height: 28px; padding: 2px 8px; font-size: 12px; }
  .kalender-abo input[readonly] { font-size: 13px; }
  .termin-neu form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; align-items: end; }
  .termin-neu form > label:nth-of-type(3), .termin-neu form button { grid-column: 1 / -1; }
  .termin-neu form label { margin: 0; }
  .kalender-abo form button.zweit { min-height: 32px; padding: 4px 10px; font-size: 13px; width: auto; }
  /* Short fields side by side: invitation form, calculation numbers, new location. */
  .kalk-gruppe label { margin-top: 6px; }
  .kalk-gruppe label .klein { font-weight: 400; }
  form[action$="/einladen"]:not(.einladungen-liste form), form[action$="/bereich"] { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 10px; }
  form[action$="/einladen"] > :not(label), form[action$="/bereich"] > :not(label), form[action$="/einladen"] > label.zeile { grid-column: 1 / -1; }
  @media (max-width: 380px) {
    main { padding-right: 12px; padding-left: 12px; }
    .konto-kacheln { gap: 8px; }
    .konto-zurueck a, .profil-icon { width: 44px; height: 44px; }
  }
  /* Firm documents: folder chips, compact file rows, ⋯ menu; references. */
  .erfolg, .hinweis { padding: 8px 12px; border-radius: 10px; font-size: 14px; }
  .erfolg { background: #e7f4ec; color: #1e6b40; } .hinweis { background: #fff6dd; color: #6b5200; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .erfolg { background: #17321f; color: #9fd8b0; } :root:not([data-theme="light"]) .hinweis { background: #3a3014; color: #f0d68a; } }
  .unterlagen-werkzeuge { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
  .unterlagen-werkzeuge .knopf { flex: 1 1 0; min-height: 34px; padding: 7px 10px; font-size: 14px; white-space: nowrap; }
  .ordner-chips { display: flex; gap: 6px; overflow-x: auto; margin: 8px 0 4px; padding-bottom: 4px; scrollbar-width: none; }
  .ordner-chips a { flex: none; padding: 5px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--muted); font-size: 13px; font-weight: 600; text-decoration: none; white-space: nowrap; }
  .ordner-chips a span { margin-left: 3px; opacity: .7; }
  .ordner-chips a[aria-current] { border-color: var(--accent); color: var(--accent); }
  .ordner-titel { margin: 16px 0 4px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .datei-liste, .referenz-liste { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .datei { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-bottom: 1px solid var(--line); }
  .datei:last-child, .referenz:last-child { border-bottom: 0; }
  .datei-symbol { flex: none; font-size: 18px; }
  .datei-text { flex: 1; min-width: 0; display: grid; gap: 1px; }
  .datei-text strong { font-size: 14px; line-height: 1.3; hyphens: auto; overflow-wrap: break-word; }
  .ablauf-warnung li > span:last-child { flex: none; white-space: nowrap; }
  .datei-text .klein { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .datei-status { font-weight: 600; } .datei-status.gruen { color: #2e8b57; } .datei-status.gelb { color: #b07800; } .datei-status.rot { color: var(--error); }
  .datei-aktionen { flex: none; display: flex; align-items: center; gap: 2px; }
  .datei-aktionen > a, .datei-menue > summary { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; color: var(--accent); text-decoration: none; font-size: 15px; cursor: pointer; list-style: none; }
  .datei-aktionen > a:hover, .datei-menue > summary:hover { background: var(--bg); }
  .datei-menue { position: relative; margin: 0; padding: 0; border: 0; background: none; }
  .datei-menue > summary::-webkit-details-marker, .datei-menue > summary::after { display: none; content: none; }
  .datei-menue-inhalt { position: absolute; right: 0; top: 34px; z-index: 5; width: min(300px, 84vw); display: grid; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); box-shadow: 0 8px 24px rgba(0,0,0,.14); }
  .datei-menue-inhalt form { display: grid; gap: 6px; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; }
  .datei-menue-inhalt form + form { padding-top: 8px; border-top: 1px solid var(--line); }
  .datei-menue-inhalt button { min-height: 32px; padding: 4px 10px; font-size: 13px; }
  button.gefahr { color: var(--error); }
  .upload-felder, .referenz-felder { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; align-items: end; }
  .upload-felder > label:first-of-type, .upload-felder [data-bezeichnung], .upload-felder .ganz, .referenz-felder .ganz { grid-column: 1 / -1; }
  .upload-felder label, .referenz-felder label { margin: 0; }
  .upload-felder .klein { margin: 0; }
  label.haken { display: flex; align-items: center; gap: 8px; font-weight: 500; }
  label.haken input { width: auto; min-height: 0; }
  .referenz { position: relative; padding: 10px 44px 10px 12px; border-bottom: 1px solid var(--line); }
  .referenz-kopf { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
  .referenz p { margin: 3px 0; font-size: 14px; }
  .referenz-fakten { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; color: var(--muted); }
  .referenz > .datei-menue { position: absolute; top: 6px; right: 6px; }
  .referenz .datei-menue-inhalt { width: min(340px, 88vw); }
  .referenz .referenz-felder { grid-template-columns: 1fr; }
  .referenz-liste + .klein { margin-top: 10px; }
  .nachweis-zip { margin: 10px 0 4px; } .nachweis-zip .knopf { min-height: 34px; padding: 6px 12px; font-size: 14px; }
  /* Calculation: price floor, price build-up bar, award comparison, templates. */
  .untergrenze { display: grid; gap: 2px; margin: 10px 0; padding: 8px 12px; border: 1px solid var(--line); border-left: 4px solid var(--error); border-radius: 10px; background: var(--card); font-size: 14px; }
  .untergrenze.fehler { background: #fdecea; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .untergrenze.fehler { background: #3a1d19; } :root:not([data-theme="light"]) .vergleich-skala .spanne { background: #2c4a63; } }
  :root[data-theme="dark"] .untergrenze.fehler { background: #3a1d19; } :root[data-theme="dark"] .vergleich-skala .spanne { background: #2c4a63; }
  .preis-grafik { margin: 12px 0; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .preis-balken { display: flex; height: 22px; overflow: hidden; border-radius: 6px; }
  .preis-balken span { min-width: 2px; }
  .preis-grafik figcaption ul { display: grid; grid-template-columns: 1fr; gap: 3px; list-style: none; margin: 10px 0 0; padding: 0; font-size: 13px; }
  .preis-grafik li { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .preis-grafik li i { flex: none; width: 10px; height: 10px; border-radius: 3px; }
  .preis-grafik li b { margin-left: auto; font-weight: 600; white-space: nowrap; }
  .preis-grafik li small { width: 38px; text-align: right; color: var(--muted); }
  @media (min-width: 640px) { .preis-grafik figcaption ul { grid-template-columns: 1fr 1fr; column-gap: 20px; } }
  .zuschlag-vergleich p { font-size: 14px; }
  .vergleich-skala { position: relative; height: 26px; margin: 12px 4px 4px; border-bottom: 2px solid var(--line); }
  .vergleich-skala .spanne { position: absolute; bottom: -2px; height: 8px; border-radius: 4px; background: #c9dceb; }
  .vergleich-skala .punkt { position: absolute; bottom: -1px; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: #4f8fbf; }
  .vergleich-skala .eigen { position: absolute; bottom: -4px; width: 4px; height: 26px; margin-left: -2px; border-radius: 2px; background: #2e8b57; }
  .vergleich-skala .eigen::after { content: "Ihr Angebot"; position: absolute; top: -4px; left: 7px; white-space: nowrap; font-size: 11px; font-weight: 700; color: #2e8b57; }
  .vergleich-skala .eigen.links::after { left: auto; right: 7px; }
  .vergleich-liste { list-style: none; margin: 6px 0; padding: 0; }
  .vergleich-liste li { display: grid; grid-template-columns: 1fr auto; gap: 0 10px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
  .vergleich-liste li > :first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vergleich-liste li .klein { grid-column: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vergleich-liste li b { grid-column: 2; grid-row: 1 / span 2; align-self: center; white-space: nowrap; }
  .angebot-uebernehmen { margin: 12px 0; }
  .vorlage-wahl { margin: 8px 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .vorlage-speichern-zeile { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; }
  .vorlage-speichern-zeile label { margin: 0; }
  .vorlage-speichern-zeile button { min-height: 40px; }
  /* Firma & Team: avatars, absences, photo, location contact, import preview, change log. */
  .aktionsleiste.kompakt { grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 6px; }
  .aktionsleiste.kompakt a { min-height: 38px !important; padding: 6px 8px !important; font-size: 13px !important; white-space: nowrap; }
  .person-avatar { color: #fff; font-size: 15px; letter-spacing: .02em; }
  .person-avatar.foto { object-fit: cover; background: var(--line); }
  .klein-avatar { width: 32px; height: 32px; font-size: 12px; }
  .mitglied-kopf { margin-bottom: 6px; } .mitglied-kopf h3 { margin: 0; }
  .einsatz-zeile { align-items: center; } .einsatz-zeile > .klein-avatar { flex: none; }
  .abwesenheit-bald { display: block; margin-top: 2px; }
  .abwesenheit-teil, .foto-teil { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
  .abwesenheit-teil h4, .foto-teil h4 { margin: 0 0 6px; font-size: 14px; }
  .abwesenheit-liste { list-style: none; margin: 0 0 8px; padding: 0; }
  .abwesenheit-liste li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 0; font-size: 14px; border-bottom: 1px solid var(--line); }
  .abwesenheit-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; align-items: end; margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .abwesenheit-form label { margin: 0; } .abwesenheit-form label:nth-of-type(3) { grid-column: 1; } .abwesenheit-form button { min-height: 40px; }
  .foto-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 6px; padding: 0; border: 0; background: none; box-shadow: none; }
  .foto-form input[type=file] { flex: 1 1 180px; min-width: 0; }
  .standort-kontakt { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0 0 10px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); font-size: 14px; }
  .standort-kontakt .knopf-klein { min-height: 32px; padding: 4px 10px; font-size: 13px; }
  .kontakt-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; align-items: end; }
  .kontakt-form label { margin: 0; } .kontakt-form .ganz { grid-column: 1 / -1; }
  .import-liste, .protokoll-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .import-liste li { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  .import-liste li > span:last-child { display: grid; gap: 1px; min-width: 0; }
  .import-liste li.uebersprungen { opacity: .7; }
  .import-liste li:last-child, .protokoll-liste li:last-child { border-bottom: 0; }
  .protokoll-filter { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .protokoll-liste li { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: start; padding: 9px 10px; border-bottom: 1px solid var(--line); }
  .protokoll-liste li p { margin: 0; font-size: 14px; } .protokoll-liste li .klein { margin-top: 2px; overflow-wrap: anywhere; }
  .protokoll-liste time { font-size: 12px; color: var(--muted); white-space: nowrap; }
  /* Search profile: exclusion after 👎, filters, further profiles, preview. */
  .ausschluss-karte { margin: 0 0 12px; padding: 10px 12px; border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 12px; background: var(--card); }
  .ausschluss-karte p { margin: 0 0 6px; font-size: 14px; }
  .ausschluss-woerter { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .ausschluss-woerter form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .ausschluss-woerter button { min-height: 32px; padding: 4px 10px; font-size: 13px; width: auto; }
  .filter-uebersicht ul { list-style: none; margin: 6px 0; padding: 0; font-size: 14px; } .filter-uebersicht li { padding: 3px 0; }
  .wert-felder { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
  .wert-felder label { margin: 0; }
  .zusatz-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .zusatz-profil { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-bottom: 1px solid var(--line); }
  .zusatz-profil:last-child { border-bottom: 0; }
  .zusatz-profil > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .zusatz-profil .datei-menue-inhalt { width: min(340px, 88vw); }
  .zusatz-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; align-items: end; }
  .zusatz-form label { margin: 0; } .zusatz-form .ganz, .zusatz-form button { grid-column: 1 / -1; }
  .zusatz-profil .zusatz-form { grid-template-columns: 1fr; }
  .vorschau-box { margin: 0 0 14px; padding: 12px; border: 1px solid var(--accent); border-radius: 12px; background: var(--card); }
  .vorschau-box h2 { margin: 0 0 8px; font-size: 1rem; }
  .vorschau-zahlen { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-bottom: 6px; }
  .vorschau-zahlen div { display: grid; gap: 2px; padding: 8px; border-radius: 10px; background: var(--bg); text-align: center; }
  .vorschau-zahlen strong { font-size: 1.5rem; color: var(--accent); } .vorschau-zahlen span { font-size: 12px; color: var(--muted); }
  .vorschau-box ul { margin: 2px 0 6px; padding-left: 18px; font-size: 13px; }
  /* Settings: finer notifications, profile, account deletion, help. */
  .benachrichtigung-mehr { margin: 4px 0 8px; }
  .ruhe-felder { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
  .ruhe-felder label { margin: 0; }
  .profil-name { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; align-items: end; }
  .profil-name label { margin: 0; } .profil-name button { grid-column: 1 / -1; }
  .konto-loeschen { margin-top: 14px; border-color: var(--error); }
  .konto-loeschen > summary { color: var(--error); }
  button.gefahr-voll { background: var(--error); color: #fff; border-color: var(--error); }
  .hilfe-suche { display: block; margin: 0 0 12px; }
  .hilfe-gruppe h2 { margin: 16px 0 6px; font-size: 1rem; }
  .hilfe-frage { margin: 0 0 6px; }
  .hilfe-frage p { margin: 6px 0 2px; font-size: 14px; line-height: 1.5; }
  .hilfe-kontakt { margin-top: 18px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .hilfe-kontakt h2 { margin: 0 0 6px; font-size: 1rem; }
  /* Offers overview (N1). */
  .angebot-kennzahlen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0 0 10px; }
  .angebot-kennzahlen div { display: grid; gap: 2px; padding: 10px 6px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); text-align: center; }
  .angebot-kennzahlen strong { font-size: 1.4rem; color: var(--accent); } .angebot-kennzahlen span { font-size: 12px; color: var(--muted); line-height: 1.3; }
  .angebot-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .angebot-zeile { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--line); border-left: 4px solid transparent; }
  .angebot-zeile:last-child { border-bottom: 0; }
  .angebot-zeile.stand-chef { border-left-color: #d68910; } .angebot-zeile.stand-zuschlag { border-left-color: #2e8b57; } .angebot-zeile.stand-absage { border-left-color: var(--line); opacity: .8; }
  .angebot-titel { display: grid; gap: 2px; min-width: 0; color: inherit; text-decoration: none; }
  .angebot-titel strong { font-size: 14px; line-height: 1.3; }
  .stand-marke { font-weight: 600; color: var(--text); }
  .frist-knapp { color: var(--error); font-weight: 600; }
  .angebot-summe { font-weight: 700; font-size: 14px; white-space: nowrap; }
  .angebot-entscheidung { grid-column: 1 / -1; display: flex; gap: 6px; }
  .angebot-entscheidung form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .angebot-entscheidung button { min-height: 32px; padding: 4px 10px; font-size: 13px; width: auto; }
  /* AÜG-Wächter (N13). */
  .aueg-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .aueg-karte { display: flex; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--line); border-left: 4px solid transparent; }
  .aueg-karte:last-child { border-bottom: 0; }
  .aueg-karte.stufe-rot { border-left-color: var(--error); } .aueg-karte.stufe-gelb { border-left-color: #d68910; } .aueg-karte.stufe-gruen { border-left-color: #2e8b57; }
  .aueg-text { flex: 1; min-width: 0; display: grid; gap: 3px; }
  .aueg-text strong { font-size: 14px; }
  .aueg-status { font-size: 13px; font-weight: 600; }
  .stufe-rot .aueg-status { color: var(--error); } .stufe-gelb .aueg-status { color: #b07800; }
  .aueg-leiste { position: relative; height: 6px; margin: 4px 0 2px; border-radius: 3px; background: var(--bg); }
  .aueg-leiste span { display: block; height: 100%; border-radius: 3px; background: var(--accent); }
  .aueg-leiste i { position: absolute; top: -3px; width: 2px; height: 12px; margin-left: -1px; background: #2e8b57; }
  .aueg-einsaetze ul { list-style: none; margin: 4px 0 0; padding: 0; font-size: 13px; }
  .aueg-einsaetze li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 0; border-bottom: 1px solid var(--line); }
  .aueg-aktionen { display: flex; gap: 4px; align-items: center; }
  .aueg-aktionen form { display: flex; gap: 4px; margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .aueg-aktionen input[type=date] { width: 130px; min-height: 30px; padding: 2px 6px; font-size: 13px; }
  .aueg-aktionen button { min-height: 30px; padding: 2px 8px; font-size: 12px; width: auto; }
  .aueg-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; align-items: end; }
  .aueg-form label { margin: 0; min-width: 0; } .aueg-form input, .aueg-form select { min-width: 0; width: 100%; } .aueg-form .ganz { grid-column: 1 / -1; }
  .termin-neu form > .aueg-form, .termin-neu form > .baustein-knoepfe, .termin-neu form > p, .termin-neu form > label.zeile { grid-column: 1 / -1; }
  .unterweisung-karte summary strong, .unterweisung-karte summary .klein { display: block; }
  .aueg-hinweis { margin: 0; font-size: 13px; font-weight: 600; } .aueg-hinweis a { color: #b07800; }
  /* Funding programmes (N2). */
  .foerder-liste, .radar-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .foerder-zeile { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; align-items: start; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  .foerder-zeile:last-child, .radar-zeile:last-child { border-bottom: 0; }
  .foerder-punkte { min-width: 44px; padding: 3px 6px; border-radius: 8px; background: var(--bg); font-weight: 700; font-size: 13px; text-align: center; }
  .foerder-zeile.stark .foerder-punkte { background: #2e8b57; color: #fff; } .foerder-zeile.schwach { opacity: .8; }
  .foerder-text, .radar-text { display: grid; gap: 3px; min-width: 0; }
  .foerder-text a, .radar-text a { color: inherit; } .foerder-text strong, .radar-text strong { font-size: 14px; line-height: 1.3; }
  .foerder-aktionen, .radar-aktionen { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .foerder-aktionen form, .radar-aktionen form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .foerder-aktionen button, .radar-aktionen button { min-height: 30px; padding: 3px 10px; font-size: 13px; width: auto; }
  /* Re-tender radar (N3). */
  .radar-gruppe { margin: 16px 0 4px; font-size: 1rem; } .radar-gruppe .klein { font-weight: 400; }
  .radar-zeile { display: grid; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--line); border-left: 4px solid transparent; }
  .radar-zeile.bald { border-left-color: #d68910; } .radar-zeile.neu { border-left-color: #2e8b57; }
  .radar-ende { font-size: 13px; }
  .radar-marke { font-size: 12px; color: var(--muted); padding: 3px 6px; border: 1px solid var(--line); border-radius: 8px; }
  /* Running contracts, contracting authorities, evaluation (N4–N6). */
  .vertrag-form { margin-top: 4px; } .vertrag-form summary { font-size: 13px; }
  .vorgang-verweise { margin: 8px 0; }
  .ag-kopf { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; } .ag-kopf h2 { margin: 0; }
  .ag-kopf form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .ag-kopf button { width: auto; min-height: 32px; padding: 4px 10px; font-size: 13px; white-space: nowrap; } .ag-kopf form { flex-shrink: 0; }
  .kontakt-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .kontakt-liste li { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  /* Rows with several buttons (invoices, applicants, customers): text keeps at least 220px, buttons wrap below on phones. */
  .kontakt-liste li:has(> .knopf-zeile) { flex-wrap: wrap; } .kontakt-liste li:has(> .knopf-zeile) > div { flex: 1 1 220px; }
  .kontakt-liste li > .knopf-zeile { flex-wrap: wrap; justify-content: flex-end; max-width: 100%; } .kontakt-liste li > .knopf-zeile > * { flex: 0 0 auto; width: auto; }
  .kontakt-liste li:last-child { border-bottom: 0; } .kontakt-liste li div { display: grid; gap: 2px; min-width: 0; }
  .kontakt-liste form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .kontakt-liste button { width: auto; min-height: 30px; padding: 2px 8px; font-size: 12px; white-space: nowrap; } .kontakt-liste form { flex-shrink: 0; }
  .angebot-zeile form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .angebot-zeile form button { width: auto; min-height: 30px; padding: 2px 10px; font-size: 13px; }
  .such-zeile { display: flex; gap: 6px; margin: 0 0 8px; padding: 0; border: 0; background: none; box-shadow: none; } .such-zeile input { flex: 1; } .such-zeile button { width: auto; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .angebot-kennzahlen.zwei { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .balken-diagramm { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; align-items: end; height: 150px; padding: 8px 8px 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .balken-spalte { display: grid; grid-template-rows: auto 1fr auto; height: 100%; text-align: center; }
  .balken-spalte .balken { align-self: end; display: flex; flex-direction: column; justify-content: flex-end; min-height: 2px; border-radius: 4px 4px 0 0; background: color-mix(in srgb, var(--accent) 35%, var(--card)); }
  .balken-angebot { width: 100%; border-radius: 4px 4px 0 0; background: var(--accent); }
  .balken-zahl { font-size: 11px; color: var(--muted); } .balken-monat { font-size: 10px; color: var(--muted); padding: 2px 0 4px; }
  .legende { display: flex; align-items: center; gap: 6px; } .punkt { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
  .treffer-punkt { background: color-mix(in srgb, var(--accent) 35%, var(--card)); } .angebot-punkt { background: var(--accent); margin-left: 8px; }
  .trichter { list-style: none; margin: 8px 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); display: grid; gap: 6px; }
  .trichter li { display: grid; grid-template-columns: 110px 1fr 40px; gap: 8px; align-items: center; font-size: 13px; } .trichter strong { text-align: right; }
  .trichter-balken { height: 10px; border-radius: 5px; background: var(--bg); overflow: hidden; } .trichter-balken span { display: block; height: 100%; background: var(--accent); border-radius: 5px; }
  .auswertung-tabelle { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .auswertung-tabelle th, .auswertung-tabelle td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--line); } .auswertung-tabelle th { color: var(--muted); font-weight: 600; }
  /* Text modules, bill of quantities, introduction (N7–N9). */
  .baustein-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .baustein-liste li { border-bottom: 1px solid var(--line); } .baustein-liste li:last-child { border-bottom: 0; }
  .baustein-liste details { margin: 0; padding: 8px 12px; border: 0; border-radius: 0; background: none; box-shadow: none; }
  .baustein-liste summary { display: grid; gap: 2px; padding: 0; min-height: 0; border: 0; background: none; color: inherit; font-weight: 400; list-style: none; cursor: pointer; }
  .baustein-liste summary::-webkit-details-marker { display: none; } .baustein-liste summary strong { color: var(--accent); }
  .baustein-liste summary .radar-marke { justify-self: start; padding: 0 6px; font-size: 11px; }
  .baustein-vorschau { color: var(--muted); } .baustein-text { white-space: pre-wrap; font-size: 14px; }
  .baustein-knoepfe { display: flex; gap: 8px; } .baustein-knoepfe button { width: auto; }
  .baustein-auswahl .zeile { align-items: flex-start; } .baustein-auswahl .zeile .klein { color: var(--muted); white-space: nowrap; }
  .lv-upload { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; } .lv-upload label { flex: 1 1 220px; margin: 0; } .lv-upload button { width: auto; }
  .lv-titel { display: flex; justify-content: space-between; gap: 8px; margin: 14px 0 4px; font-size: 15px; } .lv-titel .klein { font-weight: 600; white-space: nowrap; }
  .lv-gruppe .lv-gruppe .lv-titel { font-size: 14px; }
  .lv-liste { list-style: none; margin: 4px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .lv-pos { display: grid; gap: 4px; padding: 8px 10px; border-bottom: 1px solid var(--line); } .lv-pos:last-child { border-bottom: 0; }
  .lv-pos.lv-offen { border-left: 3px solid #d68910; } .lv-pos.lv-neben { background: color-mix(in srgb, var(--bg) 60%, var(--card)); }
  .lv-text { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; font-size: 14px; } .lv-text details, .lv-text > span:not(.lv-oz) { min-width: 0; }
  .lv-oz { font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; } .lv-art { grid-column: 2; font-size: 12px; color: #b07800; }
  .lv-lang { white-space: pre-wrap; margin: 4px 0; }
  .lv-zahlen { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; font-size: 13px; }
  .lv-ep { display: flex; align-items: center; gap: 4px; margin: 0; font-size: 12px; color: var(--muted); }
  .lv-ep input, .lv-menge { width: 96px; min-height: 32px; padding: 2px 6px; text-align: right; font-size: 14px; }
  .lv-gp { min-width: 90px; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .lv-speichern { padding: 8px 0; } .lv-speichern button { width: 100%; }
  .lv-text details { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .lv-text details summary { padding: 0; min-height: 0; border: 0; background: none; font-weight: 400; color: inherit; list-style: none; cursor: pointer; }
  .lv-text details summary::after { content: " ▾"; color: var(--muted); font-size: 11px; } .lv-text details summary::-webkit-details-marker { display: none; }
  .lv-menge-text { display: flex; align-items: center; gap: 4px; white-space: nowrap; } .lv-ep { white-space: nowrap; }
  .lv-kennzahlen strong { font-size: 1.1rem; }
  .lv-werkzeuge, .lv-ersetzen { margin: 8px 0; }
  .hilfe-einfuehrung { margin: 0 0 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .einfuehrung-schritte { margin: 8px 0 0; padding-left: 22px; display: grid; gap: 6px; } .einfuehrung-schritte li { font-size: 14px; } .einfuehrung-schritte li span { display: block; }
  /* Appointments & bidder questions, partners, scheduling board (N10–N12). */
  .termin-liste, .frage-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .termin-zeile { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: start; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  .termin-zeile:last-child, .frage-zeile:last-child, .anfrage-zeile:last-child { border-bottom: 0; }
  .termin-zeile div, .frage-zeile > div:first-child, .anfrage-zeile > div:first-child { display: grid; gap: 2px; min-width: 0; font-size: 14px; }
  .termin-zeile.bald { border-left: 3px solid #d68910; } .termin-zeile.vorbei { opacity: .6; } .termin-icon { font-size: 18px; }
  .termin-zeile form, .frage-aktionen form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .termin-zeile button, .frage-aktionen button { width: auto; min-height: 30px; padding: 2px 8px; font-size: 12px; }
  .frage-zeile, .anfrage-zeile { display: grid; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  .frage-zeile p { margin: 0; } .frage-antwort { color: var(--muted); font-size: 13px; }
  .frage-zeile.status-offen { border-left: 3px solid #d68910; } .frage-zeile.status-beantwortet, .anfrage-zeile.status-zugesagt { border-left: 3px solid #2e8b57; } .anfrage-zeile.status-abgesagt { opacity: .7; }
  .frage-aktionen { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .frage-aktionen details { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .frage-aktionen details summary { min-height: 30px; padding: 4px 10px; font-size: 12px; }
  .frage-aktionen details[open] { flex-basis: 100%; } .frage-aktionen details form { display: grid; gap: 6px; margin-top: 6px; }
  .frage-neu, .anfrage-neu { margin: 8px 0; } .fragen-text { width: 100%; font-size: 13px; }
  .anfrage-mail { display: inline-flex; align-items: center; min-height: 30px; padding: 2px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none; }
  .partner-sterne { color: #d68910; font-size: 13px; letter-spacing: 1px; }
  .dispo-nav { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 8px 0; } .dispo-nav .knopf { width: auto; min-height: 34px; padding: 4px 14px; }
  .dispo-filter { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; padding: 0; border: 0; background: none; box-shadow: none; } .dispo-filter select { flex: 1 1 140px; width: auto; } .dispo-filter button { width: auto; }
  .dispo-tafel { border: 1px solid var(--line); border-radius: 12px; background: var(--card); overflow: hidden; }
  .dispo-zeile { display: grid; grid-template-columns: minmax(84px, 1.6fr) repeat(7, minmax(0, 1fr)); border-bottom: 1px solid var(--line); }
  .dispo-zeile:last-child { border-bottom: 0; }
  .dispo-kopf span { padding: 4px 2px; font-size: 11px; font-weight: 700; text-align: center; color: var(--muted); line-height: 1.2; } .dispo-kopf span:first-child { text-align: left; padding-left: 8px; }
  .dispo-kopf .heute { color: var(--accent); }
  .dispo-name { display: grid; padding: 4px 6px 4px 8px; min-width: 0; } .dispo-name strong { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .dispo-name small { font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dispo-zelle { margin: 2px 1px; padding: 2px; border-radius: 4px; font-size: 9px; line-height: 1.15; text-align: center; overflow: hidden; white-space: nowrap; display: flex; align-items: center; justify-content: center; min-height: 30px; }
  .dispo-zelle.einsatz { background: color-mix(in srgb, var(--accent) 22%, var(--card)); color: var(--text); }
  .dispo-zelle.abwesend { background: color-mix(in srgb, #d68910 22%, var(--card)); }
  .dispo-zelle.frei { background: color-mix(in srgb, #2e8b57 14%, var(--card)); }
  .dispo-zelle.nicht { background: var(--bg); color: var(--muted); }
  .dispo-zelle.wochenende.frei { background: transparent; } .dispo-zelle.heute { outline: 2px solid var(--accent); outline-offset: -2px; }
  .einsatz-punkt { background: color-mix(in srgb, var(--accent) 22%, var(--card)); } .abwesend-punkt { background: color-mix(in srgb, #d68910 22%, var(--card)); margin-left: 8px; } .frei-punkt { background: color-mix(in srgb, #2e8b57 14%, var(--card)); margin-left: 8px; }
  /* Company profile and personnel file (T1–T8). */
  .team-warnungen { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0 0 10px; padding: 8px 12px; border: 1px solid #e3c27a; border-radius: 12px; background: color-mix(in srgb, #d68910 10%, var(--card)); font-size: 13px; }
  .team-werkzeuge { margin-bottom: 12px; }
  .konto-kacheln.team-werkzeuge { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 8px 0 16px; }
  @media (min-width: 760px) { .konto-kacheln.team-werkzeuge { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
  .team-werkzeuge .konto-kachel { min-height: 0; padding: 10px 6px; gap: 2px; align-items: center; text-align: center; border-radius: 12px; }
  .team-werkzeuge .konto-kachel strong { font-size: 13px; line-height: 1.25; overflow-wrap: anywhere; hyphens: auto; }
  .team-werkzeuge .konto-kachel .klein, .team-werkzeuge .konto-pfeil { display: none; }
  .team-werkzeuge .konto-icon { font-size: 22px; }
  .profil-stand { display: grid; gap: 4px; margin: 0 0 10px; } .profil-balken { height: 8px; border-radius: 4px; background: var(--bg); overflow: hidden; } .profil-balken span { display: block; height: 100%; background: #2e8b57; }
  .profil-form table input { width: 100%; min-height: 32px; padding: 2px 6px; } .profil-form td:first-child, .profil-form th:first-child { white-space: nowrap; width: 1%; }
  .logo-teil { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; } .firmenlogo { max-height: 60px; max-width: 200px; border: 1px solid var(--line); border-radius: 8px; padding: 4px; background: #fff; }
  .zert-liste li.abgelaufen { border-left: 3px solid var(--error); } .zert-liste li.bald { border-left: 3px solid #d68910; }
  .akte-felder { margin: 8px 0; } .akte-felder .zwei { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; align-items: end; }
  .akte-zeile { margin: 2px 0; }
  .nachweis-marken { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
  .nachweis-marke { padding: 1px 8px; border-radius: 999px; font-size: 12px; border: 1px solid var(--line); background: var(--bg); }
  .nachweis-marke.rot { border-color: var(--error); color: var(--error); } .nachweis-marke.gelb { border-color: #d68910; color: #b07800; }
  .nachweis-teil span.rot { color: var(--error); } .nachweis-teil span.gelb { color: #b07800; }
  .nachweis-form { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; align-items: end; } .nachweis-form .ganz { grid-column: 1 / -1; } .nachweis-form label { margin: 0; }
  .unterweisung-karte { margin: 8px 0; } .unterweisung-karte summary { display: grid; gap: 2px; }
  .unterweisung-liste { list-style: none; margin: 6px 0; padding: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
  .unterweisung-liste li { display: flex; justify-content: space-between; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--line); font-size: 14px; } .unterweisung-liste li:last-child { border-bottom: 0; }
  .unterweisung-liste li.rot { border-left: 3px solid var(--error); } .unterweisung-liste li.gelb { border-left: 3px solid #d68910; }
  .unterweisung-form .zwei { align-items: end; }
  .such-form { margin: 0 0 8px; } .such-treffer { display: flex; justify-content: space-between; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  .such-treffer > div:first-child { display: grid; gap: 2px; min-width: 0; font-size: 14px; } .such-werte { display: grid; justify-items: end; gap: 2px; font-size: 13px; white-space: nowrap; }
  .such-treffer.frei { border-left: 3px solid #2e8b57; } .such-treffer.teils { border-left: 3px solid #d68910; } .such-treffer.belegt { opacity: .75; }
  /* Firma & Team part 2 (T9–T16). */
  .org-baum { overflow-x: auto; padding: 4px 0 8px; }
  .org-baum ul { list-style: none; margin: 0; padding: 0 0 0 18px; position: relative; }
  .org-baum > ul { padding-left: 0; }
  .org-baum li { position: relative; margin: 6px 0; }
  .org-baum ul ul > li::before { content: ""; position: absolute; left: -12px; top: -6px; bottom: 50%; width: 10px; border-left: 2px solid var(--line); border-bottom: 2px solid var(--line); border-bottom-left-radius: 6px; }
  .org-baum ul ul > li:not(:last-child)::after { content: ""; position: absolute; left: -12px; top: 50%; bottom: -8px; border-left: 2px solid var(--line); }
  .org-knoten { display: grid; gap: 1px; max-width: 420px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); font-size: 14px; }
  .org-knoten a { text-decoration: none; } .org-firma { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--card)); }
  .org-standort { border-left: 3px solid var(--accent); } .org-abteilung { border-left: 3px solid #8e44ad; } .org-team { border-left: 3px solid #2e8b57; }
  .org-fehlt { color: #b07800; }
  .tabelle-scroll { overflow-x: auto; margin: 8px 0; }
  .rechte-tabelle th, .rechte-tabelle td { text-align: center; font-size: 13px; padding: 4px 6px; } .rechte-tabelle td:first-child, .rechte-tabelle th:first-child { text-align: left; min-width: 150px; }
  .rechte-tabelle th.senkrecht { vertical-align: bottom; padding: 6px 2px; } .rechte-tabelle th.senkrecht span { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; display: inline-block; }
  .rechte-tabelle td:not(:first-child) { width: 34px; padding: 4px 2px; }
  .zugang-tabelle td, .zugang-tabelle th { font-size: 13px; padding: 4px 6px; overflow-wrap: normal; } .zugang-tabelle td:last-child, .zugang-tabelle th:last-child { text-align: center; }
  tr.gesperrt td { opacity: .6; }
  .vertretung-hinweis { margin: 0 0 10px; padding: 8px 12px; border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line)); border-radius: 12px; background: color-mix(in srgb, var(--accent) 8%, var(--card)); font-size: 14px; }
  .vertretung-liste li.aktiv { border-left: 3px solid var(--accent); }
  .aufgaben-liste { list-style: none; margin: 8px 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .aufgabe { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--line); }
  .aufgabe:last-child { border-bottom: 0; } .aufgabe > div { display: grid; gap: 1px; min-width: 0; }
  .aufgabe form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .aufgabe button { width: auto; min-height: 30px; padding: 2px 8px; font-size: 12px; }
  .aufgabe .aufgabe-haken { min-width: 34px; font-size: 20px; line-height: 1; background: none; border: 0; color: var(--text); padding: 0; }
  .aufgabe-titel { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
  .aufgabe.erledigt .aufgabe-titel { text-decoration: line-through; color: var(--muted); font-weight: 400; }
  .aufgabe.rot { border-left: 3px solid var(--error); } .aufgabe.gelb { border-left: 3px solid #d68910; }
  .aufgabe-neu { margin: 8px 0; }
  .einladungen-liste li.abgelaufen { border-style: dashed; opacity: .85; }
  .kapazitaet-tabelle th, .kapazitaet-tabelle td { text-align: center; font-size: 13px; padding: 4px 6px; } .kapazitaet-tabelle td:first-child, .kapazitaet-tabelle th:first-child { text-align: left; overflow-wrap: normal; word-break: normal; hyphens: auto; min-width: 92px; } .kapazitaet-tabelle th:nth-child(2) { white-space: nowrap; }
  .kap-null { background: color-mix(in srgb, var(--error) 14%, var(--card)); } .kap-wenig { background: color-mix(in srgb, #d68910 16%, var(--card)); } .kap-gut { background: color-mix(in srgb, #2e8b57 12%, var(--card)); }
  .kapazitaet-liste li { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  .kapazitaet-liste li:last-child { border-bottom: 0; } .kapazitaet-liste li > div { display: grid; gap: 2px; min-width: 0; font-size: 14px; }
  .kapazitaet-liste li.reicht { border-left: 3px solid #2e8b57; } .kapazitaet-liste li.knapp { border-left: 3px solid #d68910; } .kapazitaet-liste li.fehlt { border-left: 3px solid var(--error); }
  .kap-wert { white-space: nowrap; font-size: 13px; font-weight: 600; }
  .ich-kopf h2 { margin-bottom: 0; } .ich-kopf p { margin-top: 2px; }
  .ich-raster { display: grid; gap: 4px 16px; } @media (min-width: 760px) { .ich-raster { grid-template-columns: 1fr 1fr; } }
  .ich-raster section h3 { margin: 10px 0 4px; }
  .ich-liste li.aktiv { border-left: 3px solid var(--accent); } .ich-liste li.bald { border-left: 3px solid #d68910; } .ich-liste li.abgelaufen { border-left: 3px solid var(--error); }
  .abwesenheit-liste li.beantragt { background: color-mix(in srgb, #d68910 10%, transparent); border-radius: 6px; } .abwesenheit-liste button { white-space: nowrap; }
  .zugang-akte { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: end; margin: 6px 0 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .zugang-akte label { flex: 1 1 200px; margin: 0; font-size: 13px; } .zugang-akte button { width: auto; }
  /* Firma & Team part 3 (T17–T22). */
  .warnung { color: #b07800; }
  .stunden-person { margin: 10px 0; } .stunden-person h3 { margin: 0 0 4px; font-size: 15px; } .stunden-person h3 .klein { font-weight: 400; }
  .stunden-form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; display: block; }
  .stunden-buero li.stunden-zeile { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; padding: 6px 10px; }
  .stunden-zeile > div { display: grid; gap: 1px; min-width: 0; font-size: 14px; } .stunden-zeile > strong { font-size: 15px; white-space: nowrap; }
  .stunden-zeile input[type=checkbox] { width: 18px; height: 18px; min-height: 0; margin: 0; }
  .stunden-zeile.abgelehnt { opacity: .55; } .stunden-zeile.abgelehnt > strong { text-decoration: line-through; }
  .stunden-knoepfe { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; } .stunden-knoepfe button { width: auto; flex: 1 1 160px; }
  .schicht-woche { display: grid; gap: 6px 14px; } @media (min-width: 760px) { .schicht-woche { grid-template-columns: 1fr 1fr; } }
  .schicht-tag h3 { margin: 8px 0 2px; font-size: 14px; } .schicht-tag.heute h3 { color: var(--accent); } .schicht-tag.leer h3 { font-weight: 500; color: var(--muted); margin: 4px 0; }
  .schicht-liste li.offen { border-left: 3px solid #d68910; } .schicht-liste li.zugesagt { border-left: 3px solid #2e8b57; } .schicht-liste li.abgesagt { border-left: 3px solid var(--error); opacity: .75; } .schicht-liste li.frei { border-left: 3px dashed var(--line); }
  .schicht-antwort { display: flex; gap: 4px; } .schicht-antwort button { width: auto; min-height: 32px; padding: 2px 10px; font-size: 13px; white-space: nowrap; }
  details.abschnitt { margin: 14px 0; } details.abschnitt > summary { cursor: pointer; list-style: none; } details.abschnitt > summary h2 { display: inline; margin: 0; }
  details.abschnitt > summary::after { content: " ›"; color: var(--muted); } details.abschnitt[open] > summary::after { content: " ⌄"; }
  .naechster-schritt { margin: 10px 0 14px; padding: 12px 14px; border: 2px solid var(--accent); border-radius: 14px; background: var(--card); }
  .naechster-schritt h2 { margin: 2px 0 4px; font-size: 18px; } .naechster-schritt > p { margin: 4px 0; } .naechster-schritt .klein { margin: 0; font-weight: 600; color: var(--accent); }
  .naechster-schritt .aktionsleiste { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; } .naechster-schritt form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .naechster-schritt .aktionsleiste .knopf, .naechster-schritt .aktionsleiste button { width: auto; flex: 1 1 140px; }
  .chat-verlauf { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
  .chat-blase { position: relative; max-width: 85%; padding: 6px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); align-self: flex-start; }
  .chat-blase.eigen { align-self: flex-end; border-color: var(--accent); }
  .chat-blase p { margin: 2px 0; overflow-wrap: anywhere; } .chat-blase form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; position: absolute; top: 2px; right: 2px; }
  .chat-blase button { width: auto; min-height: 24px; padding: 0 6px; font-size: 12px; } .chat-blase .klein { padding-right: 22px; }
  .standort-zeile.chat-neu { border-color: var(--accent); }
  .mitteilung { margin: 8px 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .mitteilung.neu { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .mitteilung h3 { margin: 0 0 2px; font-size: 16px; } .mitteilung > p { margin: 4px 0; }
  .mitteilung-fuss { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; }
  .mitteilung-fuss form { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .mitteilung-fuss button { width: auto; min-height: 32px; padding: 2px 12px; font-size: 13px; }
  .gelesen-liste { flex: 1 1 200px; margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .gelesen-liste summary { min-height: 0; padding: 0; }
  .kontrolle-form { display: flex; gap: 4px; align-items: center; } .kontrolle-form input[type=date] { width: 140px; min-height: 32px; padding: 2px 6px; font-size: 13px; } .kontrolle-form button { width: auto; min-height: 32px; padding: 2px 10px; font-size: 13px; white-space: nowrap; }
  @media (max-width: 480px) { .kontroll-liste li { flex-wrap: wrap; } .kontroll-liste li > div { flex: 1 1 100%; } }
  .unterweisung-ich { flex-wrap: wrap; } .unterweisung-ich > div { flex: 1 1 200px; } .unterweisung-ich details, .unterweisung-inhalt { margin: 4px 0 0; padding: 0; border: 0; background: none; box-shadow: none; } .unterweisung-ich details summary, .unterweisung-inhalt summary { min-height: 0; padding: 0; }
  .unterweisung-ich form button { width: auto; min-height: 32px; padding: 2px 10px; font-size: 13px; white-space: nowrap; }
  /* Firma & Team part 4 (T29–T33). */
  .stunden-zeile .zuschlag { grid-column: 2 / -1; margin-top: -2px; }
  .ausfall { margin: 0 0 12px; padding: 10px 12px; border: 1px solid var(--error); border-radius: 12px; background: color-mix(in srgb, var(--error) 7%, var(--card)); }
  .ausfall h2 { margin: 0 0 6px; font-size: 17px; } .ausfall-person h3 { margin: 6px 0 2px; font-size: 15px; } .ausfall-person h3 .klein { font-weight: 400; }
  .ersatz p { margin: 4px 0 2px; font-size: 14px; }
  .ersatz-wahl { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .ersatz-wahl button { width: auto; min-height: 32px; padding: 2px 10px; font-size: 13px; }
  .kunde-karte { margin: 10px 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .kunde-karte h3 { margin: 0 0 2px; font-size: 16px; } .kunde-karte > p { margin: 0 0 6px; }
  .kunde-karte details.termin-neu { margin: 6px 0 0; }
  .ort-liste { list-style: none; margin: 6px 0; padding: 0; border: 1px solid var(--line); border-radius: 10px; }
  .ort-liste > li { border-bottom: 1px solid var(--line); } .ort-liste > li:last-child { border-bottom: 0; }
  .ort-liste details { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .ort-liste > li > details > summary { display: grid; grid-template-columns: 1fr auto; gap: 1px 8px; padding: 6px 10px; min-height: 0; font-size: 14px; } .ort-liste > li > details > summary > * { grid-column: 1; } .ort-liste > li > details > summary::after { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
  .ort-liste details[open] { padding-bottom: 8px; } .ort-liste details > div, .ort-liste details > form, .ort-liste .ort-bearbeiten { margin: 0 10px; } .ort-liste .ort-bearbeiten summary { padding: 4px 0; }
  .ort-info { display: grid; gap: 3px; font-size: 13px; margin: 4px 0; }
  .ich-liste li:has(> .ort-details) { flex-wrap: wrap; } .ich-liste li > .ort-details { flex: 1 1 100%; }
  .ort-details { margin: 4px 0 0; padding: 0; border: 0; background: none; box-shadow: none; } .ort-details summary { min-height: 0; padding: 0; }
  .knopf-zeile { display: flex; gap: 6px; } .knopf-zeile button { flex: 1; }
  .nachweis-liste li { display: grid; grid-template-columns: 1fr; gap: 6px; align-items: start; } .nachweis-liste .nachweis-status { margin: 0; }
  .nachweis-liste li .knopf { width: auto; min-height: 34px; padding: 4px 12px; font-size: 13px; white-space: nowrap; }
  .ausfall-melden { margin: 0 0 10px; border-color: color-mix(in srgb, var(--error) 50%, var(--line)); } .ausfall-melden summary { color: var(--error); font-weight: 600; }
  /* Firma & Team part 5 (T23–T28). */
  .mehr-warnungen { flex-basis: 100%; margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .mehr-warnungen summary { min-height: 0; padding: 0; font-size: 13px; } .mehr-liste { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 6px; }
  .werkzeug-gruppe { margin: 10px 0 2px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .konto-kacheln.team-werkzeuge { margin: 4px 0 8px; }
  .psa-person, .bewerber, .checkliste { margin: 6px 0; } .psa-person > summary, .bewerber > summary, .checkliste > summary { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; } .psa-person > summary > *, .bewerber > summary > *, .checkliste > summary > * { grid-column: 1; } .psa-person > summary::after, .bewerber > summary::after, .checkliste > summary::after { grid-column: 2; grid-row: 1 / span 3; align-self: center; }
  .checkliste .profil-balken { margin-top: 2px; }
  .status-wahl { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; padding: 0; border: 0; background: none; box-shadow: none; } .status-wahl button { width: auto; min-height: 32px; padding: 2px 10px; font-size: 13px; }
  .zeile-form { display: flex; flex-wrap: wrap; gap: 6px; align-items: end; margin: 6px 0; padding: 0; border: 0; background: none; box-shadow: none; } .zeile-form label { flex: 1 1 200px; margin: 0; font-size: 13px; } .zeile-form button { width: auto; min-height: 38px; }
  .bewerber-gruppe h2 { margin: 12px 0 4px; font-size: 16px; }
  .knopf-zeile form { flex: 1; margin: 0; padding: 0; border: 0; background: none; box-shadow: none; } .knopf-zeile form button { width: 100%; }
  .urlaub-tabelle td, .urlaub-tabelle th { font-size: 13px; padding: 4px 6px; text-align: center; } .urlaub-tabelle td:first-child, .urlaub-tabelle th:first-child { text-align: left; overflow-wrap: normal; word-break: normal; hyphens: auto; } .urlaub-tabelle th { white-space: nowrap; font-size: 12px; } .urlaub-tabelle td:last-child { white-space: nowrap; }
  .urlaub-tabelle input { width: 46px; min-height: 30px; padding: 2px 4px; text-align: center; } .urlaub-tabelle tr.minus td:last-child { color: var(--error); }
  .zeile-inline { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 0; } .zeile-inline input { width: 64px; min-height: 34px; }
  .kalender-scroll { border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
  .team-kalender { border-collapse: collapse; font-size: 11px; } .team-kalender th, .team-kalender td { min-width: 22px; height: 24px; padding: 0; text-align: center; border-bottom: 1px solid var(--line); }
  .team-kalender th span { font-weight: 400; color: var(--muted); font-size: 9px; }
  .team-kalender .name { position: sticky; left: 0; z-index: 1; background: var(--card); text-align: left; padding: 0 6px; min-width: 96px; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
  .team-kalender .we, .team-kalender .ft { background: var(--bg); color: var(--muted); } .team-kalender .heute { outline: 2px solid var(--accent); outline-offset: -2px; }
  .team-kalender td.urlaub { background: color-mix(in srgb, #2e8b57 30%, var(--card)); font-weight: 600; } .team-kalender td.beantragt { background: color-mix(in srgb, #d68910 25%, var(--card)); }
  .team-kalender td.schulung { background: color-mix(in srgb, var(--accent) 22%, var(--card)); } .team-kalender td.weg { background: color-mix(in srgb, var(--muted) 20%, var(--card)); }
  .team-kalender tr.summe th { font-size: 11px; } .team-kalender th.zuviel { background: color-mix(in srgb, var(--error) 25%, var(--card)); color: var(--error); }
  .kennzahlen { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 8px 0; } @media (min-width: 760px) { .kennzahlen { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
  .kennzahl { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); } .kennzahl strong { font-size: 20px; }
  .balken { display: inline-block; width: 80px; height: 8px; border-radius: 4px; background: var(--bg); overflow: hidden; vertical-align: middle; } .balken span { display: block; height: 100%; background: var(--accent); }
  .zu-tabelle td, .zu-tabelle th { text-align: center; font-size: 13px; padding: 3px 6px; } .zu-tabelle td:first-child, .zu-tabelle th:first-child { text-align: left; }
  .sterne { color: #d68910; letter-spacing: 1px; white-space: nowrap; }
  .urlaub-konto { margin: 0 0 6px; }
  .steckbrief-kopf { display: flex; align-items: center; gap: 8px; } .steckbrief-kopf h2, .steckbrief-kopf p { margin-right: 0; }
  .frage-mini { display: inline-grid; place-items: center; width: 16px; height: 16px; min-height: 0; margin: 0 1px 0 3px; padding: 0; border: 0; background: transparent; color: var(--accent); vertical-align: -2px; cursor: pointer; box-shadow: none; position: relative; }
  .frage-mini::before { content: ""; position: absolute; inset: -12px; }
  .dl-icon { width: 14px; height: 14px; display: inline-block; vertical-align: -2px; } .frage-mini .dl-icon { vertical-align: 0; }
  .frage-mini.kreis { width: 20px; height: 20px; border: 1.5px solid var(--accent); border-radius: 50%; font-size: 12px; font-weight: 700; line-height: 1; vertical-align: 1px; }
  .einladen form .ganz { grid-column: 1 / -1; }
  .label-zeile { display: flex; align-items: center; gap: 6px; }
  .frage-liste { margin: 0 0 8px; padding-left: 18px; } .frage-liste li { margin: 0 0 6px; }
  .zugriff-tabelle th { text-align: left; width: 34%; } .zugriff-zusammenfassung ul { list-style: none; margin: 0 0 10px; padding: 0; } .zugriff-zusammenfassung li { margin: 3px 0; } .zugriff-zusammenfassung .nein li { color: var(--muted); }
  .frage-mini.gross { width: 30px; height: 30px; } .frage-mini.gross .dl-icon { width: 20px; height: 20px; }
  .dl-hinweis { color: var(--accent); margin-left: 3px; } .frage-popup .dl-icon { color: var(--accent); }
  .frage-popup { width: min(420px, calc(100vw - 32px)); margin: auto; border: 1px solid var(--line); border-radius: 12px; padding: 14px; background: var(--card); color: var(--text); box-shadow: 0 8px 30px #0004; font-size: 14px; }
  .frage-popup::backdrop { background: #0004; } .frage-popup p { margin: 0 0 8px; } .frage-popup .knopf-zeile { display: flex; flex-wrap: wrap; gap: 8px; } .frage-popup .knopf, .frage-popup button { min-height: 36px; padding: 4px 12px; }
  .demo-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0 0 10px; padding: 8px 12px; border: 1px solid #e3c27a; border-radius: 12px; background: color-mix(in srgb, #d68910 10%, var(--card)); font-size: 14px; } .demo-banner .knopf { min-height: 34px; padding: 4px 12px; margin-left: auto; }
  .gewerk-zahlen { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; } .gewerk-zahlen div { display: grid; gap: 2px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); } .gewerk-zahlen strong { font-size: 1.8rem; color: var(--accent); } .gewerk-zahlen span { font-size: 13px; color: var(--muted); } .gewerk-liste { flex-wrap: wrap; overflow: visible; }
  /* T34–T45 */
  .ich-oben { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .ich-oben .konto-zurueck { margin: 0; }
  .sprache-wahl { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; flex: 1; min-width: 0; align-items: center; font-size: 13px; }
  .sprache-wahl a { flex: none; padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--muted); text-decoration: none; font-weight: 600; }
  .sprache-wahl a[aria-current] { border-color: var(--accent); color: var(--accent); }
  .land-wahl { font-size: 13px; color: var(--muted); line-height: 1.9; margin-top: 18px; }
  .land-wahl a[aria-current] { color: var(--accent); font-weight: 700; }
  .us-kasten { border: 1px solid var(--line); border-radius: 14px; padding: 4px 16px 12px; margin: 14px 0; background: var(--card); }
  .us-kasten h2 { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .us-ampel-wort { font-size: 14px; padding: 2px 10px; border-radius: 999px; font-weight: 700; }
  .us-ampel-wort.gruen, .us-ampel.gruen { background: #e3f6e8; color: #17663a; } .us-ampel-wort.gelb, .us-ampel.gelb { background: #fff4d6; color: #7a5600; } .us-ampel-wort.rot, .us-ampel.rot { background: #fde4e1; color: #a1271b; }
  .us-gruende { list-style: none; padding: 0; margin: 6px 0; display: grid; gap: 6px; } .us-gruende li { line-height: 1.4; }
  .us-fristen th { width: 40%; }
  .treffer-fakten li.us-ampel { font-weight: 600; }
  .unterschrift-feld { display: grid; gap: 4px; margin: 6px 0; grid-column: 1 / -1; width: 100%; } .unterschrift-feld canvas { width: 100%; height: auto; aspect-ratio: 5 / 2; max-width: 100%; border: 1px dashed var(--line); border-radius: 10px; background: #fff; touch-action: none; }
  .unterschrift-feld button { justify-self: end; min-height: 30px; padding: 2px 10px; font-size: 13px; }
  .stempeluhr { margin: 8px 0 12px; } .stempeluhr h3 { margin: 6px 0 2px; } .stempel-status { margin: 0 0 6px; font-weight: 600; }
  .stempeluhr form { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .stempeluhr .knopf-zeile { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; } .stempeluhr .knopf-zeile button { min-height: 46px; font-size: 1.05rem; }
  .nachweis-knoepfe { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; } .nachweis-knoepfe form { margin: 0; display: flex; gap: 6px; align-items: center; } .nachweis-knoepfe .knopf, .nachweis-knoepfe button { min-height: 34px; padding: 4px 10px; font-size: 14px; }
  .nachweis-status { font-size: 13px; margin: 4px 0; } .nachweis-status.ok { color: var(--ok, #1a7f37); } .nachweis-status.frage { color: var(--warn, #9a6700); }
  .drei { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } .fuenf { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; } .fuenf input { padding-left: 6px; padding-right: 4px; }
  .bz-felder { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; } .bz-felder legend { font-weight: 600; font-size: 14px; }
  .teilen { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
  .nachweis-tabelle td, .nachweis-tabelle th { white-space: nowrap; } .tabelle-scroll { overflow-x: auto; }
  .tabelle-rahmen { overflow-x: auto; margin: 8px 0; } .tabelle-rahmen td, .tabelle-rahmen th { white-space: nowrap; }
  .fortschritt { height: 10px; border-radius: 6px; background: rgba(127,127,127,.2); overflow: hidden; margin: 2px 0 10px; } .fortschritt span { display: block; height: 100%; background: var(--akzent, #1f5f8b); }
  .ust-waechter { border: 1px solid rgba(127,127,127,.3); border-radius: 12px; padding: 4px 14px; margin: 10px 0; } .ust-waechter.gelb { border-color: #c9a227; } .ust-waechter.rot { border-color: #c0392b; } .ust-waechter h2 { font-size: 17px; }
  .minus { color: var(--error); } .plus { color: var(--ok, #1a7f37); }
  .aueg-bz { display: block; margin-top: 2px; }
  .kraefte-liste { display: grid; gap: 6px; margin: 8px 0; } @media (min-width: 760px) { .kraefte-liste { grid-template-columns: 1fr 1fr; } }
  .kraft-zeile { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); cursor: pointer; }
  .kraft-zeile input { width: 20px; height: 20px; flex: none; margin: 0; } .kraft-zeile > span { display: grid; min-width: 0; }
  .einladungen-karten { display: grid; gap: 10px; margin: 10px 0; } @media (min-width: 760px) { .einladungen-karten { grid-template-columns: 1fr 1fr; } }
  .einladung-karte { display: grid; grid-template-columns: 112px 1fr; gap: 10px; align-items: start; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); break-inside: avoid; }
  .einladung-karte h3 { margin: 0 0 6px; } .einladung-karte .teilen { margin: 0 0 6px; } .einladung-karte .knopf { min-height: 34px; padding: 4px 12px; }
  .einladung-qr svg, svg.qr { display: block; width: 112px; height: 112px; }
  .nur-drucken { display: none; }
  @media print { .nicht-drucken, .konto-zurueck { display: none !important; } .nur-drucken { display: block; } .einladungen-karten { grid-template-columns: 1fr 1fr; } .einladung-karte { border: 1px solid #999; } .einladung-qr svg { width: 150px; height: 150px; } .einladung-karte { grid-template-columns: 150px 1fr; } }
  html[dir="rtl"] .konto-zurueck a { transform: scaleX(-1); display: inline-block; }
</style>
</head>
<body><main>
${kontoBereich !== undefined ? `<header class="konto-kopf"><a class="konto-marke" href="/konto">${ZEICHEN}<span><strong>Crewtender</strong><small>WP Digital Ranger</small></span></a><div class="konto-aktionen"><a class="profil-icon" href="/konto/profil" aria-label="Mein Profil" title="Mein Profil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></a></div></header>` : `<header class="oeffentlich-kopf"><a class="oeffentlich-marke" href="/">${ZEICHEN}<strong>Crewtender</strong></a><a class="oeffentlich-login" href="/konto">Anmelden</a></header>`}
${eigenerZurueck || (kontoBereich ? `<p class="konto-zurueck"><a href="/konto" aria-label="Zur Übersicht" title="Zur Übersicht"><span aria-hidden="true">←</span></a></p>` : "")}
${kopf}
${inhalt.replace(/<table(\s[^>]*)?>/g, '<div class="tabelle"><table$1>').replace(/<\/table>/g, "</table></div>")}
<p class="klein">WP Digital Ranger · <a href="/impressum">Impressum</a> · <a href="/hilfe">Hilfe</a> · <a href="/kontakt">Kontakt</a> · <a href="/datenschutz">Datenschutz</a> · <a href="/nutzungsbedingungen">Nutzungsbedingungen</a> · <a href="/avv">Auftragsverarbeitung</a></p>
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
  // The fixed heading of the Steckbrief (an anchor the app parses) reads from Crewtender' point of view; firms see "zu euch".
  md = md.replace(/^(#+\s*)Passt das zum Kunden\?/gm, "$1Passt das zu euch?");
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
