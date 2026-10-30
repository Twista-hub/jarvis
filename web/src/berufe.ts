// Gemeinsamer branchenübergreifender Berufskatalog für Personal und Bekanntmachungen.
export const BERUFE: Record<string, string[]> = {
  "Büro & Verwaltung": ["Bürokraft", "Sachbearbeiter/in", "Kaufmännische Fachkraft", "Bürokaufmann/-frau", "Empfangskraft", "Datenerfasser/in", "Buchhalter/in", "Lohnbuchhalter/in", "Personalreferent/in", "Kundenservice"],
  "Bau & Ausbau": ["Maurer/in", "Maler/in", "Lackierer/in", "Trockenbauer/in", "Fliesenleger/in", "Dachdecker/in", "Zimmerer/Zimmerin", "Tischler/in", "Bauhelfer/in", "Baugeräteführer/in"],
  "Elektro, Metall & Technik": ["Elektriker/in", "Elektroniker/in", "Mechatroniker/in", "Schweißer/in", "Schlosser/in", "Industriemechaniker/in", "Anlagenmechaniker/in SHK", "Kfz-Mechatroniker/in", "Maschinenbediener/in", "Produktionshelfer/in"],
  "IT & Kommunikation": ["Fachinformatiker/in", "IT-Support", "Systemadministrator/in", "Softwareentwickler/in", "Netzwerktechniker/in", "Telekommunikationstechniker/in", "IT-Projektassistenz"],
  "Lager & Logistik": ["Lagerhelfer/in", "Kommissionierer/in", "Staplerfahrer/in", "Fachkraft Lagerlogistik", "Berufskraftfahrer/in", "Kurierfahrer/in", "Fahrer/in"],
  "Gastronomie & Hotel": ["Servicekraft", "Bankettkraft", "Koch/Köchin", "Küchenhilfe", "Spülkraft", "Barkeeper/in", "Rezeptionist/in", "Housekeeping"],
  "Reinigung & Hauswirtschaft": ["Reinigungskraft", "Gebäudereiniger/in", "Hauswirtschaftskraft", "Hausmeister/in"],
  "Pflege, Medizin & Soziales": ["Pflegehelfer/in", "Pflegefachkraft", "Medizinische/r Fachangestellte/r", "Betreuungskraft", "Erzieher/in", "Sozialassistent/in"],
  "Bildung & Betreuung": ["Pädagogische Fachkraft", "Kinderpfleger/in", "Schulbegleiter/in", "Integrationshelfer/in", "Lehrkraft", "Dozent/in"],
  "Einzelhandel & Verkauf": ["Verkäufer/in", "Kassierer/in", "Warenverräumer/in", "Einzelhandelskaufmann/-frau", "Promoter/in"],
  "Sicherheit & Veranstaltung": ["Sicherheitskraft", "Messehelfer/in", "Veranstaltungstechniker/in", "Garderobenkraft", "Ordner/in"],
  "Garten, Agrar & Tierpflege": ["Garten- und Landschaftsbauer/in", "Gärtner/in", "Landwirtschaftliche/r Helfer/in", "Landwirt/in", "Tierpfleger/in", "Forstwirt/in"],
  "Fahrzeug & Verkehr": ["Busfahrer/in", "Lkw-Fahrer/in", "Fahrzeugaufbereiter/in", "Kfz-Mechaniker/in", "Fahrradmechaniker/in", "Triebfahrzeugführer/in"],
  "Gebäudetechnik & Energie": ["Anlagenmechaniker/in", "Sanitärinstallateur/in", "Heizungsbauer/in", "Klimatechniker/in", "Solar-/Photovoltaikmonteur/in", "Elektroniker/in für Energie- und Gebäudetechnik"],
};

/** Ausschreibungsbegriffe, die bei der Erkennung auf einen gemeinsamen Berufsnamen abgebildet werden. */
export const BERUF_SYNONYME: Record<string, string[]> = {
  "Tischler/in": ["Schreiner", "Schreinerin", "Tischlerei"],
  "Anlagenmechaniker/in SHK": ["Installateur SHK", "Sanitärinstallateur", "Heizungsbauer", "Heizungstechniker"],
  "Elektriker/in": ["Elektrofachkraft", "Elektroinstallateur", "Elektroinstallateurin"],
  "Fliesenleger/in": ["Fliesenfacharbeiter", "Fliesenfachkraft"],
  "Maler/in": ["Maler und Lackierer", "Maler- und Lackiererarbeiten"],
  "Gebäudereiniger/in": ["Unterhaltsreinigung", "Reinigungspersonal"],
  "Berufskraftfahrer/in": ["LKW-Fahrer", "Lkw Fahrer", "Kraftfahrer", "Fernfahrer"],
  "Fachkraft Lagerlogistik": ["Lagerlogistiker", "Lagerlogistikerin"],
  "Fachinformatiker/in": ["Fachinformatiker Systemintegration", "Fachinformatiker Anwendungsentwicklung"],
  "Systemadministrator/in": ["Systemadmin", "IT-Administrator", "IT-Administration"],
  "Softwareentwickler/in": ["Programmierer", "Programmiererin", "Software Developer"],
  "Busfahrer/in": ["Omnibusfahrer", "Omnibusfahrerin"],
  "Solar-/Photovoltaikmonteur/in": ["PV-Monteur", "Photovoltaikmonteur", "Solarmonteur"],
  "Pflegefachkraft": ["Pflegefachfrau", "Pflegefachmann", "Altenpfleger", "Altenpflegerin"],
  "Pädagogische Fachkraft": ["pädagogisches Personal", "pädagogische Mitarbeiter"],
};
