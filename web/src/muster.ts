// Design sample page (/muster): every building block in the proposed new look, for Benjamin to judge on his phone
// before anything changes in the app. Sources (all free for commercial use): Tabler Icons (MIT), Inter (SIL OFL,
// served from our worker), colour scales from Radix Colors (MIT), component look modelled on shadcn/ui (MIT).
// Not linked from the app; noindex. ?dunkel=1 shows the dark version.
import { tabler as t } from "./tabler.ts";

const CSS = `
@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; font-display: swap; src: url(/schrift/inter-latin.woff2) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; font-display: swap; src: url(/schrift/inter-latin-ext.woff2) format("woff2"); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
:root {
  /* neutrals: Radix slate; brand: navy from the logo; accent: Radix orange 9; status: Radix red/green/amber */
  --bg: #f9f9fb; --flaeche: #fff; --flaeche2: #f0f0f3; --rand: #e0e1e6; --rand-stark: #cdced6;
  --text: #1c2024; --text2: #60646c; --text3: #8b8d98;
  --marke: #15324b; --marke-hell: #e8eef4; --marke-text: #fff; --akzent: #f76b15; --akzent-hell: #ffefd6; --akzent-text: #cc4e00;
  --rot: #e5484d; --rot-hell: #feebec; --rot-text: #ce2c31; --gruen: #30a46c; --gruen-hell: #e6f6eb; --gruen-text: #218358;
  --gelb: #ffc53d; --gelb-hell: #fff7c2; --gelb-text: #ab6400;
  --radius: 12px; --radius-gross: 16px;
  --schatten: 0 1px 2px rgb(28 32 36 / .05), 0 1px 3px rgb(28 32 36 / .06);
  --schatten-hoch: 0 4px 6px -1px rgb(28 32 36 / .06), 0 12px 24px -6px rgb(21 50 75 / .12);
  --ring: 0 0 0 3px rgb(21 50 75 / .18);
}
:root[data-theme="dark"] {
  --bg: #111113; --flaeche: #18191b; --flaeche2: #212225; --rand: #2e3135; --rand-stark: #43484e;
  --text: #edeef0; --text2: #b0b4ba; --text3: #777b84;
  --marke: #8cc4ee; --marke-hell: #1b2a38; --marke-text: #0b1620; --akzent: #f76b15; --akzent-hell: #331e0b; --akzent-text: #ffa057;
  --rot-hell: #3b1219; --rot-text: #ff9592; --gruen-hell: #132d21; --gruen-text: #3dd68c; --gelb-hell: #302008; --gelb-text: #ffca16;
  --schatten: 0 1px 2px rgb(0 0 0 / .4); --schatten-hoch: 0 8px 24px rgb(0 0 0 / .5); --ring: 0 0 0 3px rgb(140 196 238 / .3);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased; }
main { max-width: 760px; margin: 0 auto; padding: 20px 16px 110px; }
h1 { font-size: 1.75rem; line-height: 1.15; letter-spacing: -.025em; font-weight: 700; margin: 0 0 6px; }
h2 { font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text3); font-weight: 600; margin: 36px 0 12px; }
h3 { font-size: 1rem; letter-spacing: -.01em; font-weight: 600; margin: 0 0 4px; }
p { margin: 0 0 12px; } .leise { color: var(--text2); } .klein { font-size: .82rem; color: var(--text2); }
a { color: var(--marke); }
.ti { width: 20px; height: 20px; flex: none; }
.reihe { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.raster { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
/* top bar */
.kopf { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.marke { display: flex; align-items: center; gap: 10px; font-weight: 650; letter-spacing: -.01em; color: var(--text); text-decoration: none; }
.marke svg { width: 32px; height: 32px; }
.marke small { display: block; font-size: .7rem; color: var(--text3); font-weight: 500; }
.rund { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--rand); background: var(--flaeche); color: var(--text2); }
/* buttons (shadcn variants) */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 16px; border-radius: var(--radius); border: 1px solid transparent; font: inherit; font-weight: 550; font-size: .93rem; text-decoration: none; cursor: pointer; transition: background .15s, box-shadow .15s; }
.btn:focus-visible { outline: none; box-shadow: var(--ring); }
.btn-primaer { background: var(--marke); color: var(--marke-text); }
.btn-akzent { background: var(--akzent); color: #fff; box-shadow: 0 6px 14px rgb(247 107 21 / .25); }
.btn-zweit { background: var(--flaeche2); color: var(--text); }
.btn-rand { background: var(--flaeche); color: var(--text); border-color: var(--rand); box-shadow: var(--schatten); }
.btn-geist { background: transparent; color: var(--text2); }
.btn-gefahr { background: var(--rot); color: #fff; }
.btn-klein { height: 34px; padding: 0 12px; font-size: .85rem; border-radius: 10px; }
.btn-gross { height: 50px; font-size: 1rem; width: 100%; }
.btn-icon { width: 42px; padding: 0; }
/* inputs */
.feld { display: grid; gap: 6px; margin-bottom: 14px; }
.feld label { font-size: .85rem; font-weight: 550; }
.feld .hilfe { font-size: .78rem; color: var(--text3); }
.eingabe { height: 42px; padding: 0 12px; border: 1px solid var(--rand); border-radius: var(--radius); background: var(--flaeche); color: var(--text); font: inherit; width: 100%; box-shadow: var(--schatten); }
textarea.eingabe { height: auto; min-height: 84px; padding: 10px 12px; resize: vertical; }
.eingabe:focus { outline: none; border-color: var(--marke); box-shadow: var(--ring); }
.mit-icon { position: relative; } .mit-icon .ti { position: absolute; left: 12px; top: 11px; color: var(--text3); } .mit-icon .eingabe { padding-left: 40px; }
.fehler .eingabe { border-color: var(--rot); } .fehler .hilfe { color: var(--rot-text); }
.check { display: flex; gap: 10px; align-items: flex-start; font-size: .93rem; margin-bottom: 10px; }
.check input { width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--marke); }
.schalter { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--rand); }
.schalter input { appearance: none; width: 42px; height: 24px; border-radius: 999px; background: var(--rand-stark); position: relative; cursor: pointer; transition: background .2s; margin: 0; }
.schalter input::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / .2); transition: transform .2s; }
.schalter input:checked { background: var(--marke); } .schalter input:checked::after { transform: translateX(18px); }
.segment { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: 4px; border-radius: var(--radius); background: var(--flaeche2); }
.segment a { padding: 7px 10px; border-radius: 9px; text-align: center; font-size: .88rem; font-weight: 550; color: var(--text2); text-decoration: none; }
.segment a[aria-current] { background: var(--flaeche); color: var(--text); box-shadow: var(--schatten); }
/* badges */
.abz { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px; font-size: .76rem; font-weight: 600; background: var(--flaeche2); color: var(--text2); }
.abz .ti { width: 14px; height: 14px; }
.abz-marke { background: var(--marke-hell); color: var(--marke); } .abz-gruen { background: var(--gruen-hell); color: var(--gruen-text); }
.abz-gelb { background: var(--gelb-hell); color: var(--gelb-text); } .abz-rot { background: var(--rot-hell); color: var(--rot-text); }
.abz-akzent { background: var(--akzent-hell); color: var(--akzent-text); }
.punkt { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
/* alerts */
.hinweis { display: flex; gap: 12px; padding: 12px 14px; border-radius: var(--radius); border: 1px solid var(--rand); background: var(--flaeche); margin-bottom: 10px; font-size: .9rem; }
.hinweis strong { display: block; margin-bottom: 2px; }
.hinweis-info { background: var(--marke-hell); border-color: transparent; } .hinweis-info .ti { color: var(--marke); }
.hinweis-ok { background: var(--gruen-hell); border-color: transparent; } .hinweis-ok .ti { color: var(--gruen-text); }
.hinweis-warn { background: var(--gelb-hell); border-color: transparent; } .hinweis-warn .ti { color: var(--gelb-text); }
.hinweis-fehler { background: var(--rot-hell); border-color: transparent; } .hinweis-fehler .ti { color: var(--rot-text); }
/* cards */
.karte { background: var(--flaeche); border: 1px solid var(--rand); border-radius: var(--radius-gross); padding: 16px; box-shadow: var(--schatten); }
.zahl { display: block; text-decoration: none; color: var(--text); }
.zahl .wert { font-size: 1.7rem; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.zahl .was { font-size: .82rem; color: var(--text2); }
.zahl .trend { margin-top: 8px; font-size: .75rem; color: var(--gruen-text); font-weight: 600; display: flex; align-items: center; gap: 4px; }
.zahl.dringend .wert { color: var(--rot-text); }
.kachel { display: flex; flex-direction: column; gap: 4px; text-decoration: none; color: var(--text); min-height: 112px; }
.symbolfeld { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: var(--marke-hell); color: var(--marke); margin-bottom: 8px; }
.kachel strong { font-weight: 600; letter-spacing: -.01em; }
.kachel span { font-size: .8rem; color: var(--text2); line-height: 1.35; }
.kachel .warn { color: var(--gelb-text); font-weight: 600; }
/* hit card */
.treffer { padding: 0; overflow: hidden; }
.treffer .innen { padding: 16px; }
.treffer .oben { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.treffer h3 { font-size: 1.02rem; line-height: 1.35; margin-bottom: 10px; }
.fakten { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.fakt { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 8px; background: var(--flaeche2); font-size: .8rem; color: var(--text2); }
.fakt b { color: var(--text); font-weight: 600; } .fakt .ti { width: 14px; height: 14px; }
.warum { font-size: .9rem; color: var(--text2); margin: 0; }
.treffer .unten { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid var(--rand); background: var(--bg); }
.frist { display: flex; align-items: center; gap: 6px; font-size: .85rem; font-weight: 600; color: var(--gelb-text); }
/* list */
.liste { padding: 4px 0; }
.zeile { display: flex; align-items: center; gap: 12px; padding: 12px 16px; text-decoration: none; color: var(--text); }
.zeile + .zeile { border-top: 1px solid var(--rand); }
.zeile .mitte { flex: 1; min-width: 0; }
.zeile .mitte span { display: block; font-size: .8rem; color: var(--text2); }
.zeile > .ti:last-child { color: var(--text3); }
.avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--akzent-hell); color: var(--akzent-text); font-weight: 650; font-size: .85rem; }
/* table */
.tabelle { width: 100%; border-collapse: collapse; font-size: .88rem; }
.tabelle th { text-align: left; font-weight: 550; color: var(--text2); padding: 10px 12px; border-bottom: 1px solid var(--rand); font-size: .78rem; }
.tabelle td { padding: 11px 12px; border-bottom: 1px solid var(--rand); }
.tabelle tr:last-child td { border-bottom: 0; }
.tabelle .rechts { text-align: right; font-variant-numeric: tabular-nums; }
/* progress, empty */
.fortschritt { height: 8px; border-radius: 999px; background: var(--flaeche2); overflow: hidden; } .fortschritt i { display: block; height: 100%; width: 62%; background: var(--marke); border-radius: 999px; }
.leer { text-align: center; padding: 28px 16px; } .leer .symbolfeld { margin: 0 auto 12px; width: 48px; height: 48px; border-radius: 14px; }
/* bottom bar */
.leiste { position: fixed; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(4, 1fr); padding: 8px 6px max(10px, env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--flaeche) 88%, transparent); backdrop-filter: saturate(1.6) blur(12px); border-top: 1px solid var(--rand); }
.leiste a { display: grid; justify-items: center; gap: 2px; padding: 4px 0; font-size: 11px; font-weight: 550; color: var(--text3); text-decoration: none; }
.leiste a[aria-current] { color: var(--marke); } .leiste .ti { width: 24px; height: 24px; }
.farbfeld { height: 44px; border-radius: 10px; border: 1px solid var(--rand); } .farben { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; } .farben div span { font-size: .72rem; color: var(--text2); }
.trenner { height: 1px; background: var(--rand); margin: 14px 0; border: 0; }
`;

const LOGO = '<svg viewBox="0 0 128 128" aria-hidden="true"><rect x="2" y="2" width="124" height="124" rx="30" fill="#15324b"/><circle cx="64" cy="64" r="43" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><circle cx="64" cy="64" r="4" fill="#fff"/><path d="M64 18 77 62 64 56 51 62Z" fill="#ff6b35"/><path d="m64 110-13-44 13 6 13-6z" fill="#168aad"/><path d="m18 64 44-13-6 13 6 13zM110 64 66 77l6-13-6-13z" fill="#fff"/></svg>';

export function musterSeite(dunkel: boolean): string {
  const kachel = (ic: string, titel: string, text: string) => `<a class="karte kachel" href="#"><span class="symbolfeld">${t(ic)}</span><strong>${titel}</strong><span>${text}</span></a>`;
  return `<!doctype html><html lang="de"${dunkel ? ' data-theme="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Designmuster · Jarvis</title><link rel="preload" href="/schrift/inter-latin.woff2" as="font" type="font/woff2" crossorigin><style>${CSS}</style></head><body><main>
<div class="kopf"><a class="marke" href="/">${LOGO}<span>Jarvis<small>WP Digital Ranger</small></span></a><a class="rund" href="/muster${dunkel ? "" : "?dunkel=1"}" aria-label="Hell/Dunkel">${t(dunkel ? "sun" : "moon")}</a></div>
<h1>Designmuster</h1><p class="leise">Alle Bausteine im neuen Stil. Noch nicht in der App, nur zum Anschauen. Oben rechts zwischen hell und dunkel wechseln.</p>

<h2>So könnte die Übersicht aussehen</h2>
<p class="leise" style="margin-bottom:4px">Guten Morgen, Benjamin</p><h1 style="font-size:1.45rem;margin-bottom:14px">Perlease GmbH</h1>
<div class="raster">
<a class="karte zahl" href="#"><div class="wert">2</div><div class="was">neue Treffer</div><div class="trend">${t("trending-up")} 3 mehr als letzte Woche</div></a>
<a class="karte zahl dringend" href="#"><div class="wert">7 Tage</div><div class="was">bis zur nächsten Frist</div></a>
<a class="karte zahl" href="#"><div class="wert">4</div><div class="was">Angebote warten auf Freigabe</div></a>
<a class="karte zahl" href="#"><div class="wert">5</div><div class="was">Nachweise laufen ab</div></a>
</div>
<div class="raster" style="margin-top:10px">
${kachel("file-text", "Ausschreibungen", "2 offene Treffer")}${kachel("clock", "Fristen", "1 Frist diese Woche")}${kachel("inbox", "Unterlagen", '<span class="warn">5 Nachweise laufen ab</span>')}${kachel("pencil", "Angebote", "2 in Arbeit · 1 abgegeben")}${kachel("calculator", "Kalkulation", "Preise pro Stunde und Los")}${kachel("users", "Firma & Team", "4 Zugänge · 2 Standorte")}
</div>

<h2>Treffer-Karte</h2>
<div class="karte treffer"><div class="innen"><div class="oben"><span class="abz abz-gruen"><span class="punkt"></span>9/10 passt sehr gut</span><span class="abz abz-marke">Neu</span></div>
<h3>Unterhaltsreinigung Schulen und Verwaltung, Stadt Musterstadt</h3>
<div class="fakten"><span class="fakt"><b>3</b> Lose</span><span class="fakt">Wert <b>1,4 Mio. €</b></span><span class="fakt">Laufzeit <b>48 Monate</b></span><span class="fakt">${t("map-pin")}<b>12 km</b></span></div>
<p class="warum">Unterhalts- und Glasreinigung gehört zu euren Kernleistungen; drei getrennte Lose, Los 2 liegt direkt am Standort Aachen.</p></div>
<div class="unten"><span class="frist">${t("clock")} Abgabe 20.11. · noch 18 Tage</span><div class="reihe"><a class="btn btn-rand btn-klein btn-icon" href="#" aria-label="Merken">${t("bookmark")}</a><a class="btn btn-rand btn-klein btn-icon" href="#" aria-label="Passt nicht">${t("thumb-down")}</a></div></div></div>

<h2>Knöpfe</h2>
<div class="reihe"><a class="btn btn-primaer" href="#">${t("upload")} Unterlagen hochladen</a><a class="btn btn-akzent" href="#">Kostenlos starten ${t("arrow-right")}</a></div>
<div class="reihe" style="margin-top:8px"><a class="btn btn-rand" href="#">${t("download")} Herunterladen</a><a class="btn btn-zweit" href="#">Abbrechen</a><a class="btn btn-geist" href="#">Später</a><a class="btn btn-gefahr btn-klein" href="#">${t("trash")} Löschen</a></div>

<h2>Eingaben</h2>
<div class="karte">
<div class="feld"><label for="f1">Firmenname</label><input id="f1" class="eingabe" value="Perlease GmbH"></div>
<div class="feld mit-icon"><label for="f2">Suche</label><div class="mit-icon">${t("search")}<input id="f2" class="eingabe" placeholder="Im Titel suchen"></div></div>
<div class="feld"><label for="f3">Bereich</label><select id="f3" class="eingabe"><option>Alle Bereiche</option><option>Standort Aachen</option></select></div>
<div class="feld fehler"><label for="f4">E-Mail</label><input id="f4" class="eingabe" value="chef@"><span class="hilfe">Bitte eine vollständige E-Mail-Adresse eingeben.</span></div>
<div class="feld"><label for="f5">Notiz</label><textarea id="f5" class="eingabe" placeholder="Was ist bei diesem Auftrag wichtig?"></textarea></div>
<label class="check"><input type="checkbox" checked> <span>Fristen-Erinnerungen per Mail</span></label>
<div class="schalter"><span>Handy-Nachricht bei Top-Treffern</span><input type="checkbox" checked aria-label="Handy-Nachricht"></div>
<div class="schalter" style="border:0"><span>Dunkelmodus</span><input type="checkbox" aria-label="Dunkelmodus"></div>
</div>
<div class="segment" style="margin-top:12px"><a href="#" aria-current="page">Neu</a><a href="#">In Arbeit</a><a href="#">Abgegeben</a><a href="#">Archiv</a></div>

<h2>Abzeichen</h2>
<div class="reihe"><span class="abz abz-gruen"><span class="punkt"></span>gewonnen</span><span class="abz abz-gelb"><span class="punkt"></span>läuft bald ab</span><span class="abz abz-rot"><span class="punkt"></span>überfällig</span><span class="abz abz-marke">Angebot in Arbeit</span><span class="abz abz-akzent">${t("award")} Top-Treffer</span><span class="abz">Archiv</span></div>

<h2>Hinweise</h2>
<div class="hinweis hinweis-info">${t("info-circle")}<div><strong>Unterlagen fehlen noch</strong>Lose und Mengen stehen meist erst in den Vergabeunterlagen.</div></div>
<div class="hinweis hinweis-ok">${t("circle-check")}<div><strong>Gespeichert</strong>Dein Suchprofil ist aktualisiert.</div></div>
<div class="hinweis hinweis-warn">${t("alert-triangle")}<div><strong>Betriebshaftpflicht läuft in 14 Tagen ab</strong>Neue Police hochladen, damit sie in Angeboten mitgeht.</div></div>
<div class="hinweis hinweis-fehler">${t("x")}<div><strong>Hochladen fehlgeschlagen</strong>Die Datei ist größer als 50 MB.</div></div>

<h2>Liste</h2>
<div class="karte liste">
<a class="zeile" href="#"><span class="avatar">LD</span><span class="mitte"><strong>Lisa Dispo</strong><span>Bearbeiterin · Standort Aachen</span></span>${t("chevron-right")}</a>
<a class="zeile" href="#"><span class="symbolfeld" style="margin:0">${t("building-bank")}</span><span class="mitte"><strong>Deutsche Bundesbank</strong><span>3 Ausschreibungen · 1 gewonnen</span></span>${t("chevron-right")}</a>
<a class="zeile" href="#"><span class="symbolfeld" style="margin:0">${t("file-certificate")}</span><span class="mitte"><strong>Präqualifikation VOB</strong><span>gültig bis 30.06.2027</span></span><span class="abz abz-gruen">gültig</span></a>
</div>

<h2>Tabelle</h2>
<div class="karte" style="padding:4px 4px"><table class="tabelle"><thead><tr><th>Los</th><th>Leistung</th><th class="rechts">Stunden</th><th class="rechts">Preis/Std.</th></tr></thead><tbody>
<tr><td>1</td><td>Küche</td><td class="rechts">4.160</td><td class="rechts">31,40 €</td></tr><tr><td>2</td><td>Service</td><td class="rechts">6.240</td><td class="rechts">29,90 €</td></tr><tr><td>3</td><td>Bankett</td><td class="rechts">1.040</td><td class="rechts">34,10 €</td></tr></tbody></table></div>

<h2>Fortschritt und Leerzustand</h2>
<div class="karte"><div class="reihe" style="justify-content:space-between;margin-bottom:8px"><strong>Jarvis prüft die Unterlagen</strong><span class="klein">3 von 5 Dateien</span></div><div class="fortschritt"><i></i></div></div>
<div class="karte leer" style="margin-top:10px"><div class="symbolfeld">${t("search")}</div><h3>Noch keine Treffer</h3><p class="leise">Jarvis sucht jeden Morgen um 6 Uhr. Die ersten Treffer kommen morgen früh.</p><a class="btn btn-rand btn-klein" href="#">Suchprofil ansehen</a></div>

<h2>Farben und Schrift</h2>
<div class="farben"><div><div class="farbfeld" style="background:var(--marke)"></div><span>Marke</span></div><div><div class="farbfeld" style="background:var(--akzent)"></div><span>Akzent</span></div><div><div class="farbfeld" style="background:var(--gruen)"></div><span>Erfolg</span></div><div><div class="farbfeld" style="background:var(--rot)"></div><span>Dringend</span></div></div>
<p style="margin-top:14px;font-size:1.6rem;font-weight:700;letter-spacing:-.025em;line-height:1.2">Schrift Inter, Überschrift</p><p>Fließtext in Inter: klar, ruhig und auch klein gut lesbar. Zahlen stehen sauber untereinander: 1.234,56 €.</p>
<p class="klein">Quellen: Tabler Icons (MIT), Inter (SIL Open Font License, auf unserem Server), Farbabstufungen von Radix Colors (MIT), Gestaltung nach shadcn/ui (MIT).</p>
</main>
<nav class="leiste"><a href="#" aria-current="page">${t("home")}Übersicht</a><a href="#">${t("search")}Treffer</a><a href="#">${t("clock")}Fristen</a><a href="#">${t("dots")}Mehr</a></nav>
</body></html>`;
}

export function muster(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== "/muster" || request.method !== "GET") return null;
  return new Response(musterSeite(url.searchParams.get("dunkel") === "1"), { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-cache", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" } });
}
