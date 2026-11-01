import { marked } from "marked";

// Page frame: plain HTML (the only script is /app.js, see app.ts), readable on a phone, light and dark.

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
  if (inhalt.trimStart().startsWith("<h1")) {
    kopf = "";
    inhalt = inhalt.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/, titelzeile);
  }
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
  .konto-marke > svg { width: 38px; height: 38px; flex: 0 0 38px; }
  .konto-marke > span { display: grid; line-height: 1.15; }
  .konto-marke strong { font-size: 1.08rem; }
  .konto-marke small { margin-top: 3px; color: var(--muted); font-size: .68rem; font-weight: 550; }
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
  .termin-neu form label:nth-of-type(3), .termin-neu form button { grid-column: 1 / -1; }
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
  .aueg-form label { margin: 0; } .aueg-form .ganz { grid-column: 1 / -1; }
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
</style>
</head>
<body><main>
${kontoBereich !== undefined ? `<header class="konto-kopf"><a class="konto-marke" href="/konto"><svg viewBox="0 0 128 128" aria-hidden="true"><rect x="2" y="2" width="124" height="124" rx="30" fill="#15324b"/><circle cx="64" cy="64" r="43" fill="none" stroke="#fff" stroke-opacity=".52" stroke-width="2"/><circle cx="64" cy="64" r="4" fill="#fff"/><path d="M64 18 77 62 64 56 51 62Z" fill="#ff6b35"/><path d="m64 110-13-44 13 6 13-6z" fill="#168aad"/><path d="m18 64 44-13-6 13 6 13zM110 64 66 77l6-13-6-13z" fill="#fff"/></svg><span><strong>Jarvis</strong><small>WP Digital Ranger</small></span></a><div class="konto-aktionen"><a class="profil-icon" href="/konto/profil" aria-label="Mein Profil" title="Mein Profil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></a></div></header>` : `<header><a href="/">Jarvis</a> · Ausschreibungs-Alarm · <a href="/konto">Konto</a></header>`}
${eigenerZurueck || (kontoBereich ? `<p class="konto-zurueck"><a href="/konto" aria-label="Zur Übersicht" title="Zur Übersicht"><span aria-hidden="true">←</span></a></p>` : "")}
${kopf}
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
