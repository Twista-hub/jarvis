// Three looks (Benjamin 04.11.2026, designs in docs/design/crewtender/app-entwuerfe/):
// - Hell "Glas" (standard): light blue background, frosted glass cards, glossy blue buttons, like the start page.
// - Dunkel "Premium": dark blue from the logo, glass cards, orange accent. Follows the phone's dark mode or the setting.
// - Technisch: control-room look, grid background, sharp panels, dark top and bottom bar, monospace figures.
// Only colours and surfaces change; the page structure stays the same for all three. Appended after the base styles.

const DUNKEL = `--bg: #0e2133; --text: #eef4f9; --muted: #93a9bd; --card: rgba(255,255,255,.06); --line: rgba(255,255,255,.12); --accent: #7cc3ea; --error: #ff9b80;
  --flaeche: radial-gradient(120% 60% at 15% 0%, #1d4466 0%, #10263a 45%, #0a1826 100%); --karte-schatten: 0 10px 28px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.07);
  --knopf: linear-gradient(180deg, #ff8a55, #f0612a); --knopf-text: #fff; --knopf-schatten: 0 6px 18px rgba(240,97,42,.32); --feld: rgba(255,255,255,.07); --leiste: rgba(10,24,38,.84); --aktiv: #ff8a55; --symbol-bg: rgba(255,255,255,.08); --symbol: #7cc3ea; --unschaerfe: blur(16px);`;

export const THEMEN_CSS = `
  /* ===== Hell · Glas (standard) ===== */
  :root { --bg: #e7f2fb; --text: #13283b; --muted: #557089; --card: rgba(255,255,255,.66); --line: rgba(31,95,139,.15); --accent: #1f6fa8; --error: #b3361d;
    --flaeche: linear-gradient(165deg, #eaf5fd 0%, #d6ebf9 45%, #c3e0f4 100%); --karte-schatten: 0 8px 26px rgba(31,95,139,.12), inset 0 1px 0 rgba(255,255,255,.9);
    --knopf: linear-gradient(180deg, #3a9ee0, #1d6fae); --knopf-text: #fff; --knopf-schatten: 0 6px 16px rgba(29,111,174,.3), inset 0 1px 0 rgba(255,255,255,.35);
    --feld: rgba(255,255,255,.8); --leiste: rgba(255,255,255,.74); --aktiv: #1f6fa8; --symbol-bg: linear-gradient(160deg, rgba(255,255,255,.95), rgba(220,238,251,.9)); --symbol: #1f6fa8;
    --unschaerfe: blur(14px) saturate(140%); --rund: 18px; }
  /* ===== Dunkel · Premium ===== */
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]):not([data-theme="technik"]) { ${DUNKEL} } }
  :root[data-theme="dark"] { ${DUNKEL} }
  /* ===== Technisch ===== */
  :root[data-theme="technik"] { --bg: #eef1f4; --text: #0f1d2b; --muted: #5d7083; --card: #fff; --line: #d5dce3; --accent: #0e7490; --error: #c2491b;
    --flaeche: #eef1f4; --karte-schatten: 0 1px 0 rgba(16,24,40,.04); --knopf: #0f2537; --knopf-text: #fff; --knopf-schatten: none; --feld: #fff; --leiste: #0f2537;
    --aktiv: #5fd0f0; --symbol-bg: transparent; --symbol: #0e7490; --unschaerfe: none; --rund: 6px; }

  /* Shared surfaces */
  body { background: var(--flaeche, var(--bg)); background-attachment: fixed; -webkit-font-smoothing: antialiased; }
  input, select, textarea { background: var(--feld, var(--bg)); }
  form, .konto-kachel, .treffer-karte, .laedt, .hilfe-inhalt, .reiter, .profil-icon, .konto-zurueck a, .oeffentlich-login, details.kalk-gruppe, .standort-zeile, table {
    backdrop-filter: var(--unschaerfe, none); -webkit-backdrop-filter: var(--unschaerfe, none); }
  form, .konto-kachel, .treffer-karte, .laedt { border-radius: var(--rund, 14px); box-shadow: var(--karte-schatten); }
  button:not(.zweit):not(.daumen):not(.gefahr):not(.gefahr-voll):not(.knopf-leise), .knopf:not(.zweit) { background: var(--knopf); color: var(--knopf-text, #fff); box-shadow: var(--knopf-schatten, none); }
  .reiter a[aria-current="page"] { background: var(--knopf); color: var(--knopf-text, #fff) !important; }
  h1 { letter-spacing: -.02em; }

  /* Overview head (step 2): greeting, key figures, next deadline */
  .begruessung { margin: -10px 0 14px; }
  .kennzahlen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; margin-bottom: 14px; }
  .kennzahl { display: flex; flex-direction: column; gap: 2px; padding: 12px; border: 1px solid var(--line); border-radius: var(--rund, 16px); background: var(--card); box-shadow: var(--karte-schatten);
    backdrop-filter: var(--unschaerfe, none); -webkit-backdrop-filter: var(--unschaerfe, none); color: var(--text); text-decoration: none; }
  .kennzahl strong { font-size: 1.55rem; line-height: 1.1; letter-spacing: -.02em; } .kennzahl span { font-size: 12px; color: var(--muted); line-height: 1.25; }
  .kennzahl.akzent strong { color: var(--aktiv); }
  .naechste-frist { padding: 15px 16px 16px; margin-bottom: 18px; border: 1px solid var(--line); border-radius: var(--rund, 18px); background: var(--card); box-shadow: var(--karte-schatten);
    backdrop-filter: var(--unschaerfe, none); -webkit-backdrop-filter: var(--unschaerfe, none); }
  .naechste-kopf { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .frist-pille { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px; background: rgba(31,111,168,.1); color: var(--accent); letter-spacing: .04em; }
  .frist-pille.knapp { background: rgba(232,105,46,.14); color: #d9582b; }
  .naechste-frist h2 { margin: 8px 0 6px; font-size: 1.08rem; line-height: 1.3; text-transform: none; letter-spacing: -.01em; color: var(--text); }
  .naechste-fakten { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; } .naechste-fakten span { font-size: 12.5px; font-weight: 600; padding: 4px 9px; border-radius: 999px; background: rgba(127,140,155,.12); }
  .naechste-frist .knopf { display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 1rem; }
  :root[data-theme="technik"] .kennzahl, :root[data-theme="technik"] .naechste-frist { border-color: #d5dce3; }
  :root[data-theme="technik"] .kennzahl strong, :root[data-theme="technik"] .frist-pille { font-family: ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace; }
  :root[data-theme="technik"] .kennzahl.akzent strong { color: #0e7490; }
  :root[data-theme="technik"] .frist-pille, :root[data-theme="technik"] .naechste-fakten span { border-radius: 3px; }

  /* Tiles: line icon in a soft square */
  .konto-symbol { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--symbol-bg); color: var(--symbol); font-size: 0; }
  :root:not([data-theme="technik"]) .konto-symbol { box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 2px 6px rgba(31,95,139,.1); }
  .konto-kachel strong { letter-spacing: -.01em; }

  /* Bottom bar: floating glass bar with line icons */
  .konto-nav .symbol-svg { width: 23px; height: 23px; }
  @media (max-width: 640px) {
    .konto-kacheln { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
    .konto-kachel { min-height: 112px; padding: 12px 10px; gap: 5px; border-radius: var(--rund, 16px); }
    .konto-kachel strong { font-size: .86rem; line-height: 1.2; hyphens: auto; }
    .konto-kachel .klein { font-size: 11.5px; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .konto-kachel .konto-pfeil { display: none; }
    .konto-nav { left: 10px; right: 10px; bottom: max(10px, env(safe-area-inset-bottom)); border: 1px solid var(--line); border-radius: 22px; padding: 7px 4px;
      background: var(--leiste); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 10px 28px rgba(0,0,0,.14); }
    .konto-nav a { color: var(--muted); }
    .konto-nav a[aria-current="page"] { color: var(--aktiv) !important; }
    main { padding-bottom: 110px; }
  }

  /* Technisch: sharp panels, grid paper, dark bars, monospace figures */
  :root[data-theme="technik"] body { background-color: #eef1f4; background-image: linear-gradient(#dfe5eb 1px, transparent 1px), linear-gradient(90deg, #dfe5eb 1px, transparent 1px); background-size: 24px 24px; }
  :root[data-theme="technik"] .konto-kopf { margin: -24px -16px 18px; padding: 12px 16px; background: #0f2537; color: #e8f1f8; }
  :root[data-theme="technik"] .konto-kopf .konto-marke, :root[data-theme="technik"] .konto-kopf .konto-marke strong { color: #e8f1f8; }
  :root[data-theme="technik"] .konto-kopf small { color: #8fb0c8; }
  :root[data-theme="technik"] .konto-kopf .profil-icon { background: transparent; border-color: #2c4a62; color: #9fe3c6; }
  :root[data-theme="technik"] main > h2 { font-size: .78rem; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); }
  :root[data-theme="technik"] .konto-kachel, :root[data-theme="technik"] form, :root[data-theme="technik"] .treffer-karte { border-color: #d5dce3; }
  :root[data-theme="technik"] .konto-kacheln { gap: 0; border: 1px solid #d5dce3; border-radius: 6px; overflow: hidden; background: #fff; }
  :root[data-theme="technik"] .konto-kachel { border: 0; border-right: 1px solid #e3e8ed; border-bottom: 1px solid #e3e8ed; border-radius: 0; box-shadow: none; }
  :root[data-theme="technik"] .konto-symbol { width: auto; height: auto; justify-content: start; }
  :root[data-theme="technik"] .treffer-fakten li, :root[data-theme="technik"] .frist-abstand, :root[data-theme="technik"] time, :root[data-theme="technik"] .punkte, :root[data-theme="technik"] td {
    font-family: ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace; }
  :root[data-theme="technik"] .treffer-fakten li { border-radius: 3px; border: 1px solid #dde5ec; background: #eef3f7; }
  @media (max-width: 640px) {
    :root[data-theme="technik"] .konto-nav { left: 0; right: 0; bottom: 0; border-radius: 0; border: 0; border-top: 1px solid #1f3a50; background: #0f2537; padding-bottom: max(7px, env(safe-area-inset-bottom)); }
    :root[data-theme="technik"] .konto-nav a { color: #8fb0c8; }
  }
`;
