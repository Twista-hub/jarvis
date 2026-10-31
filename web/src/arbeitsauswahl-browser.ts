import { MAX_ARBEITEN } from "./arbeitsauswahl.ts";

export const ARBEITSAUSWAHL_JS = `
document.querySelectorAll("[data-arbeitsauswahl]").forEach(function (root) {
  var chips = root.querySelector("[data-arbeit-chips]");
  var auswahl = root.querySelector("[data-arbeit-auswahl]");
  var dropdown = root.querySelector("[data-arbeit-dropdown]");
  var menue = root.querySelector("[data-arbeit-menue]");
  var filter = root.querySelector("[data-arbeit-filter]");
  var liste = root.querySelector("[data-arbeit-liste]");
  var auswahlFokus = function () { menue.querySelector("summary").focus(); };
  var eigene = root.querySelector("[data-arbeit-eigene]");
  var eigenerName = root.querySelector("[data-arbeit-eigener-name]");
  var anlegen = root.querySelector("[data-arbeit-eigene-anlegen]");
  var felder = root.querySelector("[data-arbeit-felder]");
  var fertig = root.querySelector("[data-arbeit-fertig]");
  var status = root.querySelector("[data-arbeit-status]");
  var vorlage = root.querySelector("template[data-arbeit-vorlage]");
  var optionenGruppe = root.querySelector("[data-arbeit-optionen]");
  if (!chips || !dropdown || !vorlage || !felder || !menue || !filter || !liste) return;
  var norm = function (name) { return name.trim().toLocaleLowerCase("de"); };
  var zeilen = function () { return Array.from(felder.querySelectorAll("[data-arbeit-zeile]")); };
  var aktiv = function (z) { return z.querySelector("[data-arbeit-aktiv]").checked; };
  var name = function (z) { return z.querySelector("[data-arbeit-name]").value.trim(); };
  var aktuell = null;
  var optionNummer = 0;

  function auswahlZeigen() {
    liste.replaceChildren();
    var suche = norm(filter.value);
    dropdown.querySelectorAll("optgroup").forEach(function (gruppe) {
      var optionen = Array.from(gruppe.querySelectorAll("option")).filter(function (o) { return !o.disabled && norm(o.textContent).includes(suche); });
      if (!optionen.length) return;
      var bereich = document.createElement("section");
      var titel = document.createElement("h3");
      titel.textContent = gruppe.getAttribute("label");
      bereich.appendChild(titel);
      optionen.forEach(function (o) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = o.textContent;
        button.dataset.arbeitWaehlen = o.value;
        button.disabled = dropdown.disabled;
        button.addEventListener("click", function () { waehlen(o.value); });
        bereich.appendChild(button);
      });
      liste.appendChild(bereich);
    });
    if (!liste.childElementCount) {
      var leer = document.createElement("p");
      leer.className = "klein";
      leer.textContent = "Keine weitere Arbeit gefunden.";
      liste.appendChild(leer);
    }
    var selbst = document.createElement("button");
    selbst.type = "button";
    selbst.textContent = "Eigene Arbeit eingeben …";
    selbst.dataset.arbeitWaehlen = "__eigen";
    selbst.disabled = dropdown.disabled;
    selbst.addEventListener("click", function () { waehlen("__eigen"); });
    liste.appendChild(selbst);
  }

  function schliessen() {
    aktuell = null;
    felder.hidden = true;
    fertig.hidden = true;
    zeilen().forEach(function (z) { z.hidden = true; });
  }
  function merken(z) {
    if (!name(z)) return;
    var option = Array.from(dropdown.querySelectorAll("option[data-arbeit-name]")).find(function (o) { return norm(o.dataset.arbeitName) === norm(name(z)); });
    if (!option) {
      option = document.createElement("option");
      option.value = "eigen-" + optionNummer++;
      optionenGruppe.appendChild(option);
    }
    option.textContent = name(z);
    option.dataset.arbeitName = name(z);
    option.dataset.arbeitWoerter = z.querySelector("[data-arbeit-woerter]").value;
    option.dataset.arbeitCpv = z.querySelector("[data-arbeit-cpv]").value;
  }
  function anzeigen(meldung) {
    chips.replaceChildren();
    var gewaehlt = zeilen().filter(function (z) { return aktiv(z) && name(z); });
    zeilen().forEach(merken);
    gewaehlt.forEach(function (z) {
      var chip = document.createElement("li");
      chip.className = "arbeits-chip";
      var bearbeiten = document.createElement("button");
      bearbeiten.type = "button";
      bearbeiten.className = "arbeits-chip-name";
      bearbeiten.textContent = name(z);
      bearbeiten.setAttribute("aria-label", name(z) + " bearbeiten");
      bearbeiten.addEventListener("click", function () {
        var warOffen = aktuell === z;
        schliessen();
        if (warOffen) return;
        aktuell = z;
        felder.hidden = false;
        fertig.hidden = false;
        z.hidden = false;
        z.querySelector("[data-arbeit-editor]").open = true;
        z.querySelector("[data-arbeit-name]").focus();
      });
      var entfernen = document.createElement("button");
      entfernen.type = "button";
      entfernen.className = "arbeits-chip-entfernen";
      entfernen.textContent = "×";
      entfernen.setAttribute("aria-label", name(z) + " entfernen");
      entfernen.addEventListener("click", function () {
        var text = name(z);
        z.querySelector("[data-arbeit-aktiv]").checked = false;
        schliessen();
        anzeigen(text + " entfernt.");
        auswahlFokus();
      });
      chip.append(bearbeiten, entfernen);
      chips.appendChild(chip);
    });
    dropdown.querySelectorAll("option[data-arbeit-name]").forEach(function (o) {
      o.disabled = gewaehlt.some(function (z) { return norm(name(z)) === norm(o.dataset.arbeitName); });
    });
    dropdown.disabled = gewaehlt.length >= ${MAX_ARBEITEN};
    auswahlZeigen();
    status.textContent = meldung || (dropdown.disabled ? "Zwölf Arbeiten ausgewählt. Entferne eine, um eine andere hinzuzufügen." : gewaehlt.length ? "" : "Wähle mindestens eine Arbeit aus.");
    status.hidden = !status.textContent;
  }
  function verbinden(z) {
    z.hidden = true;
    z.querySelector("[data-arbeit-aktiv-label]").hidden = true;
    z.querySelectorAll("input").forEach(function (input) { input.addEventListener("input", function () { anzeigen(""); }); });
  }
  function hinzufuegen(v) {
    var titel = v.name.trim().slice(0, 120);
    if (titel.length < 3) { status.hidden = false; status.textContent = "Bitte gib eine Arbeit mit mindestens drei Zeichen ein."; eigenerName.focus(); return false; }
    if (zeilen().some(function (z) { return aktiv(z) && norm(name(z)) === norm(titel); })) { anzeigen(titel + " ist bereits ausgewählt."); return false; }
    if (zeilen().filter(aktiv).length >= ${MAX_ARBEITEN}) { anzeigen("Du kannst bis zu zwölf Arbeiten auswählen."); return false; }
    var z = zeilen().find(function (z) { return norm(name(z)) === norm(titel); });
    if (!z) {
      z = zeilen().find(function (z) { return !aktiv(z); });
      if (!z) {
        z = vorlage.content.firstElementChild.cloneNode(true);
        var index = String(zeilen().length);
        z.dataset.arbeitIndex = index;
        z.querySelectorAll("input[name]").forEach(function (input) { input.name = input.name.replace("__INDEX__", index); });
        felder.appendChild(z);
        verbinden(z);
      }
      z.querySelector("[data-arbeit-name]").value = titel;
      z.querySelector("[data-arbeit-woerter]").value = v.woerter;
      z.querySelector("[data-arbeit-cpv]").value = v.cpv;
    }
    z.querySelector("[data-arbeit-aktiv]").checked = true;
    schliessen();
    anzeigen(titel + " hinzugefügt.");
    return true;
  }

  function waehlen(wert) {
    if (dropdown.disabled) return;
    dropdown.value = "";
    menue.open = false;
    filter.value = "";
    if (wert === "__eigen") { eigene.hidden = false; eigenerName.focus(); return; }
    var option = Array.from(dropdown.querySelectorAll("option")).find(function (o) { return o.value === wert; });
    if (!option || !option.dataset.arbeitName) return;
    eigene.hidden = true;
    hinzufuegen({ name: option.dataset.arbeitName, woerter: option.dataset.arbeitWoerter || "", cpv: option.dataset.arbeitCpv || "" });
    auswahlFokus();
  }
  dropdown.addEventListener("change", function () { waehlen(dropdown.value); });
  filter.addEventListener("input", auswahlZeigen);
  filter.addEventListener("keydown", function (e) { if (e.key === "Enter") e.preventDefault(); });
  menue.addEventListener("keydown", function (e) { if (e.key === "Escape") { menue.open = false; auswahlFokus(); } });
  function eigeneHinzufuegen() {
    var text = eigenerName.value.trim();
    var stop = ["und", "oder", "für", "von", "der", "die", "das", "mit"];
    var worte = Array.from(new Set([text.toLocaleLowerCase("de")].concat(text.toLocaleLowerCase("de").split(/[^a-zäöüß0-9-]+/)).filter(function (w) { return w.length >= 3 && w.length <= 60 && !stop.includes(w); })));
    if (hinzufuegen({ name: text, woerter: worte.join(", "), cpv: "" })) { eigenerName.value = ""; eigene.hidden = true; auswahlFokus(); }
  }
  anlegen.addEventListener("click", eigeneHinzufuegen);
  eigenerName.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); eigeneHinzufuegen(); } });
  fertig.addEventListener("click", function () { schliessen(); auswahlFokus(); });
  zeilen().forEach(verbinden);
  chips.hidden = false;
  auswahl.hidden = false;
  schliessen();
  anzeigen("");
});
`;
