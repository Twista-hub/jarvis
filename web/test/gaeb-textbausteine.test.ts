import assert from "node:assert/strict";
import { test } from "node:test";
import { dekodieren, gaebLesen, gp, lvCsv, positionen, summen, textVon, x84, xmlLesen } from "../src/gaeb.ts";
import { eingabeZahl, kuerzen, lvSeite, type LvZeile } from "../src/lv.ts";
import { anhaengen, ausfuellen, bausteineFeld, bausteineSeite, type Baustein } from "../src/textbausteine.ts";
import { EINFUEHRUNG, hilfeSeite } from "../src/kontoeinstellungen.ts";

export const X83 = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Beispiel-LV -->
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2">
  <GAEBInfo><Version>3.2</Version><VersDate>2013-10</VersDate><Date>2026-10-20</Date><ProgSystem>AVA</ProgSystem></GAEBInfo>
  <PrjInfo><NamePrj>Kita Sonnenschein</NamePrj><LblPrj>Sanierung Sanitär &amp; Fliesen</LblPrj><Cur>EUR</Cur><UPFracDig>2</UPFracDig></PrjInfo>
  <Award><DP>83</DP><AwardInfo><BoQID>LV-4711</BoQID><Cur>EUR</Cur></AwardInfo>
    <BoQ ID="B1">
      <BoQInfo><Name>LV Fliesen</Name><BoQBkdn><Type>BoQLevel</Type><Length>2</Length><Num>Yes</Num></BoQBkdn><BoQBkdn><Type>Item</Type><Length>4</Length><Num>Yes</Num></BoQBkdn></BoQInfo>
      <BoQBody>
        <BoQCtgy ID="C1" RNoPart="01"><LblTx><p><span>Vorarbeiten</span></p></LblTx>
          <BoQBody><Itemlist>
            <Item ID="I1" RNoPart="0010"><LumpSumItem>Yes</LumpSumItem><Qty>1.000</Qty><QU>psch</QU>
              <Description><CompleteText><DetailTxt><Text><p><span>Baustelle einrichten,</span></p><p><span>vorhalten und räumen.</span></p></Text></DetailTxt>
              <OutlineText><OutlTxt><TextOutlTxt><p><span>Baustelleneinrichtung</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
            <Item ID="I2" RNoPart="0020"><Qty>35.500</Qty><QU>m2</QU>
              <Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt><p><span>Altfliesen entfernen</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
          </Itemlist></BoQBody>
        </BoQCtgy>
        <BoQCtgy ID="C2" RNoPart="02"><LblTx><p><span>Fliesenarbeiten</span></p></LblTx>
          <BoQBody><Itemlist>
            <Item ID="I3" RNoPart="0010"><Qty>120</Qty><QU>m2</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt><![CDATA[Bodenfliesen 30x60 verlegen]]></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
            <Item ID="I4" RNoPart="0020"><Provis>WithoutTotal</Provis><Qty>10</Qty><QU>m2</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt>Zulage Mosaik</TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
            <Item ID="I5" RNoPart="0030"><QtyTBD>Yes</QtyTBD><QU>h</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt>Stundenlohnarbeiten Fliesenleger</TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
            <Item ID="I6" RNoPart="0040"><Qty>8</Qty><QU>Std</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt>Helfer</TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
          </Itemlist></BoQBody>
        </BoQCtgy>
      </BoQBody>
    </BoQ>
  </Award>
</GAEB>`;

test("N9: XML lesen, Sicherheitsgrenzen und Kodierung", () => {
  const k = xmlLesen(`<a x="1 &amp; 2"><b>T&#228;st &lt;ok&gt;</b><c/></a>`);
  assert.equal(k.attr.x, "1 & 2");
  assert.equal(textVon(k), "Täst <ok>");
  assert.throws(() => xmlLesen(`<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>`), /DOCTYPE/);
  assert.throws(() => xmlLesen(`<a><b></a>`), /Ende|geschlossen/);
  const latin = new Uint8Array([...new TextEncoder().encode(`<?xml version="1.0" encoding="ISO-8859-1"?><a>`), 0xe4, ...new TextEncoder().encode("</a>")]);
  assert.equal(textVon(xmlLesen(dekodieren(latin))), "ä");
});

test("N9: X83 einlesen mit Gruppen, Arten und Texten", () => {
  const lv = gaebLesen(X83);
  assert.equal(lv.kopf.projekt, "Kita Sonnenschein");
  assert.equal(lv.kopf.projektLabel, "Sanierung Sanitär & Fliesen");
  assert.equal(lv.kopf.boqId, "LV-4711");
  assert.match(lv.kopf.bkdn, /<BoQBkdn><Type>BoQLevel<\/Type>/);
  const p = positionen(lv.struktur);
  assert.deepEqual(p.map((x) => x.oz), ["01.0010", "01.0020", "02.0010", "02.0020", "02.0030", "02.0040"]);
  assert.deepEqual(p.map((x) => x.art), ["pauschal", "normal", "normal", "bedarf_ohne", "normal", "normal"]);
  assert.equal(p[0].kurz, "Baustelleneinrichtung");
  assert.equal(p[0].lang, "Baustelle einrichten,\nvorhalten und räumen.");
  assert.equal(p[1].menge, 35.5);
  assert.equal(p[2].kurz, "Bodenfliesen 30x60 verlegen");
  assert.equal(p[4].mengeOffen, true);
  assert.equal(p[4].menge, null);
  assert.throws(() => gaebLesen(X83.replace("<DP>83</DP>", "<DP>84</DP>")), /Austauschphase 84/);
  assert.throws(() => gaebLesen(X83.replace("<Version>3.2</Version>", "<Version>2.1</Version>")), /nicht unterstützt/);
  assert.throws(() => gaebLesen("<html></html>"), /keine GAEB/);
});

test("N9: Preise, Summen, X84 und Excel-Liste", () => {
  const lv = gaebLesen(X83);
  const preise = { I1: { ep: 850 }, I2: { ep: 12.4 }, I3: { ep: 48.9 }, I4: { ep: 15 }, I5: { ep: 52, menge: 6 } };
  const p = positionen(lv.struktur);
  assert.equal(gp(p[0], preise.I1), 850);
  assert.equal(gp(p[1], preise.I2), 440.2);
  assert.equal(gp(p[4], preise.I5), 312);
  assert.equal(gp(p[5], undefined), null);
  const s = summen(lv.struktur, preise);
  assert.equal(s.gesamt, 850 + 440.2 + 5868 + 312);
  assert.equal(s.nebenbei, 150);
  assert.equal(s.offen, 1);
  assert.equal(s.gruppen.get("C1"), 1290.2);
  const x = x84(lv, preise, { name: "Fliesen Schmitz GmbH", strasse: "Hauptstr. 1", plz: "52531", ort: "Übach-Palenberg" }, "2026-11-01");
  assert.match(x, /xmlns="http:\/\/www\.gaeb\.de\/GAEB_DA_XML\/DA84\/3\.2"/);
  assert.match(x, /<DP>84<\/DP>/);
  assert.match(x, /<Item ID="I2" RNoPart="0020"><Qty>35\.500<\/Qty><UP>12\.40<\/UP><IT>440\.20<\/IT><\/Item>/);
  assert.match(x, /<Item ID="I5" RNoPart="0030"><Qty>6\.000<\/Qty><UP>52\.00<\/UP><IT>312\.00<\/IT><\/Item>/);
  assert.match(x, /<Item ID="I6" RNoPart="0040"><Qty>8\.000<\/Qty><\/Item>/);
  assert.match(x, /<BoQCtgy ID="C1" RNoPart="01"><BoQBody><Itemlist>.*<\/Itemlist><\/BoQBody><Totals><Total>1290\.20<\/Total><\/Totals><\/BoQCtgy>/);
  assert.match(x, /<BoQInfo><Name>LV Fliesen<\/Name><BoQBkdn>.*<Totals><Total>7470\.20<\/Total><\/Totals><\/BoQInfo>/);
  assert.match(x, /<CTR><Address><Name1>Fliesen Schmitz GmbH<\/Name1><Street>Hauptstr\. 1<\/Street><PCode>52531<\/PCode><City>Übach-Palenberg<\/City><\/Address><\/CTR>/);
  assert.doesNotMatch(x, /LblTx|Provis|LumpSumItem|Description/);
  assert.equal(xmlLesen(x).name, "GAEB", "X84 ist gültiges XML");
  const csv = lvCsv(lv, preise);
  assert.match(csv, /"01\.0020";"Altfliesen entfernen";35,500;"m2";12,40;440,20;""/);
  assert.match(csv, /"Gesamt netto";;;;7470,20;/);
});

test("N9: Eingaben, Kürzen und Seite", () => {
  assert.equal(eingabeZahl("1.234,50"), 1234.5);
  assert.equal(eingabeZahl("48.5"), 48.5);
  assert.equal(eingabeZahl(" 12 € "), 12);
  assert.equal(eingabeZahl(""), null);
  assert.ok(Number.isNaN(eingabeZahl("abc") as number));
  const lv = gaebLesen(X83);
  const lang = { ...lv, struktur: lv.struktur.map((g) => g.k === "g" ? { ...g, kinder: g.kinder.map((x) => x.k === "p" ? { ...x, lang: "x".repeat(2000) } : x) } : g) };
  assert.ok(kuerzen(lang).struktur.length === 2);
  const zeile: LvZeile = { id: "l1", dateiname: "Kita.X83", kopf: lv.kopf, struktur: lv.struktur, preise: { I1: { ep: 850 } }, geaendert: "" };
  const html = lvSeite({ id: "v1", titel: "Kita" }, zeile, { darfAendern: true });
  assert.match(html, /name="ep:I2"/);
  assert.match(html, /name="menge:I5"/);
  assert.match(html, /5 Positionen haben noch keinen Preis/);
  assert.match(html, /Bedarfsposition \(ohne Gesamtbetrag\)/);
  assert.match(html, /href="\/konto\/vorgang\/v1\/lv\.x84"/);
  assert.doesNotMatch(lvSeite({ id: "v1", titel: "Kita" }, zeile, { darfAendern: false }), /<input name="ep/);
  assert.match(lvSeite({ id: "v1", titel: "Kita" }, null, { darfAendern: true }), /type="file"/);
});

const b = (id: string, titel: string, kategorie: string, text: string, immer = false): Baustein => ({ id, titel, kategorie, text, immer });

test("N7: Textbausteine ausfüllen, anhängen und auswählen", () => {
  const werte = { FIRMA: "Schmitz GmbH", AUFTRAG: "Kita", AUFTRAGGEBER: "Stadt Aachen", DATUM: "1.11.2026" };
  assert.equal(ausfuellen("{{FIRMA}} für {{AUFTRAGGEBER}} ({{UNBEKANNT}})", werte), "Schmitz GmbH für Stadt Aachen ({{UNBEKANNT}})");
  const liste = [b("s", "Schluss", "Schluss", "Grüße {{FIRMA}}", true), b("f", "Firma", "Firmenvorstellung", "Wir sind {{FIRMA}}.", true)];
  const text = anhaengen("Angebot", liste, werte);
  assert.equal(text, "Angebot\n\nWir sind Schmitz GmbH.\n\nGrüße Schmitz GmbH");
  assert.equal(anhaengen(text, liste, werte), text, "nicht doppelt");
  const feld = bausteineFeld([...liste, b("q", "Qualität", "Qualität", "Wir prüfen.")], "Angebot\n\nWir sind Schmitz GmbH.", true, werte);
  assert.match(feld, /value="s" checked/);
  assert.match(feld, /value="f" disabled/);
  assert.doesNotMatch(feld, /value="q" checked/);
  assert.doesNotMatch(bausteineFeld(liste, "x", false, werte), /checked/);
  assert.match(bausteineFeld([], "x", true, werte), /Textbausteine/);
  const seite = bausteineSeite(liste, { darfAendern: true });
  assert.match(seite, /<h2>Firmenvorstellung<\/h2>/);
  assert.match(seite, /name="loeschen" value="s"/);
  assert.match(bausteineSeite([], { darfAendern: true }), /4 Beispiele anlegen/);
});

test("N8: Hilfe mit Einführung und Fragen zu den neuen Bereichen", () => {
  const h = hilfeSeite("a@b.de");
  assert.ok(h.includes(EINFUEHRUNG) && h.includes(`href="/hilfe"`), "introduction and link to the guides");
  for (const t of ["So arbeitest du mit Jarvis", "GAEB-Datei", "Textbausteine", "Neuausschreibungs-Radar", "Auswertung", "AÜG-Wächter", "nach dem Zuschlag"]) assert.match(h, new RegExp(t, "i"));
});
