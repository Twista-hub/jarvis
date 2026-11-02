// French translation of the legal pages (rechtliches.ts) for visitors with app language fr. Translation for information;
// the German version is binding (said on every page, with a link to it). Keep both in step: every change to the German
// text needs the same change here (test/rechtliches-fr.test.ts compares the section counts).
import { escape } from "./seite.ts";
import { FIRMA } from "./rechtliches.ts";

const anschrift = () => `${escape(FIRMA.name)}, ${escape(FIRMA.firma)}<br>${escape(FIRMA.strasse)}<br>${escape(FIRMA.ort)}, Allemagne`;
const mail = () => `<a href="mailto:${FIRMA.email}">${FIRMA.email}</a>`;

/** Note on top of every French legal page, with the link to the binding German version. */
export function hinweisDeutsch(pfad: string): string {
  return `<p class="hinweis">Traduction fournie à titre d'information. Seule la <a href="/sprache?zu=de&amp;weiter=${encodeURIComponent(pfad)}" hreflang="de" lang="de">version allemande</a> fait foi.</p>`;
}

export function impressumFr(): string {
  return `<h2>Informations selon le § 5 de la loi allemande sur les services numériques (DDG)</h2>
<p>${anschrift()}</p>
<h2>Contact</h2>
<p>E-mail : ${mail()}${FIRMA.telefon ? `<br>Téléphone : ${escape(FIRMA.telefon)}` : ""}</p>
${FIRMA.ustId ? `<h2>TVA</h2><p>Numéro de TVA intracommunautaire selon le § 27a UStG : ${escape(FIRMA.ustId)}</p>` : FIRMA.kleinunternehmer ? `<h2>TVA</h2><p>Petite entreprise au sens du § 19 de la loi allemande sur la TVA (UStG) : aucune TVA n'est facturée.</p>` : ""}
<h2>Responsable du contenu</h2>
<p>${escape(FIRMA.name)}, adresse ci-dessus.</p>
<h2>Règlement des litiges de consommation</h2>
<p>Jarvis s'adresse uniquement aux entreprises. Nous ne sommes ni disposés ni tenus à participer à une procédure de règlement des litiges devant un organisme de médiation de la consommation.</p>
<h2>Sources</h2>
<p>Appels d'offres : service de publication de la fédération allemande (oeffentlichevergabe.de), licence CC0 ; BOAMP, DILA (France), Licence Ouverte 2.0. Programmes d'aide : base de données fédérale allemande des aides, licence CC BY-ND 4.0 DE (titre et lien uniquement). Les notes et fiches synthèse sont rédigées par Jarvis.</p>
`;
}

const DIENSTLEISTER_FR = [
  ["Cloudflare, Inc., San Francisco (États-Unis)", "Fonctionnement du site, stockage des documents déposés (centres de données dans l'UE), conversion des fichiers en texte", "EU-US Data Privacy Framework, clauses contractuelles types"],
  ["Supabase, Inc., San Francisco (États-Unis)", "Connexion et base de données (entreprises, membres, appels d'offres) ; serveurs à Francfort-sur-le-Main", "Clauses contractuelles types"],
  ["Anthropic, PBC, San Francisco (États-Unis)", "Modèle d'IA Claude : lit les avis et les documents, établit les profils de recherche des entreprises avec une recherche web limitée et rédige les notes et fiches synthèse. Selon le fournisseur, les données transmises par l'API ne servent pas à l'entraînement", "Clauses contractuelles types"],
  ["Namecheap, Inc., Phoenix (États-Unis)", "Boîte e-mail kontakt@wpdigitalranger.com : liens de connexion, invitations et messages", "Clauses contractuelles types"],
  ["GitHub, Inc. (Microsoft), San Francisco (États-Unis)", "Analyse quotidienne des appels d'offres publics avec les profils de recherche des entreprises ; sauvegarde chiffrée chaque nuit", "EU-US Data Privacy Framework, clauses contractuelles types"],
];

const tabelle = () =>
  `<table><tr><th>Prestataire</th><th>Pour quoi</th><th>Base du transfert</th></tr>${DIENSTLEISTER_FR.map((z) => `<tr>${z.map((x) => `<td>${escape(x)}</td>`).join("")}</tr>`).join("")}</table>`;

export function datenschutzFr(): string {
  return `<p class="klein">Version du ${FIRMA.standDatenschutz}</p>
<h2>1. Responsable du traitement</h2>
<p>${anschrift()}<br>E-mail : ${mail()}</p>
<h2>2. Ce que fait Jarvis</h2>
<p>Jarvis recherche chaque jour des appels d'offres publics, évalue s'ils conviennent à une entreprise et rédige des fiches synthèse. Les clients peuvent déposer des dossiers de consultation que Jarvis analyse. Jarvis s'adresse uniquement aux entreprises.</p>
<h2>3. Données traitées</h2>
<ul>
<li><strong>Lors de la consultation du site :</strong> données techniquement nécessaires (adresse IP, heure, page consultée, navigateur). L'hébergeur (Cloudflare) les conserve brièvement pour la sécurité et la recherche d'erreurs. Base juridique : art. 6, paragraphe 1, point f) du RGPD (fonctionnement sûr).</li>
<li><strong>Compte :</strong> nom, adresse e-mail, mot de passe (stocké uniquement sous forme chiffrée), nom, adresse et, de manière facultative, téléphone de l'entreprise, date de l'inscription, du consentement et de la connexion, appartenance aux entreprises, fonction, droits d'accès et secteurs. Base juridique : art. 6, paragraphe 1, point b) du RGPD (contrat).</li>
<li><strong>Données de l'entreprise :</strong> nom de l'entreprise, sites, site web indiqué de manière facultative, profil de recherche, appels d'offres avec état et notes, valeurs de chiffrage. Lors de la recherche automatique servant à établir le profil de recherche, le nom de l'entreprise, son site web et son siège sont transmis à la recherche web publique d'Anthropic ; les sources publiques pertinentes sont enregistrées avec leur URL dans le profil.</li>
<li><strong>Documents déposés :</strong> dossiers de consultation d'un appel d'offres. Ils peuvent contenir les noms et coordonnées d'interlocuteurs de l'acheteur. Ils sont lus uniquement pour la fiche synthèse et <strong>supprimés après 30 jours</strong>. Merci de ne pas déposer de documents contenant des données de vos salariés (par ex. CV).</li>
<li><strong>Interlocuteurs chez les acheteurs et les entreprises partenaires :</strong> nom, fonction, téléphone et e-mail professionnels ainsi qu'une note et une évaluation saisies par l'entreprise elle-même, interlocuteurs des contrats et des demandes aux sous-traitants. L'entreprise en est responsable ; nous traitons ces données pour son compte. Visibles uniquement pour l'équipe administrative de cette entreprise ; supprimées lorsque l'entreprise supprime l'entrée ou son compte.</li>
<li><strong>Personnel de l'entreprise (planification des missions) :</strong> nom, métiers, qualifications, groupe de rémunération, téléphone, de manière facultative e-mail et photo, disponibilité, périodes d'absence (uniquement « congés », « formation » ou « indisponible », sans données de santé), missions chez les clients avec leur période (pour les délais de la loi allemande sur le travail temporaire, AÜG), date d'entrée, type d'emploi, heures hebdomadaires, catégories de permis de conduire, langues, code postal du domicile (uniquement pour la distance jusqu'au lieu de mission), justificatifs de qualification avec date d'expiration et fichier déposé de manière facultative, participation aux formations et note sur le personnel, saisies par l'entreprise elle-même. L'entreprise en est responsable ; nous traitons ces données pour son compte (contrat de sous-traitance des données). Visibles uniquement pour les membres ayant accès au site concerné ; conservées jusqu'à leur suppression par l'entreprise. Jarvis n'envoie pas lui-même de messages à ces personnes : ils passent par WhatsApp, SMS ou e-mail depuis l'appareil de l'entreprise.</li>
<li><strong>Gestion par les salariés eux-mêmes :</strong> si une entreprise relie l'accès d'un intervenant à son dossier, cette personne ne voit que ses propres données : ses missions, ses absences, ses justificatifs et formations. Elle peut demander des congés (enregistrés comme « demandés » jusqu'à la validation par le bureau) et déposer ses justificatifs. Elle ne voit pas les données des autres personnes.</li>
<li><strong>Heures, postes, messages (depuis novembre 2026) :</strong> relevés d'heures (date, début, fin, pause, mission, note, validation par qui et quand), postes (date, horaire, lieu, acceptation ou refus), messages sur le tableau d'affichage avec accusé de lecture (qui a lu et quand), échéances du personnel (fin de la période d'essai, fin d'un contrat à durée déterminée, validité du titre de séjour ou du permis de travail : uniquement la date, pas de copie), contrôles du permis de conduire (date, catégories, contrôleur) et formations confirmées en ligne (date, heure). Les intervenants n'en voient que leurs propres données. Pour les notifications sur le téléphone concernant de nouveaux postes et messages, nous conservons le titre et un texte court pendant 30 jours au plus. L'entreprise est responsable, nous traitons pour son compte ; conservation jusqu'à la suppression par l'entreprise (les modifications des heures, postes et contrôles figurent 12 mois dans le journal des modifications).</li>
<li><strong>Clients, lieux de mission, attestations de prestation :</strong> clients de l'entreprise (nom, adresse, interlocuteur, téléphone, e-mail, note ; taux de facturation uniquement pour les personnes autorisées aux finances) et lieux de mission (adresse, interlocuteur sur place, point de rendez-vous, tenue, consignes). Les intervenants ne voient que le lieu de leur propre poste. Jarvis calcule les attestations de prestation et les heures majorées (nuit, dimanche, jours fériés) à partir des relevés d'heures validés, sans rien enregistrer de plus. Si un intervenant signale une absence de dernière minute, nous enregistrons uniquement le jour, une note facultative et le caractère tardif, sans motif ni donnée de santé.</li>
<li><strong>Candidatures, équipements de protection, listes de contrôle, congés, évaluations :</strong> les données des candidats (nom, contact, métier, source, statut, date d'entretien, note, documents déposés) ne sont visibles que par les gestionnaires, responsables de site et administrateurs ; elles sont supprimées 6 mois après un refus (délai de la loi allemande sur l'égalité de traitement, AGG) ou 30 jours après l'embauche, dès qu'une personne du bureau ouvre l'application. S'y ajoutent les équipements de protection remis (article, taille, date, remplacement, restitution), les listes de contrôle d'arrivée et de départ avec date de départ, les comptes de congés (droit, report) et les évaluations des missions par les clients (étoiles, souhait de retravailler ensemble, note). Seul le bureau voit les évaluations et listes de contrôle ; les intervenants voient leurs propres équipements et leur compte de congés. L'entreprise est responsable, nous traitons pour son compte.</li>
<li><strong>Organisation de l'équipe :</strong> remplacements (qui remplace qui, de quand à quand, note facultative), tâches (titre, responsable, échéance, date de réalisation) ainsi que véhicules et appareils (désignation, immatriculation ou numéro d'inventaire, type de contrôle et prochaine date de contrôle). Visibles pour l'équipe administrative de l'entreprise, pas pour les intervenants ; conservés jusqu'à leur suppression par l'entreprise. Pendant un remplacement, les rappels d'échéance vont au remplaçant plutôt qu'à la personne absente.</li>
<li><strong>Documents de l'entreprise, modèles d'offre, dossiers d'offre et preuves de dépôt :</strong> les justificatifs, modèles et accusés de réception déposés volontairement par l'entreprise ainsi que les projets d'offre sont conservés jusqu'à leur suppression par l'administration ou jusqu'à la fin du compte de l'entreprise. L'accès suit les droits attribués. Une date d'expiration empêche l'utilisation d'un justificatif dans un nouveau dossier d'offre après cette date, sans supprimer le fichier automatiquement. Si les e-mails de l'entreprise sont activés, des rappels d'expiration sont envoyés 30, 14, 7 et 2 jours avant aux membres ayant accès aux finances.</li>
<li><strong>Message quotidien :</strong> uniquement si vous choisissez vous-même une heure, nous vous envoyons une fois par jour les nouveaux résultats et les rappels d'échéance par e-mail ou sur le téléphone. Pour les notifications, nous enregistrons l'adresse push attribuée par votre navigateur ; la notification passe par le service push de votre navigateur (par ex. Google ou Apple), mais sans texte : votre téléphone le récupère ensuite directement chez nous. Désactivation à tout moment dans l'aperçu, sous « Message quotidien ». Base juridique : art. 6, paragraphe 1, point b) du RGPD.</li>
<li><strong>Facturation, pointage, signatures (depuis novembre 2026) :</strong> projets de facture (numéro, client, mois, lignes, montants ; uniquement avec autorisation aux finances), matricule et date d'anniversaire dans le dossier du personnel (anniversaire uniquement pour le rappel au bureau), frais avec photo du justificatif (type, montant, date, note, validation), compte d'heures (date de début et solde initial ; prévu et réalisé sont calculés à partir des heures), pointages (arrivée, pause, reprise, départ avec l'heure du serveur). Pour la pointeuse, le téléphone demande une fois, de manière facultative, la localisation ; au moment du pointage, nous la comparons au code postal du lieu de mission et n'enregistrons que « sur le lieu de mission oui/non », jamais les coordonnées. Signatures au doigt (image, date, objet) pour la remise des équipements de protection et les heures du mois. Liens de validation pour les clients : liste figée des heures du mois, nom de la personne qui valide, remarque, signature facultative, horodatage ; le lien est valable 30 jours, seule une empreinte (hash) du lien est enregistrée. Liens d'invitation pour les intervenants sans adresse e-mail (valables 14 jours, seule une empreinte enregistrée). L'entreprise est responsable, nous traitons pour son compte. Jarvis n'envoie pas lui-même les factures ni les liens.</li>
<li><strong>Sauvegardes et messages d'erreur :</strong> chaque nuit, la base de données est sauvegardée sous forme chiffrée (stockage Cloudflare avec centres de données dans l'UE ; réalisée via GitHub Actions). Les sauvegardes quotidiennes sont supprimées après 14 jours, les sauvegardes mensuelles après un an ; les données supprimées disparaissent au plus tard alors des sauvegardes. Les messages d'erreur techniques adressés à l'exploitant ne contiennent ni nom ni adresse e-mail et sont supprimés après 30 jours.</li>
<li><strong>Invitations :</strong> adresse e-mail de la personne invitée, pour lui envoyer le lien d'invitation (pour les liens destinés aux intervenants, uniquement le nom et le lien avec le dossier du personnel).</li>
</ul>
<h2>4. Cookies</h2>
<p>Nous utilisons uniquement des cookies techniquement nécessaires : pour la connexion (jv_at, jv_rt, jv_pkce), l'entreprise choisie en dernier (jv_firma) ainsi que pour vos choix et l'utilisation : langue, pays, affichage et vue (jv_psprache, jv_sprache, jv_land, jv_darstellung, jv_ansicht), appels d'offres ouverts récemment et dernière visite (jv_zuletzt, jv_gesehen) et affichage déjà fait de l'introduction (jv_einfuehrung). Pas de publicité, pas de mesure d'audience, pas de pistage. Base juridique : § 25, al. 2, n° 2 de la loi allemande TDDDG.</p>
<h2>5. Prestataires</h2>
<p>Nous faisons appel à ces prestataires en tant que sous-traitants (art. 28 du RGPD). Certains sont établis aux États-Unis. Le transfert est encadré par les garanties indiquées.</p>
${tabelle()}
<h2>6. Durée de conservation</h2>
<p>Documents déposés et fiches synthèse qui en sont issues : 30 jours. Documents de l'entreprise et modèles réutilisables : jusqu'à leur suppression par l'administration ou jusqu'à la fin du compte de l'entreprise. Journal des modifications (qui a modifié quoi et quand dans l'entreprise, visible uniquement par le titulaire) : 12 mois. Projets d'offre, validations de textes et autres données du compte et de l'entreprise : tant que le compte existe ; ensuite, elles sont supprimées, sauf obligation légale de conservation (par ex. factures, 8 à 10 ans).</p>
<h2>7. Vos droits</h2>
<p>Sous « Mon profil », vous pouvez télécharger vos données, modifier votre nom et supprimer votre compte.</p>
<p>Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation du traitement, de portabilité et d'opposition aux traitements fondés sur l'art. 6, paragraphe 1, point f) du RGPD. Écrivez-nous à ${mail()}. Vous pouvez également introduire une réclamation auprès d'une autorité de contrôle, par exemple la CNIL (www.cnil.fr)${FIRMA.aufsicht ? ` ou l'autorité compétente pour nous : ${escape(FIRMA.aufsicht)}` : ""}.</p>
<h2>8. Caractère obligatoire</h2>
<p>Sans adresse e-mail, l'inscription n'est pas possible. Tout le reste est facultatif.</p>`;
}

export function nutzungsbedingungenFr(): string {
  return `<p class="klein">Version du ${FIRMA.stand}</p>
<h2>1. Prestataire et champ d'application</h2>
<p>Jarvis est proposé par ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} (« nous »). Les présentes conditions s'appliquent à toutes les entreprises et personnes qui utilisent Jarvis (« client »). Jarvis s'adresse uniquement aux professionnels au sens du § 14 du Code civil allemand (BGB).</p>
<h2>2. Prestation</h2>
<ul>
<li>Jarvis recherche chaque jour des appels d'offres publics selon le profil de recherche du client, les évalue et rédige des fiches synthèse à partir de l'avis public.</li>
<li>Le client peut déposer des dossiers de consultation. Jarvis en tire une fiche synthèse détaillée et aide au chiffrage.</li>
<li>Les entreprises peuvent enregistrer des justificatifs et leurs propres modèles, modifier des projets d'offre et télécharger un dossier d'offre. Les versions d'offre doivent être validées par la direction de l'entreprise avant le téléchargement. Le dépôt est effectué par le client par la voie prévue par l'acheteur ; créer ou télécharger un dossier n'est pas un dépôt. Un accusé de réception déposé ensuite documente le dépôt déclaré par le client.</li>
<li>Jarvis ne télécharge pas lui-même les dossiers de consultation sur les plateformes dont les conditions l'interdisent. Le client effectue lui-même le téléchargement via le lien vers la plateforme.</li>
</ul>
<h2>3. IA et absence de garantie</h2>
<p>Les notes, fiches synthèse et chiffrages sont produits par une IA. Ils peuvent être incomplets ou erronés. Seuls les documents originaux de l'acheteur font foi. Avant chaque offre, le client vérifie lui-même les délais, les exigences et les prix. Jarvis ne constitue pas un conseil juridique ou fiscal. Nous ne garantissons pas que Jarvis trouve chaque appel d'offres pertinent.</p>
<h2>4. Obligations du client</h2>
<ul>
<li>Le client ne dépose que des documents qu'il est autorisé à utiliser et respecte les conditions des plateformes de marchés publics.</li>
<li>Le client ne dépose pas de catégories particulières de données personnelles (art. 9 du RGPD) et, autant que possible, aucune donnée de ses salariés.</li>
<li>Les accès sont personnels. Le client n'invite que des personnes qui travaillent pour lui et les retire lorsqu'elles quittent l'entreprise.</li>
</ul>
<h2>5. Prix</h2>
<p>Les prix et la formule sont convenus séparément avec chaque entreprise. Pendant une période de présentation ou d'essai, Jarvis est gratuit.</p>
<h2>6. Disponibilité</h2>
<p>Nous nous efforçons d'assurer un fonctionnement sans interruption, sans garantir une disponibilité déterminée. La maintenance et les incidents chez les prestataires peuvent entraîner des interruptions.</p>
<h2>7. Responsabilité</h2>
<p>Notre responsabilité est illimitée en cas de faute intentionnelle, de faute lourde et d'atteinte à la vie, à l'intégrité physique ou à la santé. En cas de négligence simple, nous ne répondons que de la violation d'obligations contractuelles essentielles, dans la limite du dommage prévisible et typique et au plus du montant de la rémunération des 12 derniers mois. Nous ne répondons pas des délais manqués, des appels d'offres non trouvés ou des procédures perdues, dans la mesure où ils reposent sur des indications de l'IA que le client doit vérifier lui-même selon le point 3.</p>
<h2>8. Protection des données</h2>
<p>Dans la mesure où nous traitons des données personnelles pour le client, le <a href="/avv">contrat de sous-traitance des données</a> s'applique. Plus d'informations dans la <a href="/datenschutz">politique de confidentialité</a>.</p>
<h2>9. Durée et résiliation</h2>
<p>Chaque partie peut résilier à tout moment pour la fin du mois, sauf accord contraire. À la fin du contrat, nous supprimons les données de l'entreprise dans un délai de 30 jours.</p>
<h2>10. Dispositions finales</h2>
<p>Le droit allemand s'applique. Le tribunal compétent est, dans la mesure permise, celui de notre siège. Nous communiquons les modifications des présentes conditions par e-mail ; si le client ne s'y oppose pas dans un délai de 4 semaines, elles sont réputées acceptées. Nous rappelons cette conséquence dans la communication.</p>`;
}

export function avvFr(): string {
  return `<p>Contrat au sens de l'art. 28 du RGPD entre l'entreprise qui utilise Jarvis (« responsable du traitement ») et ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} (« sous-traitant »). Il s'applique dès l'utilisation de Jarvis. Version du ${FIRMA.stand}.</p>
<h2>1. Objet</h2>
<p>Le sous-traitant exploite pour le responsable du traitement le service d'alertes appels d'offres Jarvis conformément aux <a href="/nutzungsbedingungen">conditions d'utilisation</a>. Durée : tant que Jarvis est utilisé.</p>
<h2>2. Nature des données et personnes concernées</h2>
<ul>
<li>Données : noms et adresses e-mail des utilisateurs, rôles, données de l'entreprise et des sites, notes et états de traitement, dossiers de consultation déposés (contenant le cas échéant les coordonnées d'interlocuteurs des acheteurs).</li>
<li>Personnes concernées : salariés du responsable du traitement, interlocuteurs des acheteurs.</li>
<li>Finalité : recherche, évaluation et analyse d'appels d'offres, travail en équipe.</li>
</ul>
<h2>3. Obligations du sous-traitant</h2>
<ul>
<li>Il ne traite les données que sur instruction documentée du responsable du traitement ; l'utilisation des fonctions de Jarvis vaut instruction.</li>
<li>Les personnes ayant accès sont tenues à la confidentialité.</li>
<li>Il met en œuvre les mesures techniques et organisationnelles du point 6.</li>
<li>Il aide le responsable du traitement à répondre aux demandes des personnes concernées et à respecter les obligations des articles 32 à 36 du RGPD.</li>
<li>Il notifie sans délai les violations de données personnelles, si possible dans les 24 heures.</li>
<li>À la fin de la prestation, il supprime les données dans un délai de 30 jours ou les restitue auparavant sur demande.</li>
<li>Il met à disposition toutes les informations nécessaires pour démontrer le respect de ces obligations et permet des audits sur rendez-vous.</li>
</ul>
<h2>4. Sous-traitants ultérieurs</h2>
<p>Le responsable du traitement autorise ces sous-traitants ultérieurs. Le sous-traitant informe au préalable par e-mail de tout nouveau sous-traitant ultérieur ; le responsable du traitement peut s'y opposer pour un motif sérieux dans un délai de 14 jours.</p>
${tabelle()}
<h2>5. Pays tiers</h2>
<p>Les transferts vers les États-Unis n'ont lieu que sur la base des garanties indiquées dans le tableau (art. 44 et suivants du RGPD).</p>
<h2>6. Mesures techniques et organisationnelles</h2>
<ul>
<li>Transmission chiffrée (HTTPS), stockage des documents dans des centres de données situés dans l'UE.</li>
<li>Connexion par mot de passe (stocké uniquement sous forme chiffrée, au moins 8 caractères) ou par lien e-mail ; cookies de session uniquement via HTTPS et non lisibles par les scripts.</li>
<li>Droits au niveau de la base de données : chacun ne voit que les données de son entreprise et de ses secteurs.</li>
<li>Les documents déposés sont supprimés automatiquement après 30 jours.</li>
<li>Journal des modifications : les modifications du personnel, des sites, des accès et des appels d'offres sont enregistrées avec la personne et l'heure, visibles uniquement par le titulaire et supprimées après 12 mois.</li>
<li>Les accès aux prestataires sont réservés au sous-traitant et protégés par une authentification forte.</li>
<li>Sauvegardes de la base de données par le fournisseur.</li>
</ul>
<h2>7. Dispositions finales</h2>
<p>En cas de contradiction, le présent contrat prévaut sur les conditions d'utilisation pour ce qui concerne la protection des données. Si vous avez besoin d'un contrat signé, écrivez à ${mail()}.</p>`;
}

export const RECHT_FR: Record<string, [string, () => string]> = {
  "/impressum": ["Mentions légales", impressumFr],
  "/datenschutz": ["Politique de confidentialité", datenschutzFr],
  "/nutzungsbedingungen": ["Conditions d'utilisation", nutzungsbedingungenFr],
  "/avv": ["Contrat de sous-traitance des données", avvFr],
};
