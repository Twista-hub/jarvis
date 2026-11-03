// T42: staff page in other languages (English, Polish, Romanian, Turkish, Ukrainian, Arabic). A fixed phrase list
// replaces the German texts of "Meine Einsätze & Daten" (headings, buttons, form labels, status words, the main hints).
// No AI and no external service; texts the office writes (shift notes, site info) stay as written. Arabic is shown
// right-to-left. The choice is kept in the cookie jv_sprache.
import { escape } from "./seite.ts";

export const SPRACHEN: Record<string, { name: string; rtl?: boolean }> = {
  de: { name: "Deutsch" }, en: { name: "English" }, pl: { name: "Polski" }, ro: { name: "Română" }, tr: { name: "Türkçe" }, uk: { name: "Українська" }, ar: { name: "العربية", rtl: true },
};
const REIHE = ["en", "pl", "ro", "tr", "uk", "ar"] as const;

// German phrase → en, pl, ro, tr, uk, ar
const W: [string, string, string, string, string, string, string][] = [
  ["Meine Einsätze & Daten", "My jobs & data", "Moje zlecenia i dane", "Misiunile și datele mele", "Görevlerim ve bilgilerim", "Мої завдання та дані", "مهامي وبياناتي"],
  ["Zurück zur Übersicht", "Back to overview", "Powrót do przeglądu", "Înapoi la prezentare", "Genel bakışa dön", "Назад до огляду", "العودة إلى النظرة العامة"],
  ["Übersicht", "Overview", "Przegląd", "Prezentare", "Genel bakış", "Огляд", "نظرة عامة"],
  ["Mein Profil", "My profile", "Mój profil", "Profilul meu", "Profilim", "Мій профіль", "ملفي الشخصي"],
  ["Mehr", "More", "Więcej", "Mai mult", "Daha fazla", "Більше", "المزيد"],
  ["Hallo", "Hello", "Cześć", "Salut", "Merhaba", "Привіт", "مرحبًا"],
  ["Beruf noch nicht eingetragen", "Job not entered yet", "Zawód jeszcze nie wpisany", "Meseria nu este încă trecută", "Meslek henüz girilmedi", "Професію ще не внесено", "لم تُسجَّل المهنة بعد"],
  ["Ich falle kurzfristig aus", "I can't come (short notice)", "Nie mogę przyjść (nagle)", "Lipsesc neprevăzut", "Kısa süreli gelemiyorum", "Терміново не можу вийти", "لا أستطيع الحضور (طارئ)"],
  ["Wann?", "When?", "Kiedy?", "Când?", "Ne zaman?", "Коли?", "متى؟"],
  ["heute", "today", "dzisiaj", "azi", "bugün", "сьогодні", "اليوم"],
  ["morgen", "tomorrow", "jutro", "mâine", "yarın", "завтра", "غدًا"],
  ["Notiz (freiwillig)", "Note (optional)", "Notatka (opcjonalnie)", "Notă (opțional)", "Not (isteğe bağlı)", "Примітка (необов’язково)", "ملاحظة (اختياري)"],
  ["Notiz", "Note", "Notatka", "Notă", "Not", "Примітка", "ملاحظة"],
  ["z. B. Auto kaputt, Zug fällt aus", "e.g. car broke down, train cancelled", "np. zepsuty samochód, odwołany pociąg", "ex. mașină stricată, tren anulat", "örn. araba bozuk, tren iptal", "напр. авто зламане, потяг скасовано", "مثلًا: السيارة معطلة، القطار ملغى"],
  ["Ausfall melden", "Report absence", "Zgłoś nieobecność", "Anunță absența", "Devamsızlık bildir", "Повідомити про відсутність", "الإبلاغ عن الغياب"],
  ["Bitte keine Gesundheitsangaben. Deine Schichten an dem Tag werden abgesagt und das Büro wird benachrichtigt. Eine Krankmeldung gibst du wie gewohnt ab.",
    "Please no health details. Your shifts on that day are cancelled and the office is notified. Hand in a sick note as usual.",
    "Bez informacji o zdrowiu. Twoje zmiany w tym dniu zostaną odwołane, a biuro powiadomione. Zwolnienie lekarskie składasz jak zwykle.",
    "Fără detalii despre sănătate. Turele tale din acea zi se anulează și biroul este anunțat. Certificatul medical îl predai ca de obicei.",
    "Lütfen sağlık bilgisi yazma. O günkü vardiyaların iptal edilir ve ofise haber verilir. Raporunu her zamanki gibi teslim et.",
    "Без даних про здоров’я. Твої зміни цього дня скасовуються, офіс отримує повідомлення. Лікарняний подаєш як завжди.",
    "من فضلك بدون معلومات صحية. تُلغى نوباتك في ذلك اليوم ويُبلَّغ المكتب. قدّم الإجازة المرضية كالمعتاد."],
  // Time clock
  ["Stempeluhr", "Time clock", "Rejestracja czasu", "Pontaj", "Mesai saati", "Облік часу", "ساعة الدوام"],
  ["Nicht eingestempelt.", "Not clocked in.", "Nie odbito wejścia.", "Nu ești pontat.", "Giriş yapılmadı.", "Прихід не відмічено.", "لم تسجّل الحضور."],
  ["Eingestempelt seit", "Clocked in since", "Wejście od", "Pontat de la", "Giriş saati", "Прихід о", "مسجّل الحضور منذ"],
  ["Pause seit", "On break since", "Przerwa od", "Pauză de la", "Mola başlangıcı", "Перерва з", "استراحة منذ"],
  ["Neu beginnen", "Start over", "Zacznij od nowa", "Începe din nou", "Yeniden başla", "Почати заново", "البدء من جديد"],
  ["Kommen", "Clock in", "Wejście", "Intrare", "Giriş", "Прихід", "حضور"],
  ["Gehen", "Clock out", "Wyjście", "Ieșire", "Çıkış", "Вихід", "انصراف"],
  ["Weiter", "Resume", "Dalej", "Continuă", "Devam", "Продовжити", "متابعة"],
  ["Es zählt die Uhrzeit des Servers. Beim Tippen fragt das Handy einmal nach dem Standort: Jarvis prüft nur, ob du in der Nähe des Einsatzorts bist, und speichert keine Koordinaten. Ablehnen geht auch.",
    "The server's clock counts. When you tap, the phone asks once for your location: Jarvis only checks whether you are near the site and stores no coordinates. You can also decline.",
    "Liczy się czas serwera. Po dotknięciu telefon raz zapyta o lokalizację: Jarvis sprawdza tylko, czy jesteś w pobliżu miejsca pracy, i nie zapisuje współrzędnych. Możesz też odmówić.",
    "Contează ora serverului. La atingere, telefonul cere o dată locația: Jarvis verifică doar dacă ești lângă locul de muncă și nu salvează coordonate. Poți și refuza.",
    "Sunucunun saati geçerlidir. Dokunduğunda telefon bir kez konum sorar: Jarvis yalnızca iş yerine yakın olup olmadığını kontrol eder, koordinat kaydetmez. Reddedebilirsin.",
    "Діє час сервера. Під час натискання телефон один раз запитує місцезнаходження: Jarvis лише перевіряє, чи ти поруч з об’єктом, і не зберігає координати. Можна відмовитися.",
    "يُعتمد وقت الخادم. عند الضغط يطلب الهاتف موقعك مرة واحدة: يتحقق Jarvis فقط من وجودك قرب موقع العمل ولا يحفظ أي إحداثيات. يمكنك الرفض أيضًا."],
  // Shifts
  ["Meine Schichten", "My shifts", "Moje zmiany", "Turele mele", "Vardiyalarım", "Мої зміни", "نوباتي"],
  ["Offene Schichten", "Open shifts", "Wolne zmiany", "Ture libere", "Açık vardiyalar", "Вільні зміни", "نوبات متاحة"],
  ["Wer zuerst tippt, bekommt die Schicht. Das Büro wird benachrichtigt.", "First to tap gets the shift. The office is notified.", "Kto pierwszy dotknie, dostaje zmianę. Biuro zostanie powiadomione.", "Cine apasă primul primește tura. Biroul este anunțat.", "İlk dokunan vardiyayı alır. Ofise haber verilir.", "Хто перший натисне, той отримує зміну. Офіс отримає повідомлення.", "أول من يضغط يحصل على النوبة. يُبلَّغ المكتب."],
  ["Übernehmen", "Take it", "Biorę", "Preiau", "Üstlen", "Беру", "أستلمها"],
  ["Zusagen", "Accept", "Potwierdź", "Accept", "Kabul et", "Підтвердити", "قبول"],
  ["Absagen", "Decline", "Odmów", "Refuz", "Reddet", "Відмовити", "رفض"],
  ["zugesagt", "accepted", "potwierdzone", "acceptat", "kabul edildi", "підтверджено", "مقبولة"],
  ["abgesagt", "declined", "odwołane", "anulat", "iptal", "скасовано", "ملغاة"],
  ["wartet auf Antwort", "awaiting reply", "czeka na odpowiedź", "așteaptă răspuns", "yanıt bekleniyor", "очікує відповіді", "بانتظار الرد"],
  ["Infos zum Einsatzort", "Site information", "Informacje o miejscu pracy", "Informații despre locul de muncă", "İş yeri bilgileri", "Інформація про об’єкт", "معلومات موقع العمل"],
  ["Gerade keine Schichten geplant.", "No shifts planned right now.", "Brak zaplanowanych zmian.", "Momentan nu sunt ture planificate.", "Şu an planlı vardiya yok.", "Зараз змін не заплановано.", "لا توجد نوبات مخططة حاليًا."],
  // Hours
  ["Meine Stunden", "My hours", "Moje godziny", "Orele mele", "Saatlerim", "Мої години", "ساعاتي"],
  ["Stunden eintragen", "Enter hours", "Wpisz godziny", "Introdu orele", "Saat gir", "Внести години", "إدخال الساعات"],
  ["Einsatz / Kunde", "Job / customer", "Zlecenie / klient", "Misiune / client", "Görev / müşteri", "Об’єкт / клієнт", "المهمة / العميل"],
  ["Pause (Min.)", "Break (min)", "Przerwa (min)", "Pauză (min)", "Mola (dk)", "Перерва (хв)", "الاستراحة (دقيقة)"],
  ["Pause unter 45 Min. bei über 9 Std.", "break under 45 min for more than 9 h", "przerwa poniżej 45 min przy ponad 9 godz.", "pauză sub 45 min la peste 9 ore", "9 saatten fazla çalışmada 45 dk'dan kısa mola", "перерва менше 45 хв при понад 9 год", "استراحة أقل من 45 دقيقة لأكثر من 9 ساعات"],
  ["davon freigegeben", "of which approved", "w tym zatwierdzone", "din care aprobate", "onaylanan", "з них затверджено", "منها معتمدة"],
  ["Eintrag löschen", "Delete entry", "Usuń wpis", "Șterge înregistrarea", "Kaydı sil", "Видалити запис", "حذف الإدخال"],
  ["Datum", "Date", "Data", "Data", "Tarih", "Дата", "التاريخ"],
  ["Beginn", "Start", "Początek", "Început", "Başlangıç", "Початок", "البداية"],
  ["Ende", "End", "Koniec", "Sfârșit", "Bitiş", "Кінець", "النهاية"],
  ["Pause", "Break", "Przerwa", "Pauză", "Mola", "Перерва", "استراحة"],
  ["Speichern", "Save", "Zapisz", "Salvează", "Kaydet", "Зберегти", "حفظ"],
  ["Löschen", "Delete", "Usuń", "Șterge", "Sil", "Видалити", "حذف"],
  ["freigegeben", "approved", "zatwierdzone", "aprobat", "onaylandı", "затверджено", "معتمد"],
  ["abgelehnt", "rejected", "odrzucone", "respins", "reddedildi", "відхилено", "مرفوض"],
  ["offen", "open", "otwarte", "deschis", "açık", "відкрито", "مفتوح"],
  ["Std.", "h", "godz.", "ore", "sa.", "год.", "ساعة"],
  ["Min.", "min", "min", "min", "dk", "хв", "دقيقة"],
  ["Zeitkonto", "Time account", "Konto czasu pracy", "Cont de ore", "Zaman hesabı", "Рахунок годин", "رصيد الساعات"],
  ["(Stand heute, freigegebene Stunden)", "(as of today, approved hours)", "(stan na dziś, zatwierdzone godziny)", "(la zi, ore aprobate)", "(bugün itibarıyla, onaylı saatler)", "(станом на сьогодні, затверджені години)", "(حتى اليوم، الساعات المعتمدة)"],
  // Leave
  ["Urlaub & Abwesenheit", "Leave & absence", "Urlop i nieobecność", "Concediu și absență", "İzin ve devamsızlık", "Відпустка та відсутність", "الإجازة والغياب"],
  ["Urlaub beantragen", "Request leave", "Wniosek o urlop", "Cere concediu", "İzin talep et", "Подати заяву на відпустку", "طلب إجازة"],
  ["Nicht verfügbar", "Not available", "Niedostępny", "Indisponibil", "Müsait değil", "Недоступний", "غير متاح"],
  ["beantragt, wartet auf das Büro", "requested, waiting for the office", "złożony, czeka na biuro", "cerut, așteaptă biroul", "talep edildi, ofis bekleniyor", "подано, чекає на офіс", "مُقدَّم، بانتظار المكتب"],
  ["Antrag zurückziehen", "Withdraw request", "Wycofaj wniosek", "Retrage cererea", "Talebi geri çek", "Відкликати заяву", "سحب الطلب"],
  ["Das Büro bestätigt den Antrag. Bitte keine Gesundheitsangaben: Für Krankheit „Nicht verfügbar“ wählen und Bescheinigungen wie gewohnt abgeben.",
    "The office confirms the request. No health details please: for illness choose “Not available” and hand in certificates as usual.",
    "Biuro potwierdza wniosek. Bez informacji o zdrowiu: przy chorobie wybierz „Niedostępny” i składaj zaświadczenia jak zwykle.",
    "Biroul confirmă cererea. Fără detalii despre sănătate: pentru boală alege „Indisponibil” și predă certificatele ca de obicei.",
    "Ofis talebi onaylar. Lütfen sağlık bilgisi yazma: hastalık için „Müsait değil“ seç ve belgeleri her zamanki gibi teslim et.",
    "Офіс підтверджує заяву. Без даних про здоров’я: при хворобі обери «Недоступний» і подавай довідки як завжди.",
    "يؤكد المكتب الطلب. بدون معلومات صحية: في حالة المرض اختر «غير متاح» وقدّم الشهادات كالمعتاد."],
  ["Beantragen", "Request", "Złóż wniosek", "Trimite cererea", "Talep et", "Подати", "تقديم الطلب"],
  ["bestätigt", "confirmed", "potwierdzone", "confirmat", "onaylandı", "підтверджено", "مؤكَّد"],
  ["Urlaub", "Leave", "Urlop", "Concediu", "İzin", "Відпустка", "إجازة"],
  ["Grund", "Reason", "Powód", "Motiv", "Sebep", "Причина", "السبب"],
  ["Von", "From", "Od", "De la", "Başlangıç", "З", "من"],
  ["Bis", "To", "Do", "Până la", "Bitiş", "До", "إلى"],
  ["genommen", "taken", "wykorzystano", "luat", "kullanılan", "використано", "مأخوذة"],
  ["beantragt", "requested", "złożono", "cerut", "talep edilen", "подано", "مطلوبة"],
  ["Rest", "left", "pozostało", "rămas", "kalan", "залишок", "المتبقي"],
  ["Tage", "days", "dni", "zile", "gün", "днів", "أيام"],
  ["aus dem Vorjahr", "from last year", "z zeszłego roku", "din anul trecut", "geçen yıldan", "з минулого року", "من العام الماضي"],
  // Jobs
  ["Meine Einsätze", "My jobs", "Moje zlecenia", "Misiunile mele", "Görevlerim", "Мої завдання", "مهامي"],
  ["Gerade keine Einsätze eingetragen.", "No jobs entered right now.", "Brak wpisanych zleceń.", "Momentan nu sunt misiuni.", "Şu an kayıtlı görev yok.", "Зараз завдань немає.", "لا توجد مهام مسجلة حاليًا."],
  ["Überlassung an", "Placed with", "Oddelegowanie do", "Detașare la", "Görevlendirme:", "Направлення до", "إعارة إلى"],
  ["ohne festes Ende", "no fixed end", "bez ustalonego końca", "fără sfârșit fix", "bitiş tarihi yok", "без фіксованого кінця", "بدون نهاية محددة"],
  ["läuft", "ongoing", "trwa", "în curs", "devam ediyor", "триває", "جارية"],
  // Certificates
  ["Meine Nachweise", "My certificates", "Moje zaświadczenia", "Certificatele mele", "Belgelerim", "Мої документи", "شهاداتي"],
  ["Nachweis hochladen", "Upload certificate", "Prześlij zaświadczenie", "Încarcă certificat", "Belge yükle", "Завантажити документ", "رفع شهادة"],
  ["Datei (PDF, PNG oder JPG bis 5 MB)", "File (PDF, PNG or JPG up to 5 MB)", "Plik (PDF, PNG lub JPG do 5 MB)", "Fișier (PDF, PNG sau JPG până la 5 MB)", "Dosya (PDF, PNG veya JPG, en fazla 5 MB)", "Файл (PDF, PNG або JPG до 5 МБ)", "ملف (PDF أو PNG أو JPG حتى 5 ميغابايت)"],
  ["Ein Foto mit dem Handy reicht. Das Büro sieht den Nachweis sofort in deiner Personalakte.", "A phone photo is enough. The office sees it right away in your file.", "Wystarczy zdjęcie telefonem. Biuro od razu widzi je w Twoich aktach.", "Ajunge o poză cu telefonul. Biroul o vede imediat în dosarul tău.", "Telefonla çekilmiş bir fotoğraf yeterli. Ofis belgeyi hemen dosyanda görür.", "Достатньо фото з телефону. Офіс одразу бачить його у твоїй особовій справі.", "تكفي صورة بالهاتف. يرى المكتب الشهادة فورًا في ملفك."],
  ["Qualifikation", "Qualification", "Kwalifikacja", "Calificare", "Yeterlilik", "Кваліфікація", "المؤهل"],
  ["Erworben", "Obtained", "Uzyskano", "Obținut", "Alındı", "Отримано", "تاريخ الحصول"],
  ["Gültig bis", "Valid until", "Ważne do", "Valabil până la", "Geçerlilik sonu", "Дійсне до", "صالح حتى"],
  ["gültig bis", "valid until", "ważne do", "valabil până la", "geçerlilik sonu", "дійсне до", "صالح حتى"],
  ["abgelaufen am", "expired on", "wygasło", "expirat la", "süresi doldu:", "закінчилося", "انتهى في"],
  ["ohne Ablauf", "no expiry", "bezterminowo", "fără expirare", "süresiz", "безстроково", "بدون انتهاء"],
  ["Hochladen", "Upload", "Prześlij", "Încarcă", "Yükle", "Завантажити", "رفع"],
  ["Datei", "File", "Plik", "Fișier", "Dosya", "Файл", "ملف"],
  // Protective equipment, instructions
  ["Meine Schutzausrüstung", "My protective equipment", "Moje środki ochrony", "Echipamentul meu de protecție", "Koruyucu ekipmanım", "Мої засоби захисту", "معدات الحماية الخاصة بي"],
  ["Austausch", "replace by", "wymiana", "înlocuire", "değişim", "заміна", "الاستبدال"],
  ["seit", "since", "od", "din", "itibaren", "з", "منذ"],
  ["Gr.", "Size", "Rozm.", "Mărime", "Beden", "Розм.", "المقاس"],
  ["Unterweisungen", "Safety briefings", "Szkolenia BHP", "Instruiri", "İSG eğitimleri", "Інструктажі", "تعليمات السلامة"],
  ["noch nicht unterwiesen", "not briefed yet", "jeszcze nie przeszkolony", "încă neinstruit", "henüz eğitim almadı", "ще не проінструктовано", "لم يتم التدريب بعد"],
  ["fällig seit", "due since", "zaległe od", "scadent din", "şu tarihten beri gecikmiş:", "прострочено з", "مستحق منذ"],
  ["zuletzt", "last", "ostatnio", "ultima", "son", "останній", "آخر مرة"],
  ["nächste", "next", "następne", "următoarea", "sonraki", "наступний", "القادم"],
  ["Inhalt lesen", "Read content", "Przeczytaj treść", "Citește conținutul", "İçeriği oku", "Прочитати зміст", "قراءة المحتوى"],
  ["Mit „Gelesen und verstanden“ bestätigst du die Unterweisung mit Datum. Fragen? Sprich vorher deine Vorgesetzten an.",
    "“Read and understood” confirms the briefing with the date. Questions? Ask your supervisor first.",
    "„Przeczytano i zrozumiano” potwierdza szkolenie z datą. Pytania? Zapytaj najpierw przełożonego.",
    "„Citit și înțeles” confirmă instruirea cu data. Întrebări? Întreabă mai întâi șeful.",
    "„Okudum ve anladım“ eğitimi tarihle onaylar. Sorun mu var? Önce amirine sor.",
    "«Прочитано і зрозуміло» підтверджує інструктаж із датою. Питання? Спершу звернися до керівника.",
    "«قرأت وفهمت» يؤكد التعليمات مع التاريخ. لديك أسئلة؟ اسأل مسؤولك أولًا."],
  ["Gelesen und verstanden", "Read and understood", "Przeczytano i zrozumiano", "Citit și înțeles", "Okudum ve anladım", "Прочитано і зрозуміло", "قرأت وفهمت"],
  // Signatures
  ["Bitte unterschreiben", "Please sign", "Proszę podpisać", "Te rog semnează", "Lütfen imzala", "Будь ласка, підпиши", "يرجى التوقيع"],
  ["Mit dem Finger unterschreiben", "Sign with your finger", "Podpisz palcem", "Semnează cu degetul", "Parmağınla imzala", "Підпиши пальцем", "وقّع بإصبعك"],
  ["Unterschriftsfeld", "Signature field", "Pole podpisu", "Câmp semnătură", "İmza alanı", "Поле підпису", "حقل التوقيع"],
  ["Unterschreiben", "Sign", "Podpisz", "Semnează", "İmzala", "Підписати", "توقيع"],
  ["Ich bestätige die Richtigkeit meiner Arbeitszeiten.", "I confirm that my working hours are correct.", "Potwierdzam poprawność moich godzin pracy.", "Confirm corectitudinea orelor mele de lucru.", "Çalışma saatlerimin doğru olduğunu onaylıyorum.", "Підтверджую правильність мого робочого часу.", "أؤكد صحة ساعات عملي."],
  ["Ich habe die Schutzausrüstung erhalten und wurde in die Benutzung unterwiesen.", "I have received the protective equipment and was shown how to use it.", "Otrzymałem/am środki ochrony i zostałem/am poinstruowany/a o ich używaniu.", "Am primit echipamentul de protecție și am fost instruit cum să-l folosesc.", "Koruyucu ekipmanı aldım ve kullanımı hakkında bilgilendirildim.", "Я отримав(ла) засоби захисту та пройшов(ла) інструктаж щодо їх використання.", "استلمت معدات الحماية وتلقيت تعليمات استخدامها."],
  ["Empfang der Schutzausrüstung", "Receipt of protective equipment", "Odbiór środków ochrony", "Primirea echipamentului de protecție", "Koruyucu ekipman teslimi", "Отримання засобів захисту", "استلام معدات الحماية"],
  ["Einträge", "entries", "wpisów", "înregistrări", "kayıt", "записів", "إدخالات"],
  ["Eintrag", "entry", "wpis", "înregistrare", "kayıt", "запис", "إدخال"],
  ["Teile", "items", "szt.", "bucăți", "parça", "шт.", "قطع"],
  ["Teil", "item", "szt.", "bucată", "parça", "шт.", "قطعة"],
  ["Stunden", "Hours", "Godziny", "Ore", "Saatler", "Години", "الساعات"],
  ["Leeren", "Clear", "Wyczyść", "Șterge", "Temizle", "Очистити", "مسح"],
  // Expenses
  ["Meine Spesen", "My expenses", "Moje wydatki", "Cheltuielile mele", "Masraflarım", "Мої витрати", "مصاريفي"],
  ["Beleg einreichen", "Submit receipt", "Dodaj paragon", "Trimite bon", "Fiş gönder", "Подати чек", "تقديم إيصال"],
  ["Beleg (Foto oder PDF bis 5 MB)", "Receipt (photo or PDF up to 5 MB)", "Paragon (zdjęcie lub PDF do 5 MB)", "Bon (poză sau PDF până la 5 MB)", "Fiş (fotoğraf veya PDF, en fazla 5 MB)", "Чек (фото або PDF до 5 МБ)", "الإيصال (صورة أو PDF حتى 5 ميغابايت)"],
  ["Betrag (€)", "Amount (€)", "Kwota (€)", "Sumă (€)", "Tutar (€)", "Сума (€)", "المبلغ (€)"],
  ["Einreichen", "Submit", "Wyślij", "Trimite", "Gönder", "Подати", "إرسال"],
  ["Art", "Type", "Rodzaj", "Tip", "Tür", "Вид", "النوع"],
  ["⛽ Tanken", "⛽ Fuel", "⛽ Paliwo", "⛽ Carburant", "⛽ Yakıt", "⛽ Пальне", "⛽ وقود"],
  ["🅿️ Parken", "🅿️ Parking", "🅿️ Parking", "🅿️ Parcare", "🅿️ Otopark", "🅿️ Паркування", "🅿️ موقف"],
  ["🚆 Fahrkarte", "🚆 Ticket", "🚆 Bilet", "🚆 Bilet", "🚆 Bilet", "🚆 Квиток", "🚆 تذكرة"],
  ["🔩 Material", "🔩 Material", "🔩 Materiały", "🔩 Materiale", "🔩 Malzeme", "🔩 Матеріали", "🔩 مواد"],
  ["🍽️ Verpflegung", "🍽️ Meals", "🍽️ Wyżywienie", "🍽️ Masă", "🍽️ Yemek", "🍽️ Харчування", "🍽️ وجبات"],
  ["📦 Sonstiges", "📦 Other", "📦 Inne", "📦 Altele", "📦 Diğer", "📦 Інше", "📦 أخرى"],
  // Weekdays
  ["Montag", "Monday", "Poniedziałek", "Luni", "Pazartesi", "Понеділок", "الإثنين"], ["Dienstag", "Tuesday", "Wtorek", "Marți", "Salı", "Вівторок", "الثلاثاء"],
  ["Mittwoch", "Wednesday", "Środa", "Miercuri", "Çarşamba", "Середа", "الأربعاء"], ["Donnerstag", "Thursday", "Czwartek", "Joi", "Perşembe", "Четвер", "الخميس"],
  ["Freitag", "Friday", "Piątek", "Vineri", "Cuma", "П’ятниця", "الجمعة"], ["Samstag", "Saturday", "Sobota", "Sâmbătă", "Cumartesi", "Субота", "السبت"],
  ["Sonntag", "Sunday", "Niedziela", "Duminică", "Pazar", "Неділя", "الأحد"],
  ["Mo.", "Mon", "pon.", "lun.", "Pzt", "Пн", "الإثنين"], ["Di.", "Tue", "wt.", "mar.", "Sal", "Вт", "الثلاثاء"], ["Mi.", "Wed", "śr.", "mie.", "Çar", "Ср", "الأربعاء"],
  ["Do.", "Thu", "czw.", "joi", "Per", "Чт", "الخميس"], ["Fr.", "Fri", "pt.", "vin.", "Cum", "Пт", "الجمعة"], ["Sa.", "Sat", "sob.", "sâm.", "Cmt", "Сб", "السبت"], ["So.", "Sun", "niedz.", "dum.", "Paz", "Нд", "الأحد"],
  ["Januar", "January", "styczeń", "ianuarie", "Ocak", "січень", "يناير"], ["Februar", "February", "luty", "februarie", "Şubat", "лютий", "فبراير"], ["März", "March", "marzec", "martie", "Mart", "березень", "مارس"],
  ["April", "April", "kwiecień", "aprilie", "Nisan", "квітень", "أبريل"], ["Mai", "May", "maj", "mai", "Mayıs", "травень", "مايو"], ["Juni", "June", "czerwiec", "iunie", "Haziran", "червень", "يونيو"],
  ["Juli", "July", "lipiec", "iulie", "Temmuz", "липень", "يوليو"], ["August", "August", "sierpień", "august", "Ağustos", "серпень", "أغسطس"], ["September", "September", "wrzesień", "septembrie", "Eylül", "вересень", "سبتمبر"],
  ["Oktober", "October", "październik", "octombrie", "Ekim", "жовтень", "أكتوبر"], ["November", "November", "listopad", "noiembrie", "Kasım", "листопад", "نوفمبر"], ["Dezember", "December", "grudzień", "decembrie", "Aralık", "грудень", "ديسمبر"],
  ["Offen", "Open", "Otwarte", "Deschis", "Açık", "Відкрито", "مفتوح"],
  // Footer, messages
  ["Stimmt etwas nicht? Sag im Büro Bescheid; deine Stammdaten pflegt das Büro.", "Something wrong? Tell the office; the office keeps your personal data.", "Coś się nie zgadza? Powiedz w biurze; Twoje dane prowadzi biuro.", "Ceva nu e în regulă? Spune la birou; datele tale le gestionează biroul.", "Bir sorun mu var? Ofise söyle; bilgilerini ofis yönetir.", "Щось не так? Скажи в офісі; твої дані веде офіс.", "هناك خطأ؟ أخبر المكتب؛ المكتب يدير بياناتك."],
  ["Danke, unterschrieben.", "Thank you, signed.", "Dziękujemy, podpisano.", "Mulțumim, semnat.", "Teşekkürler, imzalandı.", "Дякуємо, підписано.", "شكرًا، تم التوقيع."],
  ["Eingestempelt um", "Clocked in at", "Wejście o", "Pontat la", "Giriş saati:", "Прихід о", "تم تسجيل الحضور في"],
  ["Ausgestempelt um", "Clocked out at", "Wyjście o", "Ieșire la", "Çıkış saati:", "Вихід о", "تم تسجيل الانصراف في"],
  ["Pause gestartet um", "Break started at", "Przerwa od", "Pauză începută la", "Mola başladı:", "Перерва почалася о", "بدأت الاستراحة في"],
  ["Beleg eingereicht. Das Büro prüft ihn.", "Receipt submitted. The office will check it.", "Paragon wysłany. Biuro go sprawdzi.", "Bon trimis. Biroul îl verifică.", "Fiş gönderildi. Ofis kontrol edecek.", "Чек подано. Офіс його перевірить.", "تم إرسال الإيصال. سيراجعه المكتب."],
  ["Die Schicht gehört dir.", "The shift is yours.", "Zmiana jest Twoja.", "Tura este a ta.", "Vardiya senin.", "Зміна твоя.", "النوبة لك."],
  ["Sprache", "Language", "Język", "Limbă", "Dil", "Мова", "اللغة"],
];

/** Language from the cookie jv_sprache ("de" if none or unknown). */
export function spracheAus(request: Request): string {
  const s = /(?:^|;\s*)jv_sprache=([a-z]{2})/.exec(request.headers.get("cookie") ?? "")?.[1] ?? "de";
  return SPRACHEN[s] ? s : "de";
}

const roh = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const muster = new Map<string, { re: RegExp; ziel: Map<string, string> }>();
function fuer(sprache: string) {
  let m = muster.get(sprache);
  if (m) return m;
  const i = REIHE.indexOf(sprache as typeof REIHE[number]) + 1;
  const ziel = new Map<string, string>();
  for (const z of [...W].sort((a, b) => b[0].length - a[0].length)) if (!ziel.has(roh(z[0]))) ziel.set(roh(z[0]), escape(z[i]));
  const re = new RegExp(`(?<![\\p{L}])(?:${[...ziel.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}])`, "gu");
  m = { re, ziel };
  muster.set(sprache, m);
  return m;
}

/** Translates the visible texts of a page (text between tags plus placeholder, aria-label and title); sets lang/dir. */
export function uebersetzen(seite: string, sprache: string): string {
  if (sprache === "de" || !SPRACHEN[sprache]) return seite;
  const { re, ziel } = fuer(sprache);
  const tausch = (t: string) => t.replace(/&#38;/g, "&amp;").replace(re, (x) => ziel.get(x) ?? x);
  const teile = seite.split(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<textarea[\s\S]*?<\/textarea>|<[^>]+>)/);
  return teile.map((t, i) => {
    if (i % 2 === 0) return tausch(t);
    if (/^<(style|script|textarea)/.test(t)) return t;
    if (t.startsWith("<html")) return t.replace(/lang="de"/, `lang="${sprache}"${SPRACHEN[sprache].rtl ? ' dir="rtl"' : ""}`);
    return t.replace(/\b(placeholder|aria-label|title)="([^"]*)"/g, (_, a: string, v: string) => `${a}="${tausch(v)}"`);
  }).join("");
}

/** Row of language links for the staff page. */
export function sprachWahl(aktiv: string): string {
  return `<nav class="sprache-wahl" aria-label="Sprache">🌐 ${Object.entries(SPRACHEN).map(([k, v]) => `<a href="/konto/ich?sprache=${k}" lang="${k}"${k === aktiv ? ' aria-current="true"' : ""}>${escape(v.name)}</a>`).join("")}</nav>`;
}
