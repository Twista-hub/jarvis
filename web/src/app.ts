// The small amount of browser code: start the upload as soon as a file is chosen, switch on phone
// notifications, and the service worker that shows them and opens the right page on tap.
// Served from our own origin, so the content security policy only needs script-src 'self'.
import { ICON_192, ICON_512 } from "./icons.ts";
import { ARBEITSAUSWAHL_JS } from "./arbeitsauswahl-browser.ts";
import { SUCH_AKTION_JS } from "./suchaktionen.ts";
import { SUCHSTATUS_JS } from "./suchstatus.ts";

export const APP_JS = `"use strict";
// Own scope, so names like "status" do not collide with window properties.
(function () {
document.querySelectorAll("input[data-sofort]").forEach(function (i) {
  i.addEventListener("change", function () {
    if (i.files.length) { i.form.querySelector("button").textContent = "Wird hochgeladen …"; i.form.requestSubmit(); }
  });
});

${ARBEITSAUSWAHL_JS}
${SUCH_AKTION_JS}
${SUCHSTATUS_JS}
// Mail links (login, confirmation, new password) bring the login in the URL fragment; hand it to the server.
var anmeldung = document.getElementById("anmeldung");
if (anmeldung) {
  var h = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname + location.search);
  var fehlgeschlagen = function () { anmeldung.hidden = true; document.getElementById("anmeldung-fehler").hidden = false; };
  if (h.get("access_token") && h.get("refresh_token")) {
    fetch("/anmelden/sitzung", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_in: Number(h.get("expires_in")), typ: h.get("type") || "", weiter: anmeldung.dataset.weiter }) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) { location.replace(d.weiter); })
      .catch(fehlgeschlagen);
  } else fehlgeschlagen();
}

// Upload form: a tender picked from the list needs no title.
document.querySelectorAll("select[data-auswahl]").forEach(function (w) {
  var neu = w.form.querySelector("[data-neu]");
  var titel = neu && neu.querySelector("input[name=titel]");
  function zeigen() { if (!neu) return; neu.hidden = !!w.value; if (titel) titel.required = !w.value; }
  w.addEventListener("change", zeigen);
  zeigen();
});

// Firm documents: the picked kind fills the name; only "other" needs one typed in.
document.querySelectorAll("select[data-vorschlag]").forEach(function (w) {
  var feld = w.form.querySelector("[data-bezeichnung]");
  var name = feld && feld.querySelector("input");
  function zeigen(geaendert) {
    if (!feld) return;
    var sonst = w.value === "__sonst";
    feld.hidden = !sonst;
    name.required = sonst;
    if (geaendert) { name.value = ""; if (sonst) name.focus(); }
  }
  w.required = true;
  w.addEventListener("change", function () { zeigen(true); });
  zeigen(false);
});

// Calculation: show only the chosen lot.
document.querySelectorAll("select[data-los-wahl]").forEach(function (w) {
  w.addEventListener("change", function () {
    w.form.querySelectorAll("fieldset[data-los]").forEach(function (f) { f.hidden = !!w.value && f.getAttribute("data-los") !== w.value; });
  });
});

// Calculation: live price per hour (same formula as stundenpreis in kalkulation.ts), section summaries, tariff wage.
document.querySelectorAll("[data-live-satz]").forEach(function (anzeige) {
  var form = anzeige.closest("form");
  function wert(name) { var i = form.querySelector('[name="' + name + '"]'); return i ? Number(String(i.value).replace(/\./g, "").replace(",", ".")) || 0 : 0; }
  function auf(x, p) { return x * (1 + p / 100); }
  function rechnen() {
    var zuschlag = wert("zuschlaege") + (wert("anteilNacht") * wert("zuschlagNacht") + wert("anteilSonntag") * wert("zuschlagSonntag") + wert("anteilFeiertag") * wert("zuschlagFeiertag") + wert("anteilUeber") * wert("zuschlagUeber")) / 100;
    var personal = auf(auf(auf(wert("lohn"), wert("nebenkosten")), wert("ausfall")), zuschlag);
    var einsatz = (wert("stundenTag") > 0 ? (wert("fahrt") + wert("verpflegung")) / wert("stundenTag") : 0) + (wert("stundenKraft") > 0 ? wert("einmalig") / wert("stundenKraft") : 0) + wert("sonstiges");
    var preis = auf(auf(personal, wert("gemeinkosten")) + einsatz, wert("gewinn"));
    anzeige.querySelector("strong").textContent = preis.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    form.querySelectorAll("[data-gruppe]").forEach(function (g) {
      var teile = [];
      g.querySelectorAll("input[data-einheit]").forEach(function (i) { if (teile.length < 4 && Number(String(i.value).replace(",", ".")) ) teile.push(i.value + " " + i.dataset.einheit); });
      var kurz = g.querySelector(".kalk-kurz"); if (kurz) kurz.textContent = teile.join(" · ") || "keine Werte";
    });
  }
  form.addEventListener("input", rechnen);
  var tarif = form.querySelector("[data-lohn-aus-tarif]");
  if (tarif) tarif.addEventListener("change", function () { var lohn = form.querySelector('[name="lohn"]'); if (tarif.value && lohn) { lohn.value = tarif.value; rechnen(); } });
});
document.querySelectorAll("[data-drucken]").forEach(function (b) { b.addEventListener("click", function () { window.print(); }); });
// Team chat: every 15 s ask whether a newer message exists; reload only when nothing is being typed and the tab is visible.
document.querySelectorAll("[data-chat-stand]").forEach(function (v) {
  var stand = v.getAttribute("data-chat-stand") || "", url = v.getAttribute("data-chat-pruefen");
  var feld = document.querySelector(".chat-form textarea");
  if (!url) return;
  setInterval(function () {
    if (document.hidden || (feld && feld.value.trim())) return;
    fetch(url, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.letzte && d.letzte !== stand) location.reload();
    }).catch(function () {});
  }, 15000);
});
// Display settings: stored in a cookie so the server draws the page in the chosen look right away.
(function () {
  var wahl = (document.cookie.match(/(?:^|;\s*)jv_darstellung=([a-z-]+)/) || [])[1] || "";
  var theme = wahl.indexOf("dark") >= 0 ? "dark" : wahl.indexOf("light") >= 0 ? "light" : "";
  var schrift = wahl.indexOf("gross") >= 0 ? "gross" : "";
  document.querySelectorAll("[data-darstellung]").forEach(function (sel) {
    sel.value = sel.dataset.darstellung === "theme" ? theme : schrift;
    sel.addEventListener("change", function () {
      if (sel.dataset.darstellung === "theme") theme = sel.value; else schrift = sel.value;
      var wert = [theme, schrift].filter(Boolean).join("-");
      document.cookie = "jv_darstellung=" + (wert || "auto") + "; Path=/; Max-Age=31536000; SameSite=Lax; Secure";
      if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
      if (schrift) document.documentElement.dataset.schrift = schrift; else delete document.documentElement.dataset.schrift;
    });
  });
})();
// Search profile: warn about the paid re-scoring only when fields that change the scores were edited.
document.querySelectorAll("form[data-kosten-warnung]").forEach(function (form) {
  var hinweis = form.querySelector("[data-kosten-hinweis]");
  function stand() {
    return Array.prototype.map.call(form.elements, function (e) {
      if (!e.name || !/^(l\d+_|o\d+_|ausschluss|beschreibung|website_beschreibung|websuche_beschreibung|laender|suchgebiet_modus)/.test(e.name)) return "";
      return e.name + "=" + (e.type === "checkbox" || e.type === "radio" ? e.checked : e.value);
    }).join("&");
  }
  var anfang = stand();
  function pruefen() { if (hinweis) hinweis.hidden = stand() === anfang; }
  form.addEventListener("input", pruefen);
  form.addEventListener("change", pruefen);
  form.addEventListener("click", function () { setTimeout(pruefen, 0); });
});
// Hit list: the bulk bar appears as soon as hits are ticked.
(function () {
  var leiste = document.getElementById("massen");
  if (!leiste) return;
  var zahl = leiste.querySelector("[data-massen-zahl]");
  function zeigen() {
    var n = document.querySelectorAll("input[data-massen]:checked").length;
    leiste.hidden = n === 0;
    if (zahl) zahl.textContent = n + " ausgewählt";
  }
  document.querySelectorAll("input[data-massen]").forEach(function (c) { c.addEventListener("change", zeigen); });
})();
// Search fields that filter a list on the page as you type.
document.querySelectorAll("[data-listenfilter]").forEach(function (f) {
  var liste = document.getElementById(f.dataset.listenfilter);
  if (!liste) return;
  f.addEventListener("input", function () {
    var q = f.value.trim().toLowerCase();
    liste.querySelectorAll("li").forEach(function (li) { li.hidden = q !== "" && li.textContent.toLowerCase().indexOf(q) < 0; });
  });
});
// File fields highlight while files are dragged over them (desktop).
document.querySelectorAll('input[type="file"]').forEach(function (i) {
  ["dragenter", "dragover"].forEach(function (e) { i.addEventListener(e, function () { i.classList.add("ziehen"); }); });
  ["dragleave", "drop"].forEach(function (e) { i.addEventListener(e, function () { i.classList.remove("ziehen"); }); });
});
// Dropdowns that apply right away (filters, message topic).
document.querySelectorAll("[data-sofort-wahl]").forEach(function (w) {
  w.addEventListener("change", function () { w.form.submit(); });
});
// T39/T40: signature with finger or mouse; the drawing goes into a hidden field as PNG when the form is sent.
document.querySelectorAll("canvas[data-unterschrift]").forEach(function (c) {
  var feld = c.form ? c.form.querySelector('input[name="' + c.getAttribute("data-unterschrift") + '"]') : null;
  if (!feld) return;
  var ctx = c.getContext("2d"), malt = false, gemalt = false;
  ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#102a43";
  function punkt(e) { var r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; }
  c.addEventListener("pointerdown", function (e) { malt = true; var p = punkt(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); c.setPointerCapture(e.pointerId); e.preventDefault(); });
  c.addEventListener("pointermove", function (e) { if (!malt) return; var p = punkt(e); ctx.lineTo(p.x, p.y); ctx.stroke(); gemalt = true; e.preventDefault(); });
  ["pointerup", "pointercancel"].forEach(function (n) { c.addEventListener(n, function () { malt = false; }); });
  var leeren = c.parentNode.querySelector("[data-unterschrift-leeren]");
  if (leeren) leeren.addEventListener("click", function () { ctx.clearRect(0, 0, c.width, c.height); gemalt = false; feld.value = ""; });
  c.form.addEventListener("submit", function (e) {
    if (gemalt) feld.value = c.toDataURL("image/png");
    else if (c.hasAttribute("data-pflicht") && !(e.submitter && e.submitter.hasAttribute("data-ohne-unterschrift"))) { e.preventDefault(); alert("Bitte zuerst unterschreiben."); }
  });
});
// Demo: nothing is saved; forms show a short note instead.
if (document.body && document.body.hasAttribute("data-demo")) document.addEventListener("submit", function (e) { e.preventDefault(); e.stopImmediatePropagation(); alert("Das ist die Demo mit Beispieldaten – hier wird nichts gespeichert. Registriere dich kostenlos, um Crewtender mit deiner Firma zu nutzen."); }, true);
// Links inside a pop-up (e.g. "Hier hochladen") close it before jumping.
document.querySelectorAll("[popover] a").forEach(function (a) { a.addEventListener("click", function () { var p = a.closest("[popover]"); if (p && p.hidePopover) p.hidePopover(); }); });
// T41: time clock buttons ask for the position once (only to check "at the site"; the coordinates are not stored).
document.querySelectorAll("form[data-standort]").forEach(function (f) {
  f.addEventListener("submit", function (e) {
    if (f.dataset.fertig || !navigator.geolocation) return;
    e.preventDefault();
    var knopf = e.submitter;
    function weiter() { f.dataset.fertig = "1"; if (knopf && knopf.name) { var h = document.createElement("input"); h.type = "hidden"; h.name = knopf.name; h.value = knopf.value; f.appendChild(h); } f.submit(); }
    navigator.geolocation.getCurrentPosition(function (p) {
      f.querySelector('input[name="lat"]').value = p.coords.latitude.toFixed(4);
      f.querySelector('input[name="lon"]').value = p.coords.longitude.toFixed(4);
      weiter();
    }, weiter, { timeout: 6000, maximumAge: 120000 });
  });
});
// Direct links from the employee form open the tariff manager on "Firma & Team".
// The same for any folded section named in the address (e.g. back to an edited worker: #bearbeiten-<id>).
if (/^#[A-Za-z0-9_-]{1,80}$/.test(location.hash)) {
  var ziel = document.getElementById(location.hash.slice(1));
  if (ziel && ziel.tagName === "DETAILS") ziel.open = true;
}
// An employee's wage group is specific to the selected tariff agreement.
document.querySelectorAll("select[data-tarifvertrag]").forEach(function (tarif) {
  var gruppe = tarif.form.querySelector("select[data-tarifgruppen]");
  if (!gruppe) return;
  function filtern() {
    Array.prototype.forEach.call(gruppe.options, function (option) {
      option.disabled = !!option.value && option.getAttribute("data-tarifvertrag") !== tarif.value;
    });
    if (gruppe.selectedOptions.length && gruppe.selectedOptions[0].disabled) gruppe.value = "";
    gruppe.disabled = !tarif.value;
  }
  tarif.addEventListener("change", filtern);
  filtern();
});
// Choosing the Standortleitung role immediately exposes its one-site assignment picker.
document.querySelectorAll("select[data-rolle]").forEach(function (rolle) {
  var form = rolle.form;
  var mehrfach = form.querySelector("[data-bereiche-mehrfach]");
  var einzel = form.querySelector("[data-bereich-einzel]");
  if (!mehrfach || !einzel) return;
  function wechseln() {
    var istLeitung = rolle.value === "standortleitung";
    mehrfach.hidden = istLeitung;
    einzel.hidden = !istLeitung;
    Array.prototype.forEach.call(mehrfach.querySelectorAll("input"), function (i) { i.disabled = istLeitung; });
    Array.prototype.forEach.call(einzel.querySelectorAll("input"), function (i) { i.disabled = !istLeitung; i.required = istLeitung && i.type === "radio"; });
  }
  rolle.addEventListener("change", wechseln);
  wechseln();
});
// Help page: typing filters the questions (title and answer); a hint shows when nothing fits.
var hilfeSuche = document.querySelector("[data-hilfe-suche]");
if (hilfeSuche) hilfeSuche.addEventListener("input", function () {
  var q = hilfeSuche.value.trim().toLowerCase();
  var sichtbar = 0;
  document.querySelectorAll(".hilfe-frage").forEach(function (d) {
    var passt = !q || d.textContent.toLowerCase().indexOf(q) >= 0;
    d.hidden = !passt;
    if (passt) sichtbar++;
    if (q && passt) d.open = true;
  });
  document.querySelectorAll(".hilfe-gruppe").forEach(function (g) { g.hidden = !g.querySelector(".hilfe-frage:not([hidden])"); });
  var leer = document.querySelector("[data-hilfe-leer]");
  if (leer) leer.hidden = sichtbar > 0;
});
// Pencil / add buttons open their form and scroll to it.
document.querySelectorAll("a[data-oeffne]").forEach(function (a) {
  a.addEventListener("click", function (e) {
    var d = document.getElementById(a.getAttribute("data-oeffne"));
    if (!d) return;
    e.preventDefault();
    d.open = true;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
    var feld = d.querySelector("input:not([type=hidden])");
    if (feld) feld.focus({ preventScroll: true });
  });
});
// Message page: the WhatsApp/SMS/mail buttons always carry the current text.
document.querySelectorAll("textarea[data-nachricht]").forEach(function (t) {
  function setzen() {
    document.querySelectorAll("a[data-basis]").forEach(function (a) { a.href = a.getAttribute("data-basis") + encodeURIComponent(t.value); });
  }
  t.addEventListener("input", setzen);
});

// Copy a prepared message (for group chats or other apps).
document.querySelectorAll("button[data-kopieren]").forEach(function (b) {
  b.addEventListener("click", function () {
    navigator.clipboard.writeText(b.getAttribute("data-kopieren")).then(function () { b.textContent = "✓ Kopiert"; });
  });
});

var knopf = document.getElementById("push-an");
var test = document.getElementById("push-test");
var meldung = document.getElementById("push-status");
var ios = /iphone|ipad/i.test(navigator.userAgent);
var installiert = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
function zeige(t) { if (meldung) meldung.textContent = t; }
function bytes(b64) {
  var s = atob((b64 + "===".slice((b64.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, function (c) { return c.charCodeAt(0); });
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then(function (reg) {
    if (!knopf) return;
    if (!("PushManager" in window)) {
      zeige(ios && !installiert ? "Auf dem iPhone: unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Crewtender vom Home-Bildschirm öffnen und hier einschalten." : "Dieser Browser kann keine Benachrichtigungen.");
      return;
    }
    reg.pushManager.getSubscription().then(function (abo) {
      if (abo && Notification.permission === "granted") { zeige("✓ Auf diesem Gerät eingeschaltet."); if (test) test.hidden = false; return; }
      knopf.hidden = false;
    });
    // Shows a notification on this device without the server: tells whether the phone displays them at all.
    if (test) test.addEventListener("click", function () {
      reg.showNotification("Crewtender: Test", { body: "So sehen Crewtender-Nachrichten aus. Tippen öffnet die Trefferliste.", icon: "/icon-192.png", badge: "/icon-192.png", tag: "jarvis-test", data: { url: "/konto/treffer" } })
        .then(function () { zeige("Test geschickt. Kommt nichts, sind Benachrichtigungen für Chrome im Handy abgeschaltet."); })
        .catch(function (e) { zeige("Test ging nicht: " + (e.message || e)); });
    });
    knopf.addEventListener("click", function () {
      knopf.disabled = true;
      Notification.requestPermission().then(function (erlaubt) {
        if (erlaubt !== "granted") throw new Error("Du hast Benachrichtigungen nicht erlaubt. Du kannst das in den Einstellungen des Browsers ändern.");
        return fetch("/konto/push/schluessel").then(function (r) { return r.text(); });
      }).then(function (schluessel) {
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(schluessel.trim()) });
      }).then(function (abo) {
        return fetch("/konto/push/abo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(abo) });
      }).then(function (r) {
        if (!r.ok) throw new Error("Speichern hat nicht geklappt, bitte noch einmal.");
        knopf.hidden = true;
        if (test) test.hidden = false;
        zeige("✓ Eingeschaltet. Wähle oben „Handy“ oder „Mail und Handy“ und speichere.");
      }).catch(function (e) { knopf.disabled = false; zeige(e.message || "Das hat nicht geklappt."); });
    });
  });
}
})();
`;

export const SW_JS = `"use strict";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
// The push itself is empty; the text comes from the app with the person's own login.
self.addEventListener("push", function (e) {
  e.waitUntil(fetch("/konto/push/neu", { credentials: "include" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (n) {
      n = n || { titel: "Crewtender: Neues", text: "Neue Ausschreibungen", url: "/konto" };
      return self.registration.showNotification(n.titel, { body: n.text, icon: "/icon-192.png", badge: "/icon-192.png", tag: "jarvis", data: { url: n.url } });
    }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || "/konto", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (fenster) {
    for (var i = 0; i < fenster.length; i++) {
      if ("navigate" in fenster[i]) return fenster[i].focus().then(function (f) { return f.navigate(url); });
    }
    return self.clients.openWindow(url);
  }));
});
`;

export const MANIFEST = JSON.stringify({
  name: "Crewtender Ausschreibungs-Alarm",
  short_name: "Crewtender",
  start_url: "/konto",
  scope: "/",
  display: "standalone",
  background_color: "#f7f7f5",
  theme_color: "#1f5f8b",
  lang: "de",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
});

const DATEIEN: Record<string, [string, string | (() => Uint8Array)]> = {
  "/app.js": ["text/javascript; charset=utf-8", APP_JS],
  "/sw.js": ["text/javascript; charset=utf-8", SW_JS],
  "/manifest.webmanifest": ["application/manifest+json", MANIFEST],
  "/icon-192.png": ["image/png", () => Uint8Array.from(atob(ICON_192), (c) => c.charCodeAt(0))],
  "/icon-512.png": ["image/png", () => Uint8Array.from(atob(ICON_512), (c) => c.charCodeAt(0))],
};

/** Static files of the app, or null. */
export function statisch(pfad: string): Response | null {
  const d = DATEIEN[pfad];
  if (!d) return null;
  const inhalt = typeof d[1] === "string" ? d[1] : d[1]();
  // Scripts and manifest: always check for the newest version; icons may be cached.
  const cache = pfad.endsWith(".png") ? "public, max-age=86400" : "no-cache";
  return new Response(inhalt, { headers: { "content-type": d[0], "cache-control": cache, "x-content-type-options": "nosniff" } });
}

export const CSP = "default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; manifest-src 'self'; worker-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
