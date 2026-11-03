// Rechtsprüfung K4 (Art. 5 Abs. 1 c DSGVO): tender documents often name contact persons of the awarding authority.
// The fact sheet does not need their names, so personal e-mail addresses and "Herr/Frau <Name>" are masked before the
// text goes to the AI service. Functional addresses (vergabe@, info@, poststelle@ …) stay, they are needed for questions.
const FUNKTION = /vergabe|info|post|zentral|ausschreib|einkauf|beschaff|kontakt|service|office|buero|büro|verwaltung|submission|angebot|bieter|mail|noreply|no-reply|sekretariat|amt|stelle|team|support|presse|rechnung|kanzlei|zentrale/i;

export function personenMaskieren(text: string): string {
  return text
    .replace(/\b([A-Za-zÄÖÜäöüß][\wÄÖÜäöüß.+-]*)@([\w-]+(?:\.[\w-]+)+)\b/g, (ganz, lokal: string, domain: string) =>
      FUNKTION.test(lokal) || !/^[A-Za-zÄÖÜäöüß]+[._-][A-Za-zÄÖÜäöüß]+\d*$/.test(lokal) && !/^[a-zäöü]\.?[a-zäöüß]{3,}$/i.test(lokal) ? ganz : `[Name]@${domain}`)
    .replace(/\b(Herrn?|Frau)\s+(?:(?:Dr|Prof)\.\s+)*[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?(?:\s+[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?)?\b/g, "$1 [Name]");
}
