// Polish and Spanish trade pages for search engines: /pl/przetargi[/<branża>] and /es/licitaciones[/<oficio>], the
// counterparts of the German (gewerke.ts) and French (gewerke-fr.ts) pages, linked with hreflang (gewerke-sprachen.ts).
// Live numbers: alarm/ausland_bestand.py stores the BZP notices (Poland) and the Catalan calls for tenders (Spain) twice a
// day, the background cache counts them per trade (rpc land_statistik, CPV prefixes "praefixe", the same list as in
// migration 20261102150000). Sources are named on every page. The pages keep their language (header x-jv-sprache).
import { escape, seite } from "./seite.ts";
import type { Statistik } from "./gewerke.ts";
import { alternativen, LISTEN, SLUGS } from "./gewerke-sprachen.ts";

type Branche = { de: string; name: string; h1: string; cpv: string[]; praefixe: string[]; intro: string; vorteile: string[]; fragen: [string, string][] };
type Land = {
  code: "pl" | "es"; locale: string; zone: string; titel: string; einleitung: string; beschreibung: string; quelle: string;
  registrieren: string; demo: string; monat: string; offen: string; auswahl: string; auswahlHinweis: string; frist: string; link: RegExp;
  hilfe: (name: string) => string; immer: string[]; cpvText: string; fragenTitel: string; andere: string; allgemein: [string, string][];
  meta: (h1: string, monat: string) => string; branchen: Branche[];
};

const PRAEFIXE: Record<string, string[]> = {
  "gebaeudereinigung": ["9091", "90919"], "sicherheitsdienst": ["7971"], "garten-landschaftsbau-winterdienst": ["7731", "77211"], "elektro": ["4531"],
  "sanitaer-heizung-lueftung": ["4533"], "maler-trockenbau": ["45442", "45441", "45410", "454211"], "tischler-schreiner": ["45421"],
  "dach-zimmerer": ["45261", "45422"], "bodenbelaege-fliesen": ["45432", "45431"], "zeitarbeit-personaldienstleister": ["7962"],
};
const CPV: Record<string, string[]> = {
  "gebaeudereinigung": ["90910000", "90911200", "90911300", "90919200"], "sicherheitsdienst": ["79710000", "79713000", "79714000", "79715000"],
  "garten-landschaftsbau-winterdienst": ["77310000", "77311000", "77313000", "77314000", "77211400"], "elektro": ["45311000", "45315000", "45317000", "45310000"],
  "sanitaer-heizung-lueftung": ["45330000", "45331000", "45332000"], "maler-trockenbau": ["45442100", "45441000", "45410000", "45421141"],
  "tischler-schreiner": ["45421000", "45421100", "45421150"], "dach-zimmerer": ["45261000", "45261210", "45422000"],
  "bodenbelaege-fliesen": ["45432000", "45431000", "45432100"], "zeitarbeit-personaldienstleister": ["79620000", "79621000", "79622000", "79624000", "79625000"],
};
const b = (de: string, name: string, h1: string, intro: string, vorteile: string[], fragen: [string, string][]): Branche =>
  ({ de, name, h1, cpv: CPV[de], praefixe: PRAEFIXE[de], intro, vorteile, fragen });

const PL: Land = {
  code: "pl", locale: "pl-PL", zone: "Europe/Warsaw",
  titel: "Przetargi publiczne według branży",
  einleitung: "Jarvis codziennie czyta wszystkie nowe ogłoszenia o zamówieniach z Biuletynu Zamówień Publicznych i z TED i pokazuje firmom budowlanym, usługowym i agencjom pracy tymczasowej te, które do nich pasują, w ich województwach. Wybierz swoją branżę:",
  beschreibung: "Przetargi publiczne dla budownictwa, sprzątania, ochrony i pracy tymczasowej: Jarvis codziennie wyszukuje w BZP i TED zamówienia pasujące do Twojej firmy, w Twoich województwach.",
  quelle: `<p class="klein">Źródło: Biuletyn Zamówień Publicznych (UZP) oraz TED (Urząd Publikacji UE). Jarvis jest prywatną usługą WP Digital Ranger, a nie instytucją publiczną.</p>`,
  registrieren: "Znajdź pasujące przetargi za darmo", demo: "🎬 Zobacz demo",
  monat: "przetargów w BZP w ostatnich 30 dniach", offen: "nadal otwartych",
  auswahl: "Aktualne przetargi (wybór)",
  auswahlHinweis: "Ogłoszenia z BZP z kodem CPV tej branży. W Jarvis otrzymujesz tylko przetargi pasujące do Twojej firmy i Twoich województw, z oceną i jednym zdaniem wyjaśnienia.",
  frist: "termin", link: /^https:\/\/ezamowienia\.gov\.pl\//,
  hilfe: (n) => `Jak Jarvis pomaga firmom z branży: ${n.toLowerCase()}`,
  immer: ["Każdego ranka nowe przetargi z oceną od 1 do 10 i jednym zdaniem, dlaczego pasują", "Wyszukiwanie według województw, na start całe Twoje województwo"],
  cpvText: "Śledzone kody CPV, m.in.:", fragenTitel: "Najczęstsze pytania", andere: "Inne branże",
  allgemein: [
    ["Ile kosztuje Jarvis?", "Rejestracja jest bezpłatna. Od razu widzisz przetargi pasujące do Twojej firmy i możesz wszystko spokojnie przetestować."],
    ["Skąd pochodzą przetargi?", "Z Biuletynu Zamówień Publicznych (BZP) na platformie e-Zamówienia, gdzie publikowane są zamówienia krajowe poniżej progów unijnych, oraz z TED dla zamówień powyżej progów. Jarvis codziennie czyta wszystkie nowe ogłoszenia, w dni robocze około 500."],
    ["Czy mogę ograniczyć wyszukiwanie do moich województw?", "Tak. Wybierasz województwa, na start to, w którym jest siedziba firmy. Jarvis pokazuje tylko przetargi z miejscem realizacji w tych województwach."],
    ["Czy Jarvis jest usługą publiczną?", "Nie. Jarvis jest prywatną usługą WP Digital Ranger, a nie instytucją publiczną."],
  ],
  meta: (h1, monat) => `${h1}: ${monat}Jarvis codziennie czyta BZP i TED i wysyła Ci zamówienia pasujące do Twojej firmy, w Twoich województwach. Rejestracja bezpłatna.`,
  branchen: [
    b("gebaeudereinigung", "Sprzątanie", "Przetargi publiczne na sprzątanie budynków i mycie okien",
      "Szkoły, urzędy, szpitale i spółdzielnie regularnie zlecają sprzątanie pomieszczeń, mycie okien i sprzątanie po remontach. Zamówienia są często podzielone na części według budynków, dostępne także dla małych firm sprzątających. Jarvis wyszukuje te, które pasują do Twojej firmy i Twoich województw.",
      ["Sprzątanie bieżące, mycie okien i sprzątanie po remoncie rozpoznawane osobno", "Karta przetargu z częściami, powierzchniami, częstotliwością, okresem umowy i wizją lokalną", "Grafik ekip, ewidencja godzin i potwierdzenia wykonania usług na zdobytych obiektach"],
      [["Czy przetargi na sprzątanie są dostępne dla małych firm?", "Często tak. Wielu zamawiających dzieli zamówienie na części według obiektów. Jarvis pokazuje części, okres umowy i termin składania ofert, aby szybko podjąć decyzję."]]),
    b("sicherheitsdienst", "Ochrona", "Przetargi publiczne na ochronę osób i mienia",
      "Ochrona budynków, recepcja, patrole, zabezpieczenie imprez i monitoring dla urzędów, szpitali i spółek komunalnych. Jarvis znajduje przetargi i streszcza wymagania: koncesję MSWiA, wpisy na listę kwalifikowanych pracowników ochrony, obsadę.",
      ["Ochrona fizyczna, recepcja, patrole i monitoring rozpoznawane", "Karta przetargu z godzinami, obsadą i wymaganymi dokumentami", "Grafik pracowników z wolnymi zmianami, które zespół może przejąć sam"],
      [["Czy Jarvis pomaga w organizacji pracowników ochrony?", "Tak. Widzisz, kto jest dostępny i które uprawnienia są ważne, planujesz zmiany, a pracownicy przejmują wolne zmiany w aplikacji."]]),
    b("garten-landschaftsbau-winterdienst", "Tereny zielone", "Przetargi publiczne na utrzymanie terenów zielonych i pielęgnację drzew",
      "Utrzymanie zieleni, koszenie, pielęgnacja drzew i zimowe utrzymanie: gminy, powiaty i zarządcy dróg ogłaszają te zamówienia co roku, często w częściach. Jarvis pokazuje te z Twoich województw.",
      ["Utrzymanie zieleni, pielęgnacja drzew, nasadzenia i zimowe utrzymanie rozpoznawane", "Przypomnienie o terminach i wizjach lokalnych", "Grafik i ewidencja godzin dla ekip"],
      [["Kiedy gminy ogłaszają przetargi na tereny zielone?", "Przez cały rok, najwięcej pod koniec zimy na kolejny sezon. Jarvis codziennie rano informuje o nowych ogłoszeniach."]]),
    b("elektro", "Elektryka", "Przetargi publiczne na instalacje elektryczne i teletechniczne",
      "Instalacje elektryczne, oświetlenie, fotowoltaika, teletechnika i konserwacja w szkołach, halach sportowych i budynkach publicznych. Jarvis znajduje branżę elektryczną nawet w dużym zamówieniu na roboty budowlane.",
      ["Branża elektryczna rozpoznawana w zamówieniach na całe budowy", "Karta przetargu z częściami, przedmiarem, terminami i wymaganymi uprawnieniami (np. SEP)", "Terminy i pytania do zamawiającego w kalendarzu"],
      [["Czy przetargi publiczne opłacają się małej firmie elektrycznej?", "Tak. Wiele zamówień dzieli się na części albo dotyczy jednego budynku. Jarvis pokazuje wielkość, miejsce i termin na pierwszy rzut oka."]]),
    b("sanitaer-heizung-lueftung", "Instalacje sanitarne i grzewcze", "Przetargi publiczne na instalacje wod-kan, c.o. i wentylację",
      "Wymiana kotłów, wentylacja, instalacje wodno-kanalizacyjne i serwis HVAC w budynkach publicznych: jedna z najczęściej zlecanych branż. Jarvis sortuje zamówienia według Twoich województw.",
      ["Branża sanitarna i HVAC rozpoznawana w zamówieniach na budowy i remonty", "Przypomnienie przed każdym terminem", "Karta przetargu z zakresem, okresem i wymaganymi uprawnieniami"],
      [["Jak znaleźć przetargi na instalacje w pobliżu?", "Przy rejestracji Jarvis przyjmuje województwo siedziby jako obszar wyszukiwania. W każdej chwili możesz dodać lub usunąć województwa, bez opłat."]]),
    b("maler-trockenbau", "Malowanie i sucha zabudowa", "Przetargi publiczne na roboty malarskie, tynki i suchą zabudowę",
      "Malowanie, tynki, ścianki działowe i sufity podwieszane są częścią prawie każdego remontu budynku publicznego. Jarvis wyszukuje te części, nawet gdy należą do dużej inwestycji.",
      ["Roboty malarskie, tynkarskie i sufity podwieszane rozpoznawane", "Miejsce i termin na pierwszy rzut oka", "Karta przetargu z ilościami i okresem realizacji"],
      [["Czy chodzi tylko o duże budowy?", "Nie. Wiele zamówień dotyczy jednej szkoły, przedszkola lub kilku mieszkań i jest dostępnych dla firm zatrudniających kilka osób."]]),
    b("tischler-schreiner", "Stolarka", "Przetargi publiczne na stolarkę okienną, drzwiową i zabudowy",
      "Drzwi, okna, zabudowy meblowe i meble na wymiar są zlecane w osobnych częściach niemal przy każdej inwestycji publicznej. Jarvis znajduje części pasujące do Twojego zakładu.",
      ["Branża stolarska rozpoznawana w dużych inwestycjach", "Karta przetargu z wymaganym doświadczeniem i kryteriami oceny ofert", "Terminy i wizje lokalne w kalendarzu"],
      [["Czy muszę czytać całą SWZ przy każdym przetargu?", "Nie. Jarvis streszcza ogłoszenie. Jeśli wgrasz SWZ, Jarvis przeczyta wszystkie dokumenty i przygotuje szczegółową kartę przetargu."]]),
    b("dach-zimmerer", "Dachy i ciesielstwo", "Przetargi publiczne na pokrycia dachowe, ciesielstwo i izolacje",
      "Remonty dachów, więźby, izolacje i konstrukcje drewniane dla szkół i obiektów publicznych: Jarvis znajduje przetargi z Twoich województw i podaje termin, zakres i wymagane dokumenty.",
      ["Pokrycia dachowe, ciesielstwo i izolacje rozpoznawane", "Terminy i pytania do zamawiającego w kalendarzu", "Karta przetargu z kryteriami oceny ofert"],
      [["Jak często Jarvis szuka?", "Codziennie. Nowe przetargi dostajesz mailem lub powiadomieniem o wybranej godzinie."]]),
    b("bodenbelaege-fliesen", "Posadzki i płytki", "Przetargi publiczne na posadzki, wykładziny i płytki",
      "Wykładziny, posadzki żywiczne i płytki są zlecane osobno przy remontach i budowach publicznych. Jarvis znajduje pasujące części w Twoich województwach.",
      ["Posadzki i płytki rozpoznawane w zamówieniach na roboty", "Przypomnienie o terminach i wizjach lokalnych", "Karta przetargu z powierzchniami i terminami"],
      [["Jak szybko widzę nowe przetargi?", "Każdego ranka, mailem lub powiadomieniem na telefonie, o wybranej godzinie."]]),
    b("zeitarbeit-personaldienstleister", "Praca tymczasowa", "Przetargi publiczne na pracę tymczasową i udostępnianie personelu",
      "Szpitale, gminy i stołówki szukają pracowników tymczasowych do kuchni, sprzątania, administracji czy opieki, często w umowie ramowej na kilka lat. Wiele takich zamówień jest ogłaszanych pod nazwą usługi, a nie „praca tymczasowa”. Jarvis i tak je znajduje.",
      ["Rozpoznaje zapotrzebowanie na personel także w zamówieniach na gastronomię, sprzątanie i recepcję", "Grafik skierowań i ewidencja godzin", "Zatwierdzanie godzin online przez klienta"],
      [["Czy Jarvis znajduje przetargi, które nie wspominają o pracy tymczasowej?", "Tak. Jarvis analizuje rzeczywistą potrzebę opisaną w ogłoszeniu, np. personel stołówki, a nie tylko słowo kluczowe."]]),
  ],
};

const ES: Land = {
  code: "es", locale: "es-ES", zone: "Europe/Madrid",
  titel: "Licitaciones públicas por oficio",
  einleitung: "Jarvis lee cada día todas las nuevas licitaciones de Cataluña (todas las cuantías) y las licitaciones europeas de toda España publicadas en TED, y muestra a empresas de obras, servicios y ETT las que encajan con ellas, en sus comunidades autónomas. Elige tu oficio:",
  beschreibung: "Licitaciones públicas de obras, limpieza, seguridad y trabajo temporal: Jarvis encuentra cada día las que encajan con tu empresa, en tus comunidades autónomas.",
  quelle: `<p class="klein">Fuente: Plataforma de serveis de contractació pública, Generalitat de Catalunya (dades obertes, Llicència oberta d'ús d'informació – Catalunya, actualización diaria) y TED (Oficina de Publicaciones de la UE). Jarvis es un servicio privado de WP Digital Ranger, no un organismo público.</p>`,
  registrieren: "Encontrar licitaciones adecuadas gratis", demo: "🎬 Ver la demo",
  monat: "licitaciones en Cataluña en los últimos 30 días", offen: "todavía abiertas",
  auswahl: "Licitaciones abiertas en Cataluña (selección)",
  auswahlHinweis: "Anuncios de la Plataforma de contratación de la Generalitat con un código CPV de este oficio. En Jarvis solo recibes las licitaciones que encajan con tu empresa y tus comunidades autónomas, con una nota y una frase de explicación.",
  frist: "plazo", link: /^https:\/\/contractaciopublica\.cat\//,
  hilfe: (n) => `Cómo ayuda Jarvis a las empresas de ${n.toLowerCase()}`,
  immer: ["Cada mañana, las nuevas licitaciones con una nota del 1 al 10 y una frase que explica por qué encajan", "Búsqueda por comunidades autónomas, al principio la de tu sede"],
  cpvText: "Códigos CPV seguidos, entre otros:", fragenTitel: "Preguntas frecuentes", andere: "Otros oficios",
  allgemein: [
    ["¿Cuánto cuesta Jarvis?", "El registro es gratuito. Ves enseguida las licitaciones que encajan con tu empresa y puedes probarlo todo con calma."],
    ["¿De dónde salen las licitaciones?", "De Cataluña, todas las licitaciones de la Plataforma de serveis de contractació pública de la Generalitat (datos abiertos, unas 120 al día). Del resto de España, los contratos por encima de los umbrales europeos publicados en TED. La Plataforma de Contratación del Sector Público no permite hoy la lectura automática; por eso los contratos menores del resto de España todavía no están incluidos."],
    ["¿Puedo limitar la búsqueda a mis comunidades autónomas?", "Sí. Eliges tus comunidades autónomas, al principio la de tu sede. Jarvis solo muestra las licitaciones con lugar de ejecución en ellas."],
    ["¿Jarvis es un servicio público?", "No. Jarvis es un servicio privado de WP Digital Ranger, no un organismo público."],
  ],
  meta: (h1, monat) => `${h1}: ${monat}Jarvis lee cada día las licitaciones de Cataluña y de TED y te envía las que encajan con tu empresa. Registro gratuito.`,
  branchen: [
    b("gebaeudereinigung", "Limpieza", "Licitaciones públicas de limpieza de edificios y cristales",
      "Colegios, ayuntamientos, hospitales y empresas públicas contratan con regularidad la limpieza de sus edificios, los cristales y la limpieza de fin de obra. Los contratos suelen dividirse en lotes por edificio, también al alcance de pequeñas empresas de limpieza. Jarvis encuentra los que encajan con tu empresa y tus comunidades autónomas.",
      ["Limpieza ordinaria, cristales y fin de obra reconocidos por separado", "Ficha con lotes, superficies, frecuencias, duración del contrato, subrogación de personal y visita", "Cuadrantes de equipos, registro de horas y partes de servicio en los centros adjudicados"],
      [["¿Las licitaciones de limpieza están al alcance de pequeñas empresas?", "A menudo sí. Muchos órganos de contratación dividen el contrato en lotes por centro. Jarvis muestra los lotes, la duración, la subrogación y el plazo para decidir rápido."]]),
    b("sicherheitsdienst", "Seguridad y vigilancia", "Licitaciones públicas de seguridad privada, vigilancia y auxiliares de servicios",
      "Vigilancia de edificios, control de accesos, rondas, seguridad en eventos y auxiliares de servicios para ayuntamientos, hospitales y entes públicos. Jarvis encuentra las licitaciones y resume los requisitos: habilitación, número de vigilantes, convenio aplicable.",
      ["Vigilancia, control de accesos, rondas y auxiliares de servicios reconocidos", "Ficha con horarios, efectivos y documentación exigida", "Cuadrante de vigilantes con turnos libres que el equipo puede cubrir"],
      [["¿Jarvis ayuda a organizar a los vigilantes?", "Sí. Ves quién está disponible y qué habilitaciones están vigentes, planificas los turnos y el equipo cubre los turnos libres desde la app."]]),
    b("garten-landschaftsbau-winterdienst", "Jardinería", "Licitaciones públicas de mantenimiento de zonas verdes y arbolado",
      "Mantenimiento de jardines, siega, poda y arbolado viario: ayuntamientos, diputaciones y empresas públicas licitan estos contratos cada año, a menudo por lotes. Jarvis te muestra los de tus comunidades autónomas.",
      ["Mantenimiento, poda, plantaciones y vialidad invernal reconocidos", "Recordatorio de plazos y visitas", "Cuadrantes y registro de horas para las cuadrillas"],
      [["¿Cuándo publican los ayuntamientos sus contratos de jardinería?", "Todo el año, con más volumen a finales de invierno para la temporada siguiente. Jarvis te avisa cada mañana de los nuevos anuncios."]]),
    b("elektro", "Electricidad", "Licitaciones públicas de instalaciones eléctricas y telecomunicaciones",
      "Instalaciones eléctricas, alumbrado, fotovoltaica, telecomunicaciones y mantenimiento en colegios, polideportivos y edificios públicos. Jarvis encuentra el lote de electricidad incluso dentro de un gran contrato de obras.",
      ["Lote de electricidad reconocido en los contratos de obra completos", "Ficha con lotes, mediciones, plazos y clasificación exigida", "Plazos y preguntas al órgano de contratación en el calendario"],
      [["¿Merecen la pena las licitaciones públicas para un pequeño instalador?", "Sí. Muchos contratos se dividen en lotes o afectan a un solo edificio. Jarvis muestra tamaño, lugar y plazo de un vistazo."]]),
    b("sanitaer-heizung-lueftung", "Fontanería y climatización", "Licitaciones públicas de fontanería, calefacción y climatización",
      "Sustitución de calderas, ventilación, fontanería y mantenimiento de climatización en edificios públicos: uno de los oficios más licitados. Jarvis ordena los contratos según tus comunidades autónomas.",
      ["Lotes de fontanería y climatización reconocidos en obras y reformas", "Recordatorio antes de cada plazo", "Ficha con alcance, duración y requisitos (por ej. empresa instaladora habilitada)"],
      [["¿Cómo encuentro licitaciones de climatización cerca de mí?", "Al registrarte, Jarvis toma la comunidad autónoma de tu sede como zona de búsqueda. Puedes añadir o quitar comunidades en cualquier momento, sin coste."]]),
    b("maler-trockenbau", "Pintura y pladur", "Licitaciones públicas de pintura, yesos y tabiquería seca",
      "Pintura, yesos, tabiques de pladur y falsos techos forman parte de casi todas las reformas de edificios públicos. Jarvis encuentra estos lotes, aunque formen parte de una gran obra.",
      ["Lotes de pintura, yesos y falsos techos reconocidos", "Lugar y plazo de un vistazo", "Ficha con mediciones y plazo de ejecución"],
      [["¿Solo se trata de grandes obras?", "No. Muchos contratos se refieren a un colegio, una guardería o unas pocas viviendas y están al alcance de empresas de pocos trabajadores."]]),
    b("tischler-schreiner", "Carpintería", "Licitaciones públicas de carpintería de madera, puertas y ventanas",
      "Puertas, ventanas, mobiliario a medida y revestimientos se adjudican en lotes separados en casi todas las obras públicas. Jarvis encuentra los lotes que encajan con tu taller.",
      ["Lotes de carpintería reconocidos en las grandes obras", "Ficha con solvencia exigida y criterios de adjudicación", "Plazos y visitas en el calendario"],
      [["¿Tengo que leer todos los pliegos de cada licitación?", "No. Jarvis resume el anuncio. Si subes el PCAP y el PPT, Jarvis lee todos los documentos y redacta una ficha detallada."]]),
    b("dach-zimmerer", "Cubiertas", "Licitaciones públicas de cubiertas, estructuras de madera e impermeabilización",
      "Rehabilitación de cubiertas, estructuras de madera e impermeabilización de colegios y equipamientos públicos: Jarvis encuentra las licitaciones de tus comunidades autónomas e indica plazo, alcance y documentación.",
      ["Lotes de cubiertas, estructuras de madera e impermeabilización reconocidos", "Plazos y preguntas al órgano de contratación en el calendario", "Ficha con criterios de adjudicación"],
      [["¿Con qué frecuencia busca Jarvis?", "Cada día. Recibes las nuevas licitaciones por correo o notificación a la hora que elijas."]]),
    b("bodenbelaege-fliesen", "Suelos y alicatado", "Licitaciones públicas de pavimentos, suelos y alicatados",
      "Pavimentos, suelos de resina y alicatados se adjudican por separado en las reformas y obras públicas. Jarvis encuentra los lotes adecuados en tus comunidades autónomas.",
      ["Lotes de suelos y alicatado reconocidos en los contratos de obra", "Recordatorio de plazos y visitas", "Ficha con superficies y plazos"],
      [["¿En cuánto tiempo veo las nuevas licitaciones?", "Cada mañana, por correo o notificación en el móvil, a la hora que elijas."]]),
    b("zeitarbeit-personaldienstleister", "Trabajo temporal", "Licitaciones públicas de trabajo temporal y cesión de personal",
      "Hospitales, ayuntamientos y comedores buscan personal de ETT para cocina, limpieza, administración o atención, a menudo en acuerdos marco plurianuales. Muchos de estos contratos se publican bajo el nombre del servicio y no como «trabajo temporal». Jarvis los encuentra igualmente.",
      ["Reconoce necesidades de personal también en contratos de restauración, limpieza y recepción", "Cuadrante de puestas a disposición y registro de horas", "Validación en línea de las horas por el cliente"],
      [["¿Jarvis encuentra licitaciones que no mencionan el trabajo temporal?", "Sí. Jarvis analiza la necesidad real descrita en el anuncio, por ejemplo personal de comedor, y no solo la palabra clave."]]),
  ],
};

export const LAENDER: Land[] = [PL, ES];

const slug = (l: Land, br: Branche) => SLUGS[br.de][l.code];
const knoepfe = (l: Land) => `<div class="knopf-zeile"><a class="knopf" href="/sprache?zu=${l.code}&amp;weiter=%2Fregistrieren">${escape(l.registrieren)}</a><a class="knopf zweit" href="/sprache?zu=${l.code}&amp;weiter=%2Fdemo">${escape(l.demo)}</a></div>`;
const zahl = (l: Land, n: number) => n.toLocaleString(l.locale);
const datum = (l: Land, d: string | null) => d ? new Date(d).toLocaleDateString(l.locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: l.zone }) : "";

function zahlen(l: Land, s: Statistik | null): string {
  if (!s || !s.monat) return "";
  return `<div class="gewerk-zahlen"><div><strong>${zahl(l, s.monat)}</strong><span>${escape(l.monat)}</span></div>${s.offen ? `<div><strong>${zahl(l, s.offen)}</strong><span>${escape(l.offen)}</span></div>` : ""}</div>`;
}
function beispiele(l: Land, s: Statistik | null): string {
  if (!s?.beispiele.length) return "";
  return `<h2>${escape(l.auswahl)}</h2><ul class="kontakt-liste gewerk-beispiele">${s.beispiele.map((x) => `<li><div><strong>${l.link.test(x.link) ? `<a href="${escape(x.link)}" rel="noopener nofollow">${escape(x.titel)}</a>` : escape(x.titel)}</strong><span class="klein">${escape([x.auftraggeber, x.ort, x.frist ? `${l.frist} ${datum(l, x.frist)}` : ""].filter(Boolean).join(" · "))}</span></div></li>`).join("")}</ul>
<p class="klein">${escape(l.auswahlHinweis)}</p>`;
}

export function brancheSeite(l: Land, br: Branche, s: Statistik | null = null): string {
  const fragen = [...br.fragen, ...l.allgemein];
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: l.code, mainEntity: fragen.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }).replace(/</g, "\\u003c");
  return `<h1>${escape(br.h1)}</h1>
<p>${escape(br.intro)}</p>
${zahlen(l, s)}
${knoepfe(l)}
${beispiele(l, s)}
<h2>${escape(l.hilfe(br.name))}</h2>
<ul>${[...br.vorteile, ...l.immer].map((v) => `<li>${escape(v)}</li>`).join("")}</ul>
<p class="klein">${escape(l.cpvText)} ${br.cpv.map(escape).join(", ")}.</p>
<h2>${escape(l.fragenTitel)}</h2>
${fragen.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}
<h2>${escape(l.andere)}</h2>
<nav class="ordner-chips gewerk-liste" aria-label="${escape(l.andere)}">${l.branchen.filter((x) => x !== br).map((x) => `<a href="${LISTEN[l.code]}/${slug(l, x)}">${escape(x.name)}</a>`).join("")}</nav>
${l.quelle}
<script type="application/ld+json">${jsonld}</script>`;
}

export function landUebersicht(l: Land): string {
  return `<h1>${escape(l.titel)}</h1><p>${escape(l.einleitung)}</p>
<div class="konto-kacheln team-werkzeuge">${l.branchen.map((x) => `<a class="konto-kachel" href="${LISTEN[l.code]}/${slug(l, x)}"><strong>${escape(x.name)}</strong><span class="konto-pfeil" aria-hidden="true">›</span></a>`).join("")}</div>
${knoepfe(l)}
${l.quelle}`;
}

export const LAND_PFADE = LAENDER.flatMap((l) => [LISTEN[l.code], ...l.branchen.map((x) => `${LISTEN[l.code]}/${slug(l, x)}`)]);

const kopf = (l: Land, html: string, beschreibung: string, url: string, paar: string) =>
  html.replace('<html lang="de"', `<html lang="${l.code}"`).replace("</title>", `</title>\n<meta name="description" content="${escape(beschreibung)}">\n<link rel="canonical" href="${escape(url)}">\n${paar}`);

type LandEnv = { SUPABASE_URL: string; SUPABASE_KEY: string; WARTEN?: (p: Promise<unknown>) => void };

async function statistik(env: LandEnv, l: Land, br: Branche): Promise<Statistik | null> {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/land_statistik`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify({ land: l.code, praefixe: br.praefixe }) });
    return r.ok ? (await r.json()) as Statistik | null : null;
  } catch { return null; }
}

/** /pl/przetargi[/…] and /es/licitaciones[/…]; null for every other path. */
export async function landGewerke(request: Request, env: LandEnv, adresse: string, antwort: (html: string) => Response): Promise<Response | null> {
  const url = new URL(request.url);
  const pfad = url.pathname.replace(/\/$/, "");
  const l = LAENDER.find((x) => pfad === LISTEN[x.code] || pfad.startsWith(`${LISTEN[x.code]}/`));
  if (request.method !== "GET" || !l) return null;
  const liste = LISTEN[l.code];
  let r: Response;
  let s: Statistik | null = null;
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const schluessel = new Request(`${adresse}${pfad}?cache=1`);
  if (pfad === liste) {
    r = antwort(kopf(l, seite(l.titel, landUebersicht(l)), l.beschreibung, `${adresse}${liste}`, alternativen(adresse, null)));
  } else {
    const br = l.branchen.find((x) => `${liste}/${slug(l, x)}` === pfad);
    if (!br) return new Response(null, { status: 301, headers: { location: liste } });
    const alt = await cache?.match(schluessel).catch(() => undefined);
    if (alt) return alt;
    s = await statistik(env, l, br);
    r = antwort(kopf(l, seite(br.h1, brancheSeite(l, br, s)), l.meta(br.h1, s?.monat ? `${zahl(l, s.monat)} ${l.monat}. ` : ""), `${adresse}${pfad}`, alternativen(adresse, br.de)));
  }
  r.headers.set("cache-control", "public, max-age=3600");
  r.headers.set("x-jv-sprache", l.code);
  r.headers.delete("x-robots-tag");
  if (cache && s) env.WARTEN?.(cache.put(schluessel, r.clone()).catch(() => undefined));
  return r;
}
