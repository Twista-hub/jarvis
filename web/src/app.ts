// The small amount of browser code: start the upload as soon as a file is chosen, switch on phone
// notifications, and the service worker that shows them and opens the right page on tap.
// Served from our own origin, so the content security policy only needs script-src 'self'.
import { ICON_192, ICON_512 } from "./icons.ts";

export const APP_JS = `"use strict";
// Own scope, so names like "status" do not collide with window properties.
(function () {
document.querySelectorAll("input[data-sofort]").forEach(function (i) {
  i.addEventListener("change", function () {
    if (i.files.length) { i.form.querySelector("button").textContent = "Wird hochgeladen …"; i.form.requestSubmit(); }
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
      zeige(ios && !installiert ? "Auf dem iPhone: unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Jarvis vom Home-Bildschirm öffnen und hier einschalten." : "Dieser Browser kann keine Benachrichtigungen.");
      return;
    }
    reg.pushManager.getSubscription().then(function (abo) {
      if (abo && Notification.permission === "granted") { zeige("✓ Auf diesem Gerät eingeschaltet."); if (test) test.hidden = false; return; }
      knopf.hidden = false;
    });
    // Shows a notification on this device without the server: tells whether the phone displays them at all.
    if (test) test.addEventListener("click", function () {
      reg.showNotification("Jarvis: Test", { body: "So sehen Jarvis-Nachrichten aus. Tippen öffnet die Trefferliste.", icon: "/icon-192.png", badge: "/icon-192.png", tag: "jarvis-test", data: { url: "/konto" } })
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
      n = n || { titel: "Jarvis: Neues", text: "Neue Ausschreibungen", url: "/konto" };
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
  name: "Jarvis Ausschreibungs-Alarm",
  short_name: "Jarvis",
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
