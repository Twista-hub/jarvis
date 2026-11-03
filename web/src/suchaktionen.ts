// Browser feedback shared by company research, profile saving and tender search.
export const SUCH_AKTION_JS = `// Every search action reports work immediately, including secondary buttons with their own form action.
document.querySelectorAll("form[data-suchaktion]").forEach(function (form) {
  var idleButtons = [];
  var idleStatus = form.querySelector("[data-einrichtung-status]");
  var idleText = idleStatus ? idleStatus.textContent : "";
  var idleClass = idleStatus ? idleStatus.className : "";
  var busyStatus = null;
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    delete form.dataset.beschaeftigt;
    form.removeAttribute("aria-busy");
    idleButtons.forEach(function (b) { b.button.disabled = b.disabled; b.button.textContent = b.text; });
    if (busyStatus) {
      if (idleStatus) { busyStatus.textContent = idleText; busyStatus.className = idleClass; }
      else busyStatus.remove();
      busyStatus = null;
    }
  });
  form.addEventListener("submit", function (event) {
    if (form.dataset.beschaeftigt === "1") { event.preventDefault(); return; }
    idleButtons = Array.from(form.querySelectorAll("button")).map(function (b) { return { button: b, text: b.textContent, disabled: b.disabled }; });
    form.dataset.beschaeftigt = "1";
    form.setAttribute("aria-busy", "true");
    var button = event.submitter || form.querySelector('button[type="submit"], button:not([type])');
    var ziel = (button && button.getAttribute("formaction")) || form.getAttribute("action") || "";
    var recherche = ziel.endsWith("/automatisch") || ziel.endsWith("/vorschlag");
    var status = form.querySelector("[data-einrichtung-status]");
    if (!status) {
      status = document.createElement("p");
      status.setAttribute("data-einrichtung-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      if (button) button.insertAdjacentElement("afterend", status); else form.appendChild(status);
    }
    status.className = "laedt";
    busyStatus = status;
    status.textContent = ziel.endsWith("/vorschau") ? "Crewtender zählt die passenden Ausschreibungen der letzten 7 Tage …" : recherche ? "Crewtender prüft eure Leistungen und Standorte. Das kann einige Minuten dauern. Danach geht es automatisch weiter." : "Crewtender startet die Suche nach Ausschreibungen. Bitte warte kurz …";
    var spinner = document.createElement("span");
    spinner.className = "kreisel";
    spinner.setAttribute("aria-hidden", "true");
    status.prepend(spinner);
    if (button) button.textContent = recherche ? "Firma wird recherchiert …" : "Suche wird gestartet …";
    status.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // Let the browser collect the clicked button's action/value before disabling duplicate submissions.
    window.setTimeout(function () { form.querySelectorAll("button").forEach(function (b) { b.disabled = true; }); }, 0);
  });
});

// New accounts and incomplete profiles start without another click.
document.querySelectorAll("form[data-auto-einrichtung]").forEach(function (form) {
  window.setTimeout(function () { form.requestSubmit(); }, 0);
});

`;
