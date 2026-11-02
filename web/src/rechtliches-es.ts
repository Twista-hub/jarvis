// Spanish (Spain) translation of the legal pages (rechtliches.ts) for visitors with app language es. Translation for information;
// the German version is binding (said on every page, with a link to it). Keep both in step: every change to the German
// text needs the same change here (test/rechtliches-es.test.ts compares the section counts).
import { escape } from "./seite.ts";
import { FIRMA } from "./rechtliches.ts";

const anschrift = () => `${escape(FIRMA.name)}, ${escape(FIRMA.firma)}<br>${escape(FIRMA.strasse)}<br>${escape(FIRMA.ort)}, Alemania`;
const mail = () => `<a href="mailto:${FIRMA.email}">${FIRMA.email}</a>`;

/** Note on top of every Spanish legal page, with the link to the binding German version. */
export function hinweisDeutschEs(pfad: string): string {
  return `<p class="hinweis">Traducción facilitada únicamente a título informativo. Solo es vinculante la <a href="/sprache?zu=de&amp;weiter=${encodeURIComponent(pfad)}" hreflang="de" lang="de">versión alemana</a>.</p>`;
}

export function impressumEs(): string {
  return `<h2>Información conforme al § 5 de la ley alemana de servicios digitales (DDG)</h2>
<p>${anschrift()}</p>
<h2>Contacto</h2>
<p>Correo electrónico: ${mail()}${FIRMA.telefon ? `<br>Teléfono: ${escape(FIRMA.telefon)}` : ""}</p>
${FIRMA.ustId ? `<h2>IVA</h2><p>Número de identificación a efectos del IVA conforme al § 27a de la ley alemana del IVA (UStG): ${escape(FIRMA.ustId)}</p>` : FIRMA.kleinunternehmer ? `<h2>IVA</h2><p>Pequeño empresario conforme al § 19 de la ley alemana del IVA (UStG); por ello no se repercute IVA.</p>` : ""}
<h2>Responsable del contenido</h2>
<p>${escape(FIRMA.name)}, dirección indicada arriba.</p>
<h2>Resolución de litigios de consumo</h2>
<p>Jarvis se dirige únicamente a empresas. No estamos dispuestos ni obligados a participar en procedimientos de resolución de litigios ante una entidad de resolución alternativa de litigios de consumo.</p>
<h2>Fuentes</h2>
<p>Licitaciones: servicio de anuncios de la Federación alemana (oeffentlichevergabe.de), licencia CC0; BOAMP, DILA (Francia), Licence Ouverte 2.0; TED, Oficina de Publicaciones de la UE (reutilización con indicación de la fuente); Biuletyn Zamówień Publicznych, UZP (Polonia); Plataforma de serveis de contractació pública, Generalitat de Catalunya (España), Llicència oberta d'ús d'informació – Catalunya; SAM.gov (EE. UU., datos públicos del Gobierno federal estadounidense). Programas de ayudas: base de datos federal alemana de ayudas (Förderdatenbank des Bundes), licencia CC BY-ND 4.0 DE (solo título y enlace). Las valoraciones y fichas resumen las elabora el propio Jarvis.</p>
`;
}

const DIENSTLEISTER_ES = [
  ["Cloudflare, Inc., San Francisco (EE. UU.)", "Funcionamiento del sitio web, almacenamiento de los documentos subidos (centros de datos en la UE), conversión de los archivos en texto", "Marco de Privacidad de Datos UE-EE. UU. (EU-US Data Privacy Framework), cláusulas contractuales tipo"],
  ["Supabase, Inc., San Francisco (EE. UU.)", "Inicio de sesión y base de datos (empresas, miembros, licitaciones); servidores en Fráncfort del Meno", "Cláusulas contractuales tipo"],
  ["Anthropic, PBC, San Francisco (EE. UU.)", "Modelo de IA Claude: lee los anuncios y los documentos, elabora los perfiles de búsqueda de las empresas con una búsqueda web limitada y redacta valoraciones y fichas resumen. Según el proveedor, los datos de la API no se utilizan para el entrenamiento", "Cláusulas contractuales tipo"],
  ["Namecheap, Inc., Phoenix (EE. UU.)", "Buzón de correo kontakt@wpdigitalranger.com: enlaces de inicio de sesión, invitaciones y mensajes", "Cláusulas contractuales tipo"],
  ["GitHub, Inc. (Microsoft), San Francisco (EE. UU.)", "Análisis diario de las licitaciones públicas con los perfiles de búsqueda de las empresas; copia de seguridad cifrada cada noche", "Marco de Privacidad de Datos UE-EE. UU. (EU-US Data Privacy Framework), cláusulas contractuales tipo"],
];

const tabelle = () =>
  `<table><tr><th>Proveedor</th><th>Para qué</th><th>Base de la transferencia</th></tr>${DIENSTLEISTER_ES.map((z) => `<tr>${z.map((x) => `<td>${escape(x)}</td>`).join("")}</tr>`).join("")}</table>`;

export function datenschutzEs(): string {
  return `<p class="klein">Versión del ${FIRMA.standDatenschutz}</p>
<h2>1. Responsable del tratamiento</h2>
<p>${anschrift()}<br>Correo electrónico: ${mail()}</p>
<h2>2. Qué hace Jarvis</h2>
<p>Jarvis busca cada día licitaciones públicas, valora si encajan con una empresa y redacta fichas resumen. Los clientes pueden subir pliegos y documentación de la licitación, que Jarvis analiza. Jarvis se dirige únicamente a empresas.</p>
<h2>3. Qué datos tratamos</h2>
<ul>
<li><strong>Al visitar el sitio:</strong> datos técnicamente necesarios (dirección IP, hora, página visitada, navegador). El operador de los servidores (Cloudflare) los conserva durante poco tiempo por motivos de seguridad y para localizar errores. Base jurídica: art. 6, apartado 1, letra f), del RGPD (funcionamiento seguro).</li>
<li><strong>Cuenta:</strong> nombre, dirección de correo electrónico, contraseña (almacenada solo cifrada), nombre, dirección y, de forma voluntaria, teléfono de la empresa, momento del registro, del consentimiento y del inicio de sesión, pertenencia a empresas, función en la empresa, derechos de acceso y áreas. Base jurídica: art. 6, apartado 1, letra b), del RGPD (contrato).</li>
<li><strong>Datos de la empresa:</strong> nombre de la empresa, centros, sitio web indicado de forma voluntaria, perfil de búsqueda, licitaciones con su estado y notas, valores de cálculo de costes. En la búsqueda automática para configurar el perfil de búsqueda, el nombre de la empresa, su sitio web y su domicilio social se transmiten a la búsqueda web pública de Anthropic; las fuentes públicas pertinentes se guardan en el perfil con su URL.</li>
<li><strong>Documentos subidos:</strong> pliegos y documentación de una licitación. Pueden contener nombres y datos de contacto de personas de contacto del poder adjudicador. Solo se leen para la ficha resumen y <strong>se eliminan a los 30 días</strong>. Le rogamos que no suba documentos con datos de sus empleados (p. ej., currículos).</li>
<li><strong>Personas de contacto en poderes adjudicadores y empresas colaboradoras:</strong> nombre, cargo, teléfono y correo electrónico profesionales, así como una nota y una valoración que la propia empresa introduce, personas de contacto de contratos y de solicitudes a subcontratistas. La empresa es responsable de ellos; nosotros tratamos los datos por su cuenta. Solo visibles para el equipo de oficina de esa empresa; se eliminan cuando la empresa borra la entrada o su cuenta.</li>
<li><strong>Personal de la empresa (planificación de servicios):</strong> nombre, oficios, cualificaciones, grupo retributivo, teléfono, de forma voluntaria correo electrónico y foto, disponibilidad, periodos de ausencia (solo «vacaciones», «formación» o «no disponible», sin datos de salud), servicios en clientes con su periodo (para los plazos de la ley alemana de cesión de trabajadores, AÜG), fecha de incorporación, tipo de empleo, horas semanales, clases de permiso de conducir, idiomas, código postal del domicilio (solo para la distancia al lugar de servicio), acreditaciones de cualificación con fecha de caducidad y archivo subido de forma voluntaria, participación en instrucciones de seguridad y nota sobre el personal, que la propia empresa introduce. La empresa es responsable de ellos; nosotros tratamos los datos por su cuenta (contrato de encargo del tratamiento). Solo visibles para los miembros con acceso al centro; se conservan hasta que la empresa los elimine. Jarvis no envía por sí mismo mensajes a estas personas: se envían por WhatsApp, SMS o correo electrónico desde el dispositivo de la empresa.</li>
<li><strong>Autogestión por los empleados:</strong> si una empresa vincula el acceso a la aplicación de un trabajador con su expediente de personal, esta persona solo ve sus propios datos: sus servicios, sus ausencias, sus acreditaciones e instrucciones. Puede solicitar vacaciones (guardadas como «solicitadas» hasta que la oficina las confirme) y subir sus propias acreditaciones. No ve los datos de otras personas.</li>
<li><strong>Horas, turnos, comunicados (desde noviembre de 2026):</strong> partes de horas (fecha, inicio, fin, pausa, servicio, nota, aprobación por quién y cuándo), turnos (fecha, hora, lugar, aceptación o rechazo), comunicados en el tablón de anuncios con confirmación de lectura (quién lo ha leído y cuándo), plazos del personal (fin del periodo de prueba, fin de un contrato temporal, validez del permiso de residencia o de trabajo: solo la fecha, sin copia), controles del permiso de conducir (fecha, clases, quién lo comprobó) e instrucciones de seguridad confirmadas digitalmente (fecha, hora). Los trabajadores solo ven sus propios datos. Para las notificaciones en el móvil sobre nuevos turnos y comunicados guardamos el título y un texto breve durante 30 días como máximo. La empresa es responsable, nosotros tratamos por su cuenta; se conservan hasta que la empresa los elimine (los cambios en horas, turnos y controles figuran 12 meses en el registro de cambios).</li>
<li><strong>Clientes, lugares de servicio, partes de trabajo:</strong> clientes de la empresa (nombre, dirección, persona de contacto, teléfono, correo electrónico, nota; tarifa de facturación solo para personas con autorización financiera) y lugares de servicio (dirección, persona de contacto in situ, punto de encuentro, vestimenta, indicaciones). Los trabajadores solo ven el lugar de servicio de su propio turno. Jarvis calcula los partes de trabajo y las horas con recargo (noche, domingo, festivo) a partir de los partes de horas aprobados y no guarda nada adicional para ello. Si un trabajador comunica una ausencia imprevista, solo guardamos el día, una nota voluntaria y el hecho de que fue con poca antelación, sin motivo y sin datos de salud.</li>
<li><strong>Candidaturas, equipos de protección, listas de comprobación, vacaciones, valoraciones:</strong> los datos de los candidatos (nombre, contacto, oficio, fuente, estado, fecha de entrevista, nota, documentos subidos) solo los ven los gestores, los responsables de centro y los administradores; se eliminan 6 meses después de un rechazo (plazo de la ley alemana de igualdad de trato, AGG) o 30 días después de la contratación, en cuanto alguien de la oficina abre la aplicación. A ello se suman los equipos de protección entregados (artículo, talla, fecha, sustitución, devolución), las listas de comprobación de incorporación y de salida con fecha de salida, las cuentas de vacaciones (derecho, saldo trasladado) y las valoraciones de los servicios por parte de los clientes (estrellas, si repetirían, nota). Las valoraciones y listas de comprobación solo las ve la oficina; los trabajadores ven sus propios equipos de protección y su cuenta de vacaciones. La empresa es responsable, nosotros tratamos por su cuenta.</li>
<li><strong>Organización del equipo:</strong> sustituciones (quién sustituye a quién, desde cuándo hasta cuándo, nota voluntaria), tareas (título, persona responsable, vencimiento, fecha de realización), así como vehículos y equipos (denominación, matrícula o número de inventario, tipo de inspección y próxima fecha de inspección). Visibles para el equipo de oficina de la empresa, no para los trabajadores; se conservan hasta que la empresa los elimine. Durante una sustitución, los recordatorios de plazos se envían al sustituto en lugar de a la persona ausente.</li>
<li><strong>Documentación de la empresa, plantillas de oferta, carpetas de oferta y justificantes de presentación:</strong> las acreditaciones, plantillas y acuses de recibo depositados conscientemente por la empresa, así como los borradores de oferta, se conservan hasta que la administración los elimine o hasta el fin de la cuenta de la empresa. El acceso se rige por los derechos asignados. La fecha de caducidad de una acreditación impide utilizarla en una nueva carpeta de oferta después de esa fecha, pero no elimina el archivo automáticamente. Si los correos de la empresa están activados, se envían recordatorios de caducidad 30, 14, 7 y 2 días antes a los miembros con acceso a las finanzas.</li>
<li><strong>Mensaje diario:</strong> solo si usted mismo elige una hora, le enviamos una vez al día los nuevos resultados y los recordatorios de plazos por correo electrónico o al móvil. Para las notificaciones en el móvil guardamos la dirección push que su navegador asigna para ello; la notificación pasa por el servicio push de su navegador (p. ej., Google o Apple), pero sin texto: su móvil lo recoge después directamente de nosotros. Puede desactivarlo en cualquier momento en la vista general, en «Mensaje diario». Base jurídica: art. 6, apartado 1, letra b), del RGPD.</li>
<li><strong>Facturación, registro de jornada, firmas (desde noviembre de 2026):</strong> borradores de factura (número, cliente, mes, partidas, importes; solo con autorización financiera), número de personal y fecha de cumpleaños en el expediente de personal (el cumpleaños solo para el recordatorio en la oficina), gastos con foto del justificante (tipo, importe, fecha, nota, aprobación), cuenta de horas (fecha de inicio y saldo inicial; las horas previstas y reales se calculan a partir de las horas), fichajes (entrada, pausa, reanudación, salida con la hora del servidor). En el reloj de fichaje, el móvil pide una vez, de forma voluntaria, la ubicación; en el momento del fichaje la comparamos con el código postal del lugar de servicio y solo guardamos «en el lugar de servicio sí/no», nunca las coordenadas. Firmas con el dedo (imagen, fecha, para qué) para la recepción de equipos de protección y las horas mensuales. Enlaces de confirmación para clientes: lista congelada de las horas del mes, nombre de la persona que confirma, observación, firma voluntaria, momento; el enlace es válido 30 días y solo se guarda un hash del enlace. Enlaces de invitación para trabajadores sin dirección de correo electrónico (válidos 14 días, solo se guarda un hash). La empresa es responsable, nosotros tratamos por su cuenta. Jarvis no envía por sí mismo facturas ni enlaces.</li>
<li><strong>Copias de seguridad y mensajes de error:</strong> cada noche se hace una copia de seguridad cifrada de la base de datos (en el almacenamiento de Cloudflare con centros de datos en la UE; creada mediante GitHub Actions). Las copias diarias se eliminan a los 14 días y las mensuales al cabo de un año; los datos eliminados desaparecen también de las copias de seguridad, como muy tarde, en ese momento. Los mensajes de error técnicos dirigidos al operador no contienen nombres ni direcciones de correo electrónico y se eliminan a los 30 días.</li>
<li><strong>Invitaciones:</strong> dirección de correo electrónico de la persona invitada, para poder enviarle el enlace de invitación (en los enlaces para trabajadores, solo el nombre y la vinculación con el expediente de personal).</li>
</ul>
<h2>4. Cookies</h2>
<p>Solo utilizamos cookies técnicamente necesarias: para el inicio de sesión (jv_at, jv_rt, jv_pkce), la última empresa seleccionada (jv_firma), así como para sus preferencias y el manejo: idioma, país, presentación y vista (jv_psprache, jv_sprache, jv_land, jv_darstellung, jv_ansicht), licitaciones abiertas recientemente y última visita (jv_zuletzt, jv_gesehen) y si ya se ha mostrado la introducción (jv_einfuehrung). No hay publicidad, ni análisis, ni seguimiento. Base jurídica: § 25, apartado 2, n.º 2, de la ley alemana de protección de datos en telecomunicaciones y servicios digitales (TDDDG).</p>
<h2>5. Proveedores de servicios</h2>
<p>Utilizamos estos proveedores de servicios como encargados del tratamiento (art. 28 RGPD). Algunos tienen su sede en EE. UU. La transferencia está protegida por las garantías indicadas.</p>
${tabelle()}
<h2>6. Plazo de conservación</h2>
<p>Documentos subidos y fichas resumen elaboradas a partir de ellos: 30 días. Documentación de la empresa y plantillas reutilizables: hasta que la administración las elimine o hasta el fin de la cuenta de la empresa. Registro de cambios (quién cambió qué y cuándo en la empresa, visible solo para el titular): 12 meses. Borradores de oferta y aprobaciones de textos, así como los demás datos de la cuenta y de la empresa: mientras exista la cuenta; después se eliminan, salvo que debamos conservarlos por obligación legal (p. ej., facturas, de 8 a 10 años).</p>
<h2>7. Sus derechos</h2>
<p>En «Mi perfil» puede descargar usted mismo sus datos, cambiar su nombre y eliminar su cuenta.</p>
<p>Tiene derecho de acceso, rectificación, supresión, limitación del tratamiento, portabilidad de los datos y oposición a los tratamientos basados en el art. 6, apartado 1, letra f), del RGPD. Para ello, escríbanos a ${mail()}. Además, puede presentar una reclamación ante una autoridad de control de protección de datos, por ejemplo la Agencia Española de Protección de Datos (AEPD, www.aepd.es)${FIRMA.aufsicht ? ` o la autoridad competente para nosotros: ${escape(FIRMA.aufsicht)}` : ""}.</p>
<h2>8. Obligación de facilitar datos</h2>
<p>Sin dirección de correo electrónico no es posible registrarse. Todo lo demás es voluntario.</p>`;
}

export function nutzungsbedingungenEs(): string {
  return `<p class="klein">Versión del ${FIRMA.stand}</p>
<h2>1. Proveedor y ámbito de aplicación</h2>
<p>Jarvis es un servicio de ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} («nosotros»). Estas condiciones se aplican a todas las empresas y personas que utilizan Jarvis («cliente»). Jarvis se dirige únicamente a empresarios en el sentido del § 14 del Código Civil alemán (BGB).</p>
<h2>2. Servicio</h2>
<ul>
<li>Jarvis busca cada día licitaciones públicas según el perfil de búsqueda del cliente, las valora y redacta fichas resumen a partir del anuncio público.</li>
<li>El cliente puede subir pliegos y documentación de la licitación. Jarvis elabora a partir de ellos una ficha resumen detallada y ayuda con el cálculo de costes.</li>
<li>Las empresas pueden depositar acreditaciones y plantillas propias, editar borradores de oferta y descargar una carpeta de oferta. Las versiones de la oferta deben ser aprobadas por la dirección de la empresa antes de la descarga. La presentación la realiza el cliente por la vía prevista por el órgano de contratación; crear o descargar una carpeta no constituye una presentación. Un acuse de recibo subido posteriormente documenta la presentación comunicada por el cliente.</li>
<li>Jarvis no descarga por sí mismo documentación de la licitación de portales cuyas condiciones lo prohíben. La descarga la realiza el propio cliente a través del enlace al portal.</li>
</ul>
<h2>3. IA y exclusión de garantía</h2>
<p>Las valoraciones, fichas resumen y cálculos de costes los elabora una IA. Pueden ser incompletos o erróneos. Solo son determinantes los documentos originales del órgano de contratación. Antes de cada oferta, el cliente comprueba por sí mismo los plazos, los requisitos y los precios. Jarvis no constituye asesoramiento jurídico ni fiscal. No garantizamos que Jarvis encuentre todas las licitaciones adecuadas.</p>
<h2>4. Obligaciones del cliente</h2>
<ul>
<li>El cliente solo sube documentos que tiene derecho a utilizar y respeta las condiciones de los portales de contratación.</li>
<li>El cliente no sube categorías especiales de datos personales (art. 9 RGPD) y, en la medida de lo posible, ningún dato de sus empleados.</li>
<li>Los accesos son personales. El cliente solo invita a personas que trabajan para él y las elimina cuando dejan la empresa.</li>
</ul>
<h2>5. Precios</h2>
<p>Los precios y el paquete los acordamos por separado con cada empresa. Durante una fase de presentación o de prueba, Jarvis es gratuito.</p>
<h2>6. Disponibilidad</h2>
<p>Nos esforzamos por ofrecer un funcionamiento sin interrupciones, pero no garantizamos una disponibilidad determinada. El mantenimiento y las incidencias en los proveedores de servicios pueden provocar interrupciones.</p>
<h2>7. Responsabilidad</h2>
<p>Respondemos de forma ilimitada en caso de dolo, negligencia grave y daños a la vida, la integridad física o la salud. En caso de negligencia leve, solo respondemos por el incumplimiento de obligaciones contractuales esenciales, limitado al daño previsible y típico y, como máximo, a la remuneración de los últimos 12 meses. No respondemos de plazos incumplidos, licitaciones no encontradas o procedimientos de contratación perdidos, en la medida en que se basen en indicaciones de la IA que el cliente debe comprobar por sí mismo conforme al punto 3.</p>
<h2>8. Protección de datos</h2>
<p>En la medida en que tratemos datos personales por cuenta del cliente, se aplica el <a href="/avv">contrato de encargo del tratamiento</a>. Más información en la <a href="/datenschutz">política de privacidad</a>.</p>
<h2>9. Duración y resolución</h2>
<p>Ambas partes pueden resolver el contrato en cualquier momento con efecto a final de mes, salvo que se haya acordado otra cosa. Tras la finalización, eliminamos los datos de la empresa en un plazo de 30 días.</p>
<h2>10. Disposiciones finales</h2>
<p>Se aplica el Derecho alemán. El fuero competente es, en la medida en que esté permitido, el de nuestro domicilio. Comunicamos los cambios de estas condiciones por correo electrónico; si el cliente no se opone en un plazo de 4 semanas, se considerarán aceptados. En la comunicación advertimos de esta consecuencia.</p>`;
}

export function avvEs(): string {
  return `<p>Contrato conforme al art. 28 RGPD entre la empresa que utiliza Jarvis («responsable del tratamiento») y ${escape(FIRMA.name)}, ${escape(FIRMA.firma)} («encargado del tratamiento»). Se aplica con el uso de Jarvis. Versión del ${FIRMA.stand}.</p>
<h2>1. Objeto</h2>
<p>El encargado del tratamiento explota para el responsable del tratamiento el servicio de alertas de licitaciones Jarvis conforme a las <a href="/nutzungsbedingungen">condiciones de uso</a>. Duración: mientras se utilice Jarvis.</p>
<h2>2. Tipo de datos e interesados</h2>
<ul>
<li>Datos: nombres y direcciones de correo electrónico de los usuarios, funciones, datos de la empresa y de los centros, notas y estados de tramitación, documentación de licitaciones subida (que puede contener datos de contacto de personas de contacto de los órganos de contratación).</li>
<li>Interesados: empleados del responsable del tratamiento, personas de contacto de los órganos de contratación.</li>
<li>Finalidad: búsqueda, valoración y análisis de licitaciones, trabajo en equipo.</li>
</ul>
<h2>3. Obligaciones del encargado del tratamiento</h2>
<ul>
<li>Trata los datos únicamente siguiendo instrucciones documentadas del responsable del tratamiento; el uso de las funciones de Jarvis se considera una instrucción.</li>
<li>Las personas con acceso están sujetas a confidencialidad.</li>
<li>Aplica las medidas técnicas y organizativas del punto 6.</li>
<li>Asiste al responsable del tratamiento en las solicitudes de los interesados y en el cumplimiento de las obligaciones de los artículos 32 a 36 del RGPD.</li>
<li>Notifica sin dilación indebida las violaciones de la seguridad de los datos personales, a ser posible en un plazo de 24 horas.</li>
<li>Al finalizar el encargo, elimina los datos en un plazo de 30 días o, si así se solicita, los devuelve antes.</li>
<li>Pone a disposición toda la información necesaria para demostrar el cumplimiento de estas obligaciones y permite auditorías previo aviso.</li>
</ul>
<h2>4. Subencargados del tratamiento</h2>
<p>El responsable del tratamiento autoriza a estos subencargados del tratamiento. El encargado del tratamiento informa previamente por correo electrónico de cualquier nuevo subencargado; el responsable del tratamiento puede oponerse por motivo justificado en un plazo de 14 días.</p>
${tabelle()}
<h2>5. Terceros países</h2>
<p>Las transferencias a EE. UU. solo se realizan sobre la base de las garantías indicadas en la tabla (art. 44 y siguientes del RGPD).</p>
<h2>6. Medidas técnicas y organizativas</h2>
<ul>
<li>Transmisión cifrada (HTTPS), almacenamiento de los documentos en centros de datos situados en la UE.</li>
<li>Inicio de sesión con contraseña (almacenada solo cifrada, al menos 8 caracteres) o mediante enlace por correo electrónico; cookies de sesión solo a través de HTTPS y no legibles por scripts.</li>
<li>Derechos a nivel de base de datos: cada persona solo ve los datos de su empresa y de sus áreas.</li>
<li>Los documentos subidos se eliminan automáticamente a los 30 días.</li>
<li>Registro de cambios: los cambios en el personal, los centros, los accesos y las licitaciones se registran con la persona y la hora, solo son visibles para el titular y se eliminan a los 12 meses.</li>
<li>Los accesos a los proveedores de servicios están limitados al encargado del tratamiento y protegidos con autenticación reforzada.</li>
<li>Copias de seguridad de la base de datos realizadas por el proveedor.</li>
</ul>
<h2>7. Disposiciones finales</h2>
<p>En caso de contradicción, este contrato prevalece sobre las condiciones de uso en lo que respecta a la protección de datos. Si necesita un contrato firmado, escriba a ${mail()}.</p>`;
}

export const RECHT_ES: Record<string, [string, () => string]> = {
  "/impressum": ["Aviso legal", impressumEs],
  "/datenschutz": ["Política de privacidad", datenschutzEs],
  "/nutzungsbedingungen": ["Condiciones de uso", nutzungsbedingungenEs],
  "/avv": ["Contrato de encargo del tratamiento", avvEs],
};
