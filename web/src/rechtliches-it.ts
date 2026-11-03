// Italian translation of the legal pages (rechtliches.ts) for visitors with app language it. Translation for information;
// the German version is binding (said on every page, with a link to it). Keep both in step: every change to the German
// text needs the same change here (test/rechtliches-it.test.ts compares the section counts).
import { escape } from "./seite.ts";
import { FIRMA } from "./rechtliches.ts";

const anschrift = () => `${escape(FIRMA.name)}, ${escape(FIRMA.firma)}<br>${escape(FIRMA.strasse)}<br>${escape(FIRMA.ort)}, Germania`;
const mail = () => `<a href="mailto:${FIRMA.email}">${FIRMA.email}</a>`;

/** Note on top of every Italian legal page, with the link to the binding German version. */
export function hinweisDeutschIt(pfad: string): string {
  return `<p class="hinweis">Traduzione fornita a solo scopo informativo. Fa fede esclusivamente la <a href="/sprache?zu=de&amp;weiter=${encodeURIComponent(pfad)}" hreflang="de" lang="de">versione tedesca</a>.</p>`;
}

export function impressumIt(): string {
  return `<h2>Informazioni ai sensi del § 5 della legge tedesca sui servizi digitali (DDG)</h2>
<p>${anschrift()}</p>
<h2>Contatti</h2>
<p>E-mail: ${mail()}<br>Modulo di contatto: <a href="/kontakt">app.wpdigitalranger.com/kontakt</a>${FIRMA.telefon ? `<br>Telefono: ${escape(FIRMA.telefon)}` : ""}</p>
${FIRMA.ustId ? `<h2>IVA</h2><p>Partita IVA ai sensi del § 27a della legge tedesca sull'IVA (UStG): ${escape(FIRMA.ustId)}</p>` : FIRMA.kleinunternehmer ? `<h2>IVA</h2><p>Piccolo imprenditore ai sensi del § 19 della legge tedesca sull'IVA (UStG); pertanto non viene addebitata l'IVA.</p>` : ""}
<h2>Responsabile dei contenuti</h2>
<p>${escape(FIRMA.name)}, indirizzo come sopra.</p>
<h2>Risoluzione delle controversie dei consumatori</h2>
<p>Jarvis si rivolge esclusivamente alle imprese. Non siamo disposti né obbligati a partecipare a procedure di risoluzione delle controversie dinanzi a un organismo di conciliazione per i consumatori.</p>
<h2>Fonti</h2>
<p>Bandi di gara: servizio di pubblicazione dei bandi della Federazione tedesca (oeffentlichevergabe.de), licenza CC0; BOAMP, DILA (Francia), Licence Ouverte 2.0; TED, Ufficio delle pubblicazioni dell'UE (riutilizzo con indicazione della fonte); Biuletyn Zamówień Publicznych, UZP (Polonia); Plataforma de serveis de contractació pública, Generalitat de Catalunya (Spagna), Llicència oberta d'ús d'informació – Catalunya; SAM.gov e USAspending.gov (USA, dati pubblici del governo federale statunitense); ANAC (Italia), licenza CC BY 4.0; dati essenziali ai sensi della legge austriaca sugli appalti pubblici (BVergG 2018) tramite data.gv.at (Austria), licenza CC BY 4.0 (tradotti e riassunti). Coordinate dei codici postali: GeoNames, licenza CC BY 4.0. Programmi di finanziamento: banca dati federale tedesca dei finanziamenti (Förderdatenbank des Bundes), licenza CC BY-ND 4.0 DE (solo titolo e link). Le valutazioni e le schede riassuntive sono redatte da Jarvis stesso.</p>
`;
}

const DIENSTLEISTER_IT = [
  ["Cloudflare, Inc., San Francisco (USA)", "Gestione del sito web, archiviazione dei documenti caricati (data center nell'UE), conversione dei file in testo", "EU-US Data Privacy Framework (quadro UE-USA per la protezione dei dati), clausole contrattuali standard"],
  ["Supabase, Inc., San Francisco (USA)", "Accesso e banca dati (imprese, membri, bandi di gara); server a Francoforte sul Meno", "Clausole contrattuali standard"],
  ["Anthropic, PBC, San Francisco (USA)", "Modello di IA Claude: legge i bandi e i documenti di gara caricati, elabora i profili di ricerca delle imprese con una ricerca web limitata (ragione sociale, testo del sito web, sede), legge le foto dei giustificativi (importo, data, fornitore), le date di scadenza sugli attestati dell'impresa e i lotti dalle schede riassuntive e redige valutazioni e schede riassuntive. Nessun dato dal fascicolo personale. Secondo il fornitore, i dati dell'API non vengono utilizzati per l'addestramento e vengono conservati solo per un periodo limitato", "Clausole contrattuali standard"],
  ["Namecheap, Inc., Phoenix (USA)", "Casella di posta kontakt@wpdigitalranger.com: link di accesso, inviti e messaggi", "Clausole contrattuali standard"],
  ["GitHub, Inc. (Microsoft), San Francisco (USA)", "Analisi quotidiana dei bandi di gara pubblici con i profili di ricerca delle imprese; backup notturno cifrato", "EU-US Data Privacy Framework (quadro UE-USA per la protezione dei dati), clausole contrattuali standard"],
];

const tabelle = () =>
  `<table><tr><th>Fornitore</th><th>Per cosa</th><th>Base del trasferimento</th></tr>${DIENSTLEISTER_IT.map((z) => `<tr>${z.map((x) => `<td>${escape(x)}</td>`).join("")}</tr>`).join("")}</table>`;

export function datenschutzIt(): string {
  return `<p class="klein">Versione del ${FIRMA.standDatenschutz}</p>
<h2>1. Titolare del trattamento</h2>
<p>${anschrift()}<br>E-mail: ${mail()}</p>
<h2>2. Che cosa fa Jarvis</h2>
<p>Jarvis cerca ogni giorno bandi di gara pubblici, valuta se sono adatti a un'impresa e redige schede riassuntive. I clienti possono caricare i documenti di gara, che Jarvis analizza. Jarvis offre inoltre un'interfaccia di lavoro per personale, pianificazione degli impieghi, rilevazione delle presenze, fatturazione, clienti e chat del team. Dei dati che un'impresa vi inserisce sul proprio personale, sui candidati e sui clienti è responsabile l'impresa; noi li trattiamo per suo conto (<a href="/avv">accordo sul trattamento dei dati</a>). Jarvis si rivolge esclusivamente alle imprese.</p>
<h2>3. Quali dati trattiamo</h2>
<ul>
<li><strong>Alla visita del sito:</strong> dati tecnicamente necessari (indirizzo IP, ora, pagina visitata, browser). Il gestore dei server (Cloudflare) li conserva per breve tempo per motivi di sicurezza e per la ricerca degli errori. Base giuridica: art. 6, par. 1, lett. f), del Regolamento (UE) 2016/679 (GDPR) (funzionamento sicuro).</li>
<li><strong>Modulo di contatto:</strong> nome, indirizzo e-mail e messaggio. Li inviamo via e-mail alla nostra casella (Namecheap) e li usiamo solo per rispondere. Nessuna memorizzazione nella banca dati; cancelliamo l'e-mail quando la richiesta è evasa e non sussiste un obbligo di conservazione. Base giuridica: art. 6, par. 1, lett. b), del GDPR (richiesta relativa a un contratto) o lett. f) (risposta alle richieste).</li>
<li><strong>Account:</strong> nome, indirizzo e-mail, password (memorizzata solo in forma cifrata), nome, indirizzo e, facoltativamente, numero di telefono dell'impresa, momento della registrazione, del consenso e dell'accesso, appartenenza a imprese, funzione nell'azienda, diritti di accesso e aree. Base giuridica: art. 6, par. 1, lett. b), GDPR (contratto).</li>
<li><strong>Dati dell'impresa:</strong> ragione sociale, sedi, sito web indicato facoltativamente, profilo di ricerca, bandi di gara con stato e note, valori di calcolo dei costi. Nella ricerca automatica per configurare il profilo di ricerca, la ragione sociale, il sito web e la sede dell'impresa vengono trasmessi alla ricerca web pubblica di Anthropic; le fonti pubbliche pertinenti vengono salvate nel profilo con il relativo URL. Base giuridica: art. 6, par. 1, lett. b), GDPR. A ogni nuova registrazione il gestore riceve una notifica sul cellulare con la ragione sociale, per individuare eventuali abusi (art. 6, par. 1, lett. f), GDPR).</li>
<li><strong>Documenti caricati:</strong> documenti di gara di un bando. Possono contenere nomi e dati di contatto di referenti della stazione appaltante. Vengono letti solo per la scheda riassuntiva e <strong>cancellati dopo 30 giorni</strong>. La preghiamo di non caricare documenti con dati dei Suoi dipendenti (ad es. curriculum). I testi vengono inviati per la lettura al servizio di IA Anthropic (vedi Fornitori di servizi).</li>
<li><strong>Referenti presso stazioni appaltanti e imprese partner:</strong> nome, funzione, telefono ed e-mail di lavoro, nonché una nota e una valutazione inserite dall'impresa stessa, referenti di contratti e di richieste a subappaltatori. L'impresa ne è responsabile; noi trattiamo i dati per suo conto. Visibili solo al personale d'ufficio di tale impresa; cancellati quando l'impresa elimina la voce o il proprio account.</li>
<li><strong>Personale dell'impresa (pianificazione degli impieghi):</strong> nome, mestieri, qualifiche, livello retributivo, numero di telefono, facoltativamente indirizzo e-mail e foto, disponibilità, periodi di assenza (solo «ferie», «formazione» o «non disponibile», senza dati sanitari), impieghi presso clienti con periodo (per i termini previsti dalla legge tedesca sulla somministrazione di lavoro, AÜG), data di assunzione, tipo di rapporto, ore settimanali, categorie di patente, lingue, codice postale di residenza (solo per la distanza dal luogo d'impiego), attestati di qualifica con data di scadenza e file caricato facoltativamente, partecipazione a istruzioni sulla sicurezza e nota sui lavoratori, inseriti dall'impresa stessa. L'impresa ne è responsabile; noi trattiamo i dati per suo conto (accordo sul trattamento dei dati). Visibili solo ai membri con accesso alla sede; conservati finché l'impresa non li cancella. Jarvis non invia direttamente messaggi a queste persone: vengono inviati tramite WhatsApp, SMS o e-mail dal dispositivo dell'impresa.</li>
<li><strong>Gestione autonoma da parte dei dipendenti:</strong> se un'impresa collega l'accesso all'app di un lavoratore al suo fascicolo personale, questa persona vede solo i propri dati: i propri impieghi, le proprie assenze, i propri attestati e le proprie istruzioni sulla sicurezza. Può richiedere ferie (salvate come «richieste» fino alla conferma dell'ufficio) e caricare i propri attestati. Non vede i dati di altre persone.</li>
<li><strong>Ore, turni, comunicazioni (da novembre 2026):</strong> fogli ore (data, inizio, fine, pausa, impiego, nota, approvazione da parte di chi e quando), turni (data, ora, luogo, accettazione o rifiuto), comunicazioni in bacheca con conferma di lettura (chi ha letto e quando), scadenze del personale (fine del periodo di prova, fine di un contratto a termine, validità del permesso di soggiorno o di lavoro – solo la data, nessuna copia), controlli della patente (data, categorie, chi ha effettuato il controllo) e istruzioni sulla sicurezza confermate digitalmente (data, ora). I lavoratori vedono solo i propri dati. Per le notifiche sul cellulare relative a nuovi turni e comunicazioni conserviamo titolo e testo breve per al massimo 30 giorni. L'impresa è responsabile, noi trattiamo per suo conto; conservati finché l'impresa non li cancella (le modifiche a ore, turni e controlli restano 12 mesi nel registro delle modifiche).</li>
<li><strong>Clienti, luoghi d'impiego, rapportini di lavoro:</strong> clienti dell'impresa (nome, indirizzo, referente, telefono, e-mail, nota; tariffa di fatturazione solo per persone con autorizzazione finanziaria) e luoghi d'impiego (indirizzo, referente sul posto, punto d'incontro, abbigliamento, indicazioni). I lavoratori vedono solo il luogo d'impiego del proprio turno. Jarvis calcola i rapportini di lavoro e le ore con maggiorazione (notte, domenica, festivo) dai fogli ore approvati e non salva nulla di aggiuntivo a tale scopo. Se un lavoratore segnala un'assenza improvvisa, salviamo solo il giorno e il fatto che è avvenuta con breve preavviso, senza motivo e senza dati sanitari. Per i certificati del casellario giudiziale e i certificati sanitari Jarvis salva solo la data della presa visione, nessuna copia.</li>
<li><strong>Candidature, dispositivi di protezione, liste di controllo, ferie, valutazioni:</strong> i dati dei candidati (nome, contatti, mestiere, fonte, stato, data del colloquio, nota, documenti caricati) sono visibili solo agli addetti, ai responsabili di sede e agli amministratori; vengono cancellati 6 mesi dopo un rifiuto (termine previsto dalla legge tedesca sulla parità di trattamento, AGG) oppure 30 giorni dopo l'assunzione. Inoltre: dispositivi di protezione consegnati (articolo, taglia, data, sostituzione, restituzione), liste di controllo di ingresso e di uscita con data di uscita, conti ferie (spettanza, riporto) e valutazioni degli impieghi da parte dei clienti (stelle, se lo richiamerebbero volentieri, nota). Valutazioni e liste di controllo sono visibili solo all'ufficio (non agli accessi in sola lettura, come lo studio del commercialista); i lavoratori vedono i propri dispositivi di protezione e il proprio conto ferie. L'impresa è responsabile, noi trattiamo per suo conto.</li>
<li><strong>Organizzazione del team:</strong> sostituzioni (chi sostituisce chi, da quando a quando, nota facoltativa), attività (titolo, persona incaricata, scadenza, data di completamento), nonché veicoli e attrezzature (denominazione, targa o numero di inventario, tipo di verifica e prossima data di verifica). Visibili al personale d'ufficio dell'impresa, non ai lavoratori; conservati finché l'impresa non li cancella. Durante una sostituzione, i promemoria delle scadenze vengono inviati al sostituto anziché alla persona assente. <strong>Chat del team:</strong> messaggi (testo, chi, quando) per impresa, sede o luogo d'impiego; visibili solo alle persone di quella chat, cancellati dopo 180 giorni. <strong>Ronde e registro di servizio:</strong> scansione di un punto di controllo (chi, quando, quale punto) e annotazioni nel registro di servizio; visibili all'ufficio della relativa sede, non agli accessi in sola lettura. <strong>Portale clienti:</strong> tramite un link segreto un cliente dell'impresa vede i rapportini di lavoro (totali senza nomi), su richiesta le fatture e i giri di controllo e, in caso di incidenti, solo l'ora e il luogo, senza testo; il cliente può inviare segnalazioni. Viene salvato solo un hash del link; l'impresa può disattivarlo in qualsiasi momento. L'impresa è responsabile, noi trattiamo per suo conto.</li>
<li><strong>Documentazione aziendale, modelli di offerta, cartelle di offerta e ricevute di presentazione:</strong> attestati, modelli e ricevute di consegna depositati consapevolmente dall'impresa, nonché bozze di offerta, restano memorizzati fino alla cancellazione da parte dell'amministrazione o fino alla chiusura dell'account aziendale. L'accesso avviene in base ai diritti assegnati. La data di scadenza di un attestato ne impedisce l'uso in una nuova cartella di offerta dopo tale data, ma non cancella automaticamente il file. Se le e-mail aziendali sono attivate, i promemoria di scadenza vengono inviati 30, 14, 7 e 2 giorni prima ai membri con accesso finanziario.</li>
<li><strong>Messaggio giornaliero:</strong> solo se sceglie Lei stesso un orario, Le inviamo una volta al giorno i nuovi risultati e i promemoria delle scadenze via e-mail o sul cellulare. Per le notifiche sul cellulare salviamo l'indirizzo push che il Suo browser assegna a tale scopo; la notifica passa attraverso il servizio push del Suo browser (ad es. Google o Apple), ma senza testo: il Suo cellulare lo recupera poi direttamente da noi. Disattivabile in qualsiasi momento nella panoramica alla voce «Messaggio giornaliero». Base giuridica: art. 6, par. 1, lett. b), GDPR.</li>
<li><strong>Fatturazione, rilevazione delle presenze, firme (da novembre 2026):</strong> fatture (numero, cliente, mese, voci, importi, dati dell'emittente e del destinatario congelati al momento dell'emissione; solo con autorizzazione finanziaria; le fatture emesse non vengono cancellate, ma stornate), giustificativi (data, fornitore, importo, file; su richiesta il servizio di IA legge la foto del giustificativo e l'ufficio verifica la proposta; i giustificativi vengono stornati anziché cancellati), numero di matricola e data di nascita nel fascicolo personale (la data di nascita solo per il promemoria in ufficio), note spese con foto del giustificativo (tipo, importo, data, nota, approvazione), conto ore (data di inizio e saldo iniziale; ore previste ed effettive vengono calcolate dalle ore), timbrature (entrata, pausa, ripresa, uscita con l'ora del server). Con la timbratrice il cellulare chiede una sola volta, facoltativamente, la posizione; al momento della timbratura la confrontiamo con il codice postale del luogo d'impiego e salviamo solo «sul luogo d'impiego sì/no», mai le coordinate. Firme con il dito (immagine, data, per cosa) per la ricezione dei dispositivi di protezione e le ore mensili. Link di conferma per i clienti: elenco congelato delle ore del mese, nome della persona che conferma, osservazione, firma facoltativa, momento; il link è valido 30 giorni, viene salvato solo un hash del link. Link di invito per lavoratori senza indirizzo e-mail (validi 14 giorni, viene salvato solo un hash). L'impresa è responsabile, noi trattiamo per suo conto. Jarvis non invia direttamente fatture né link.</li>
<li><strong>Backup e messaggi di errore:</strong> ogni notte viene eseguito un backup cifrato della banca dati (nello spazio di archiviazione di Cloudflare con data center nell'UE; creato tramite GitHub Actions). I backup giornalieri vengono cancellati dopo 14 giorni, quelli mensili dopo un anno; al più tardi a quel punto i dati cancellati scompaiono anche dai backup. I messaggi di errore tecnici inviati al gestore non contengono nomi né indirizzi e-mail e vengono cancellati dopo 30 giorni.</li>
<li><strong>Inviti:</strong> indirizzo e-mail della persona invitata, per poterle inviare il link di invito (nei link per i lavoratori, solo nome e collegamento al fascicolo personale).</li>
</ul>
<h2>4. Cookie</h2>
<p>Utilizziamo solo cookie tecnicamente necessari: per l'accesso (jv_at, jv_rt, jv_pkce), l'ultima impresa selezionata (jv_firma), nonché per le Sue scelte e l'utilizzo: lingua, paese, visualizzazione e vista (jv_psprache, jv_sprache, jv_land, jv_darstellung, jv_ansicht), bandi aperti di recente e ultima visita (jv_zuletzt, jv_gesehen) e se l'introduzione è già stata mostrata (jv_einfuehrung). Non ci sono pubblicità, analisi né tracciamento. Base giuridica: § 25, comma 2, n. 2, della legge tedesca sulla protezione dei dati nelle telecomunicazioni e nei servizi digitali (TDDDG).</p>
<h2>5. Fornitori di servizi</h2>
<p>Ci avvaliamo di questi fornitori di servizi in qualità di responsabili del trattamento (art. 28 GDPR). Alcuni hanno sede negli USA. Il trasferimento è tutelato dalle garanzie indicate.</p>
${tabelle()}
<h2>6. Periodo di conservazione</h2>
<p>Documenti caricati e schede riassuntive elaborate a partire da essi: 30 giorni. Documentazione aziendale e modelli riutilizzabili: fino alla cancellazione da parte dell'amministrazione o fino alla chiusura dell'account aziendale. Registro delle modifiche (chi ha modificato cosa e quando nell'impresa, visibile solo al titolare): 12 mesi. Notifiche sul cellulare (titolo e testo breve): 30 giorni. Chat del team: 180 giorni. Fogli ore, timbrature e somministrazioni (AÜG) di una persona: almeno 2 anni (§ 17 MiLoG); fino ad allora la persona non può essere cancellata. Bozze di offerta e approvazioni dei testi, nonché gli altri dati dell'account e dell'impresa: finché esiste l'account; successivamente vengono cancellati. Fatture e giustificativi devono essere conservati dall'impresa stessa per un periodo da 8 a 10 anni (§ 147 AO, § 14b UStG); prima della cancellazione dell'account offriamo a tal fine un archivio completo da scaricare.</p>
<h2>7. I Suoi diritti</h2>
<p>Alla voce «Il mio profilo» può scaricare autonomamente i Suoi dati, modificare il Suo nome ed eliminare il Suo account.</p>
<p>Ha diritto di accesso, rettifica, cancellazione, limitazione del trattamento, portabilità dei dati e opposizione ai trattamenti basati sull'art. 6, par. 1, lett. f), GDPR. A tal fine scriva a ${mail()}. Può inoltre proporre reclamo a un'autorità di controllo per la protezione dei dati, ad esempio al Garante per la protezione dei dati personali (www.garanteprivacy.it)${FIRMA.aufsicht ? ` o all'autorità competente per noi: ${escape(FIRMA.aufsicht)}` : ""}.</p>
<h2>8. Obbligo di fornire i dati</h2>
<p>Senza indirizzo e-mail non è possibile registrarsi. Tutto il resto è facoltativo.</p>`;
}

export function nutzungsbedingungenIt(): string {
  return `<p class="klein">Versione del ${FIRMA.stand}</p>
<h2>1. Fornitore e ambito di applicazione</h2>
<p>Jarvis è un servizio di ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} («noi»). Le presenti condizioni si applicano a tutte le imprese e persone che utilizzano Jarvis («cliente»). Jarvis si rivolge esclusivamente a imprenditori ai sensi del § 14 del codice civile tedesco (BGB).</p>
<h2>2. Servizio</h2>
<ul>
<li>Jarvis cerca ogni giorno bandi di gara pubblici in base al profilo di ricerca del cliente, li valuta e redige schede riassuntive a partire dal bando pubblico. A ciò si aggiunge un'interfaccia di lavoro per personale, pianificazione degli impieghi, rilevazione delle presenze, fatturazione, clienti e chat del team. Le funzioni basate sul diritto tedesco (ad es. retribuzioni, maggiorazioni, fatture, IVA) sono disponibili solo per imprese in Germania; non sostituiscono la verifica da parte del commercialista o dell'ufficio paghe.</li>
<li>Il cliente può caricare i documenti di gara. Jarvis ne ricava una scheda riassuntiva dettagliata e aiuta nel calcolo dei costi.</li>
<li>Le imprese possono depositare attestati e modelli propri, modificare bozze di offerta e scaricare una cartella di offerta. Le versioni dell'offerta devono essere approvate dalla direzione dell'impresa prima del download. La presentazione avviene a cura del cliente attraverso il canale previsto dalla stazione appaltante; creare o scaricare una cartella non costituisce presentazione. Una ricevuta di consegna caricata successivamente documenta la presentazione comunicata dal cliente.</li>
<li>Jarvis non scarica direttamente documenti di gara da portali le cui condizioni lo vietano. Il download viene effettuato dal cliente stesso tramite il link al portale.</li>
</ul>
<h2>3. IA ed esclusione di garanzia</h2>
<p>Valutazioni, schede riassuntive e calcoli dei costi sono elaborati da un'IA. Possono essere incompleti o errati. Fanno fede esclusivamente i documenti originali della stazione appaltante. Prima di ogni offerta il cliente verifica personalmente termini, requisiti e prezzi. Jarvis non costituisce consulenza legale o fiscale. Non garantiamo che Jarvis trovi ogni bando adatto.</p>
<h2>4. Obblighi del cliente</h2>
<ul>
<li>Il cliente carica solo documenti che ha il diritto di utilizzare e rispetta le condizioni dei portali di gara.</li>
<li>Il cliente è responsabile dei dati che inserisce sul proprio personale, sui candidati e sui clienti e informa tali persone (art. 13 GDPR). Non inserisce nei campi di testo libero dati sanitari o altre categorie particolari (art. 9 GDPR) né dati relativi a condanne penali e reati (art. 10 GDPR). Utilizza le funzioni che possono valutare la prestazione o il comportamento dei dipendenti (ad es. timbratrice, valutazioni, ronde) solo nella misura in cui ciò gli è consentito; in presenza di un consiglio aziendale (Betriebsrat) ne rispetta il diritto di codecisione (§ 87, comma 1, n. 6, BetrVG).</li>
<li>Gli accessi sono personali. Il cliente invita solo persone che lavorano per lui e le rimuove quando lasciano l'impresa.</li>
</ul>
<h2>5. Prezzi</h2>
<p>Prezzi e pacchetto vengono concordati separatamente con ciascuna impresa. Durante un'anteprima o un periodo di prova Jarvis è gratuito; un periodo di prova termina automaticamente, senza che inizi un pacchetto a pagamento. Durante le prove il volume delle analisi tramite IA può essere limitato. I prezzi si intendono al netto dell'IVA, ove dovuta.</p>
<h2>6. Disponibilità</h2>
<p>Ci impegniamo a garantire un funzionamento senza interruzioni, ma non assicuriamo una determinata disponibilità. Manutenzione e guasti presso i fornitori di servizi possono causare interruzioni.</p>
<h2>7. Responsabilità</h2>
<p>Rispondiamo in modo illimitato in caso di dolo, colpa grave e lesione della vita, dell'integrità fisica o della salute. In caso di colpa lieve rispondiamo solo per la violazione di obblighi contrattuali essenziali, limitatamente al danno prevedibile e tipico e al massimo fino al corrispettivo degli ultimi 12 mesi. In caso di utilizzo gratuito (anteprima, periodo di prova), per colpa lieve rispondiamo solo in applicazione analogica dei § 521 e § 599 BGB, quindi solo per dolo e colpa grave. La prima frase resta in ogni caso impregiudicata. In caso di colpa lieve non rispondiamo di termini mancati, bandi non trovati o procedure di gara perse, nella misura in cui derivino da indicazioni dell'IA che il cliente deve verificare personalmente ai sensi del punto 3.</p>
<h2>8. Protezione dei dati</h2>
<p>Nella misura in cui trattiamo dati personali per conto del cliente, si applica l'<a href="/avv">accordo sul trattamento dei dati</a>. Maggiori informazioni nell'<a href="/datenschutz">informativa sulla privacy</a>.</p>
<h2>9. Durata e recesso</h2>
<p>Entrambe le parti possono recedere in qualsiasi momento con effetto alla fine del mese, salvo diverso accordo. Fino al termine il cliente può scaricare i propri dati (ad es. archivio di tutte le fatture e dei giustificativi, ore, elenco paghe). Al termine cancelliamo i dati dell'impresa entro 30 giorni; dai backup cifrati scompaiono al più tardi dopo un anno.</p>
<h2>10. Disposizioni finali</h2>
<p>Si applica il diritto tedesco. Il foro competente è, nei limiti consentiti, quello della nostra sede. Le modifiche alle presenti condizioni vengono comunicate via e-mail. Le modifiche che non peggiorano la posizione del cliente o che riguardano solo nuove funzioni si intendono accettate se il cliente non si oppone entro 4 settimane; nella comunicazione segnaliamo tale conseguenza. Le modifiche ai prezzi o alle prestazioni principali richiedono il consenso del cliente; in mancanza di consenso, ciascuna parte può recedere con effetto alla fine del mese.</p>`;
}

export function avvIt(): string {
  return `<p>Accordo ai sensi dell'art. 28 GDPR tra l'impresa che utilizza Jarvis («titolare del trattamento») e ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} («responsabile del trattamento»). Si applica con l'utilizzo di Jarvis. Versione del ${FIRMA.stand}.</p>
<h2>1. Oggetto</h2>
<p>Il responsabile del trattamento gestisce per il titolare del trattamento il software Jarvis secondo le <a href="/nutzungsbedingungen">condizioni d'uso</a>: ricerca e analisi di bandi di gara, offerte, gestione del personale, pianificazione degli impieghi, rilevazione delle presenze, fatturazione, gestione delle candidature, gestione dei clienti con portale clienti, ronde e registro di servizio nonché chat del team. Durata: finché Jarvis viene utilizzato.</p>
<h2>2. Tipo di dati e interessati</h2>
<ul>
<li>Dati: nomi, dati di contatto e ruoli degli utenti; dati dell'impresa e delle sedi, note e stati di lavorazione; documenti di gara caricati (che possono contenere dati di contatto di referenti delle stazioni appaltanti); dati del personale (dati anagrafici, mestieri, qualifiche e attestati con data di scadenza, livello retributivo e paga oraria, assenze senza motivo, turni, fogli ore, timbrature con «sul luogo d'impiego sì/no», note spese, istruzioni sulla sicurezza, dispositivi di protezione, valutazioni da parte dei clienti, firme, somministrazioni ai sensi dell'AÜG); dati dei candidati; clienti e luoghi d'impiego; fatture e giustificativi; scansioni delle ronde e annotazioni nel registro di servizio; messaggi della chat. Categorie particolari (art. 9 GDPR) e dati relativi a condanne penali e reati (art. 10 GDPR) non devono essere inseriti; per i certificati del casellario giudiziale e i certificati sanitari Jarvis salva solo la data della presa visione.</li>
<li>Interessati: dipendenti, lavoratori somministrati e candidati del titolare del trattamento, utenti, clienti e loro referenti, referenti delle stazioni appaltanti e delle imprese partner.</li>
<li>Finalità: ricerca, valutazione e analisi di bandi di gara, predisposizione delle offerte, pianificazione del personale e degli impieghi, rilevazione delle presenze, fatturazione e collaborazione nel team.</li>
</ul>
<h2>3. Obblighi del responsabile del trattamento</h2>
<ul>
<li>Tratta i dati soltanto su istruzione documentata del titolare del trattamento; l'utilizzo delle funzioni di Jarvis vale come istruzione. Se ritiene che un'istruzione violi la normativa, ne informa immediatamente il titolare del trattamento (art. 28, par. 3, secondo comma, GDPR).</li>
<li>Le persone con accesso sono vincolate alla riservatezza.</li>
<li>Adotta le misure tecniche e organizzative di cui al punto 6.</li>
<li>Assiste il titolare del trattamento nelle richieste degli interessati e negli obblighi di cui agli artt. da 32 a 36 GDPR.</li>
<li>Notifica senza ingiustificato ritardo le violazioni dei dati personali, possibilmente entro 24 ore.</li>
<li>Al termine dell'incarico cancella i dati entro 30 giorni o, su richiesta, li restituisce prima in formati di uso comune (CSV, Excel, Word, XRechnung, file originali); dai backup cifrati scompaiono al più tardi dopo un anno.</li>
<li>Mette a disposizione tutte le informazioni necessarie a dimostrare il rispetto di tali obblighi e consente verifiche previo preavviso.</li>
</ul>
<h2>4. Sub-responsabili del trattamento</h2>
<p>Il titolare del trattamento autorizza questi sub-responsabili. Il responsabile del trattamento impone loro contrattualmente gli stessi obblighi in materia di protezione dei dati (art. 28, par. 4, GDPR). Informa in anticipo via e-mail di eventuali nuovi sub-responsabili; il titolare del trattamento può opporsi per giustificato motivo entro 14 giorni.</p>
${tabelle()}
<h2>5. Paesi terzi</h2>
<p>I trasferimenti verso gli USA avvengono solo sulla base delle garanzie indicate nella tabella (artt. 44 e seguenti GDPR).</p>
<h2>6. Misure tecniche e organizzative</h2>
<ul>
<li>Trasmissione cifrata (HTTPS), archiviazione dei documenti in data center nell'UE.</li>
<li>Accesso con password (memorizzata solo in forma cifrata, almeno 8 caratteri) o tramite link via e-mail; cookie di sessione solo tramite HTTPS e non leggibili dagli script.</li>
<li>Diritti a livello di banca dati: ciascuno vede solo i dati della propria impresa e delle proprie aree.</li>
<li>I documenti caricati vengono cancellati automaticamente dopo 30 giorni.</li>
<li>Registro delle modifiche: le modifiche a personale, sedi, accessi e bandi di gara vengono registrate con persona e ora, sono visibili solo al titolare e vengono cancellate dopo 12 mesi.</li>
<li>Gli accessi ai fornitori di servizi sono riservati al responsabile del trattamento e protetti con autenticazione forte.</li>
<li>Backup notturno cifrato della banca dati (AES-256) nello spazio di archiviazione di Cloudflare con data center nell'UE; backup giornalieri conservati 14 giorni, backup mensili un anno.</li>
</ul>
<h2>7. Disposizioni finali</h2>
<p>In caso di contraddizioni, il presente accordo prevale sulle condizioni d'uso per quanto riguarda la protezione dei dati. Chi necessita di un accordo firmato può scrivere a ${mail()}.</p>`;
}

export const RECHT_IT: Record<string, [string, () => string]> = {
  "/impressum": ["Note legali", impressumIt],
  "/datenschutz": ["Informativa sulla privacy", datenschutzIt],
  "/nutzungsbedingungen": ["Condizioni d'uso", nutzungsbedingungenIt],
  "/avv": ["Accordo sul trattamento dei dati (art. 28 GDPR)", avvIt],
};
