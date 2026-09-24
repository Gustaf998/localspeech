// Rechtstexte in allen sechs Anzeigesprachen.
//
// Bewusst NICHT in i18n.ts: Die Fliesstexte sind um ein Vielfaches laenger als
// die UI-Strings und werden nach anderen Massstaeben gepflegt (juristisch statt
// sprachlich). Getrennte Datei = getrennte Verantwortung.
//
// MASSGEBLICH IST DIE DEUTSCHE FASSUNG. Aendert sich ein Absatz auf Deutsch,
// muessen alle fuenf Uebersetzungen nachgezogen werden — die Pruefung dafuer
// steht in scripts/check-legal.mjs (npm run check:legal).
//
// Die Werte enthalten Markup (<strong>, <em>, <li>, <a>) und werden ueber
// data-i18n-html per innerHTML eingesetzt. Das ist hier unbedenklich: Es sind
// ausschliesslich statische Literale aus dieser Datei, niemals Nutzereingaben.
import type { UILang } from './languages';

type LegalDict = Record<string, string>;

// --------------------------------------------------------------- Deutsch
const de: LegalDict = {
  'privacy.h1': 'Datenschutzerklärung',
  'privacy.updated': 'Stand: 29. Juli 2026',

  'privacy.s1.h': '1. Verantwortlicher',
  'privacy.s1.p': 'Verantwortlich für die Datenverarbeitung auf dieser Website ist:',

  'privacy.s2.h': '2. Grundprinzip: Verarbeitung auf Ihrem Gerät',
  'privacy.s2.p':
    'LocalSpeech ist eine clientseitige Anwendung. Es gibt <strong>keinen Anwendungsserver</strong>, der Ihre Lerninhalte empfängt oder speichert. Spracherkennung, KI-Sprachmodell und Sprachausgabe laufen vollständig in Ihrem Browser auf Ihrem Endgerät. Insbesondere Ihre Spracheingaben (Mikrofon), die Gesprächsverläufe, von Ihnen hochgeladene Dokumente und selbst erstellte Charaktere werden zu keinem Zeitpunkt an uns oder Dritte übertragen. Eine Übertragung ins Internet findet nur in den unter Ziffer 4 bis 6 beschriebenen Fällen statt.',

  'privacy.s3.h': '3. Zugriff auf das Mikrofon',
  'privacy.s3.p':
    'Für das Sprechtraining benötigt die App Zugriff auf Ihr Mikrofon. Der Zugriff erfolgt erst nach Ihrer ausdrücklichen Freigabe über den Browser und kann jederzeit widerrufen werden. Die aufgenommene Sprache wird ausschließlich lokal und flüchtig verarbeitet (Umwandlung in Text durch das lokal laufende Whisper-Modell) und weder gespeichert noch übertragen.<br /><em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO bzw. Ihre Einwilligung über den Browser (Art. 6 Abs. 1 lit. a DSGVO).',

  'privacy.s4.h': '4. Bereitstellung der Website und Server-Logfiles',
  'privacy.s4.p':
    'Beim Aufruf der Website werden durch den Hosting-Anbieter automatisch Informationen erhoben, die Ihr Browser übermittelt (Server-Logfiles): IP-Adresse, Datum und Uhrzeit des Zugriffs, angeforderte Datei, übertragene Datenmenge, Referrer-URL, Browsertyp und Betriebssystem. Dies ist technisch erforderlich, um die Website auszuliefern sowie ihre Stabilität und Sicherheit zu gewährleisten.',
  'privacy.s4.list':
    '<li><strong>Hosting-Anbieter / Auftragsverarbeiter:</strong> Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA (für EU-Kunden vertraglich unter Einbindung der Cloudflare Germany GmbH, Rosental 7, 80331 München). Mit dem Anbieter besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO (Cloudflare Data Processing Addendum).</li>' +
    '<li><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer sicheren, schnellen und ausfallsicheren Bereitstellung der Website über ein Content-Delivery-Netzwerk).</li>' +
    '<li><strong>Speicherdauer:</strong> Cloudflare speichert die Verbindungsdaten nur so lange, wie es für die Sicherheits- und Betriebszwecke (u. a. Erkennung von Angriffen und Missbrauch) erforderlich ist; eine pauschale, fest veröffentlichte Frist nennt Cloudflare nicht. Näheres in der Datenschutzerklärung von Cloudflare (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>).</li>' +
    '<li><strong>Drittlandübermittlung:</strong> Da Cloudflare als globales Netzwerk betrieben wird, ist eine Verarbeitung von Verbindungsdaten auch außerhalb der EU/des EWR (insbesondere USA) nicht ausgeschlossen. Als Garantie dienen die im Auftragsverarbeitungsvertrag vereinbarten EU-Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO.</li>',

  'privacy.s5.h': '5. Herunterladen der KI-Modelle',
  'privacy.s5.p1':
    'Damit die App offline funktioniert, lädt Ihr Browser die benötigten KI-Modelldateien (Sprachmodell, Spracherkennung, Sprachausgabe) <strong>einmalig</strong> herunter und speichert sie lokal (siehe Ziffer 7). Diese Dateien werden derzeit direkt von den Servern von <strong>Hugging Face</strong> bezogen (nebst dem eingesetzten Content-Delivery-Network):',
  'privacy.s5.p2':
    'Beim Download übermittelt Ihr Browser technisch notwendige Verbindungsdaten, insbesondere Ihre <strong>IP-Adresse</strong> sowie Angaben zu Browser und angeforderter Datei, an Hugging Face. Es gilt zusätzlich die Datenschutzerklärung von Hugging Face (<a href="https://huggingface.co/privacy" target="_blank" rel="noopener">huggingface.co/privacy</a>).',
  'privacy.s5.list':
    '<li><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bereitstellung der lokal laufenden Anwendung ohne eigene Serverinfrastruktur).</li>' +
    '<li><strong>Drittlandübermittlung:</strong> Die Übertragung erfolgt in die USA. Als Garantie dienen die vom Anbieter eingesetzten Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO bzw. eine Zertifizierung unter dem EU-U.S. Data Privacy Framework. Ein Zugriff durch US-Behörden kann nicht vollständig ausgeschlossen werden.</li>' +
    '<li><strong>Hinweis:</strong> Der Download findet nur bei der Ersteinrichtung bzw. bei einem Modellwechsel statt. Danach nutzt die App die lokale Kopie und benötigt kein Internet mehr.</li>',

  'privacy.s6.h': '6. Zahlungsabwicklung bei freiwilliger Unterstützung (Stripe)',
  'privacy.s6.p':
    'Auf der Seite „Unterstützen“ können Sie das Projekt freiwillig mit einem Geldbetrag unterstützen. Die Zahlung wickelt der Zahlungsdienstleister Stripe ab (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland). Erst wenn Sie den Bezahlvorgang aktiv starten, wird die Stripe-Bibliothek von Stripe nachgeladen und ein Zahlformular eingebettet; dabei werden die für die Zahlung erforderlichen Daten (z. B. Zahlungsmittel- bzw. Kartendaten, Betrag, IP-Adresse und Browserinformationen) direkt an Stripe übermittelt und dort verarbeitet. Vollständige Zahlungs- bzw. Kartendaten erhalten und speichern wir nicht. Ergänzend gelten die Datenschutzbestimmungen von Stripe (<a href="https://stripe.com/de/privacy" target="_blank" rel="noopener">stripe.com/de/privacy</a>). Eine Übermittlung in Drittländer kann auf Grundlage der EU-Standardvertragsklauseln erfolgen.<br /><em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO (Durchführung der von Ihnen veranlassten Zahlung) sowie Art. 6 Abs. 1 lit. f DSGVO (sichere, betrugsarme Abwicklung).',

  'privacy.s61.h': '6.1 Unsere Serverfunktion beim Zahlungsstart',
  'privacy.s61.p1':
    'Wir selbst fragen für die Unterstützung <strong>keinerlei personenbezogene Daten</strong> ab – weder Name noch E-Mail-Adresse noch Anschrift. Unsere Serverfunktion erhält ausschließlich den gewünschten Betrag und legt damit einen Zahlungsvorgang bei Stripe an. Wir legen keine Nutzerkonten oder Adresslisten an; eine Nutzung für Newsletter, Werbung oder sonstige Kontaktaufnahme findet nicht statt.',
  'privacy.s61.p2':
    '<strong>Missbrauchsschutz:</strong> Beim Start eines Zahlungsvorgangs ruft Ihr Browser eine von uns betriebene Serverfunktion auf. Dabei wird Ihre IP-Adresse für maximal 10 Minuten im Arbeitsspeicher vorgehalten, um die Zahl der Anfragen pro Absender zu begrenzen. Eine dauerhafte Speicherung, Protokollierung oder Zusammenführung mit anderen Daten findet nicht statt.<br /><em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Abwehr missbräuchlicher Nutzung).',
  'privacy.s61.p3':
    '<em>Hinweis:</em> Das eingebettete Stripe-Zahlformular kann je nach gewähltem Zahlungsmittel eigene Angaben abfragen (etwa Name oder E-Mail-Adresse, wenn der Zahlungsdienstleister dies zwingend verlangt). Diese Eingaben erfolgen direkt gegenüber Stripe; wir erhalten sie nicht. Die Speicherung erfolgt dort im Rahmen der Zahlungs- und Aufbewahrungsfristen (gesetzliche handels- und steuerrechtliche Aufbewahrungspflichten von bis zu zehn Jahren).',

  'privacy.s7.h': '7. Lokale Speicherung auf Ihrem Gerät',
  'privacy.s7.p':
    'Die App speichert Daten ausschließlich lokal in Ihrem Browser: Ihre Einstellungen (z. B. gewählte Sprachen, Modellauswahl, Stimme, Lernstufe, eigener Charakter, ggf. hochgeladener Dokumenttext) im <code>localStorage</code> sowie die heruntergeladenen KI-Modelle im Browser-Speicher (Origin Private File System / Cache), damit die App offline und schnell startet. Diese Speicherung ist für den von Ihnen gewünschten Betrieb der Anwendung unbedingt erforderlich; es werden keine Informationen an uns oder Dritte übertragen und keine Cookies zu Analyse- oder Werbezwecken gesetzt.<br /><em>Rechtsgrundlage:</em> § 25 Abs. 2 Nr. 2 TDDDG i. V. m. Art. 6 Abs. 1 lit. f DSGVO. Sie können diese Daten jederzeit über die Einstellungen Ihres Browsers oder über „Alle Daten &amp; Modelle löschen“ in der App entfernen.',

  'privacy.s7.p2':
    '<strong>Service Worker:</strong> Damit die App auch ohne Internetverbindung startet, installiert diese Website ein kleines Hintergrundskript in Ihrem Browser (einen sogenannten Service Worker, Datei <code>sw.js</code>). Es legt die Programmdateien der Seite im Cache-Speicher Ihres Browsers ab und beantwortet spätere Aufrufe aus dieser Kopie. Es behandelt ausschließlich Anfragen an diese Website selbst, überträgt nichts an uns oder Dritte und wertet Ihr Verhalten nicht aus. Sie können ihn jederzeit über die Website-Einstellungen Ihres Browsers entfernen.<br /><em>Rechtsgrundlage:</em> § 25 Abs. 2 Nr. 2 TDDDG i. V. m. Art. 6 Abs. 1 lit. f DSGVO.',
  'privacy.s8.h': '8. Legenden-Modus und eigene Charaktere',
  'privacy.s8.p':
    'Im Legenden-Modus können Sie Gespräche mit KI-Nachbildungen bekannter, verstorbener Persönlichkeiten führen oder eigene Charaktere erstellen. Es handelt sich um künstlich erzeugte, fiktive Simulationen – nicht um die realen Personen und nicht um echte Zitate. Die gesamte Verarbeitung (Rollen-Vorgabe, Ihre Eingaben, die Antworten) findet vollständig lokal statt; es werden keine Inhalte übertragen.',

  'privacy.s9.h': '9. Kein Tracking, keine Werbe-Cookies',
  'privacy.s9.p':
    'Wir selbst setzen keine Analyse-, Tracking- oder Werbe-Cookies, führen keine Reichweitenmessung durch und legen keine Nutzerprofile an. Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne des Art. 22 DSGVO findet nicht statt.',
  'privacy.s9.p2':
    '<strong>Technisch notwendige Cookies unseres Hosters:</strong> Cloudflare (siehe Ziffer 4) kann zur Abwehr von Angriffen und automatisierten Zugriffen eigene Sicherheits-Cookies setzen, etwa <code>__cf_bm</code> zur Bot-Erkennung (Speicherdauer rund 30 Minuten) oder <code>cf_clearance</code> nach einer bestandenen Sicherheitsprüfung. Diese Cookies dienen ausschließlich der Sicherheit und dem störungsfreien Betrieb der Website; sie werden nicht zu Analyse- oder Werbezwecken ausgewertet und ermöglichen uns keine Wiedererkennung Ihrer Person.<br /><em>Rechtsgrundlage:</em> § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich, um den von Ihnen gewünschten Dienst bereitzustellen) i. V. m. Art. 6 Abs. 1 lit. f DSGVO. Eine Einwilligung ist hierfür nicht erforderlich; deshalb zeigt diese Website kein Cookie-Banner.',

  'privacy.s9.p3':
    '<strong>Cookies des Zahlungsdienstleisters:</strong> Erst wenn Sie den Bezahlvorgang aktiv starten, wird Stripe.js geladen. Stripe setzt dabei eigene, technisch notwendige Cookies bzw. vergleichbare Speichereinträge auf dieser Domain, um eine Zahlung Ihrer Sitzung zuzuordnen und Betrug zu erkennen; zu diesem Zweck kann Stripe zusätzlich den Dienst hCaptcha nachladen. Diese Einträge dienen ausschließlich der Abwicklung und Absicherung der von Ihnen veranlassten Zahlung und nicht der Analyse oder Werbung. Solange Sie den Bezahlvorgang nicht starten, wird Stripe.js nicht geladen und es werden dementsprechend auch keine solchen Cookies gesetzt. Die jeweils aktuelle Auflistung finden Sie in der Cookie-Richtlinie von Stripe (<a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener">stripe.com/cookies-policy/legal</a>).<br /><em>Rechtsgrundlage:</em> § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich für den von Ihnen gewünschten Dienst) i. V. m. Art. 6 Abs. 1 lit. b und lit. f DSGVO.',
  'privacy.s10.h': '10. Kontaktaufnahme',
  'privacy.s10.p':
    'Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir die von Ihnen mitgeteilten Daten zur Bearbeitung Ihrer Anfrage.<br /><em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. f bzw. lit. b DSGVO. Die Daten werden gelöscht, sobald sie zur Erreichung des Zwecks nicht mehr erforderlich sind, vorbehaltlich gesetzlicher Aufbewahrungspflichten.',

  'privacy.s11.h': '11. Ihre Rechte',
  'privacy.s11.p':
    'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie ein Widerspruchsrecht gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21). Eine erteilte Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO).',

  'privacy.s12.h': '12. Beschwerderecht bei der Aufsichtsbehörde',
  'privacy.s12.p':
    'Ihnen steht ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu. Zuständig für den Verantwortlichen ist:',

  'privacy.s13.h': '13. Aktualität',
  'privacy.s13.p':
    'Wir passen diese Datenschutzerklärung an, wenn sich die Datenverarbeitung ändert (etwa bei Umstellung der Modellauslieferung auf eigenes Hosting). Es gilt die jeweils hier veröffentlichte Fassung.',

  'terms.h1': 'Nutzungsbedingungen',
  'terms.updated': 'Stand: 29. Juli 2026',
  'terms.lead':
    'Diese Bedingungen regeln die Nutzung von LocalSpeech – einem kostenlosen Werkzeug zum Sprachenlernen, das vollständig auf Ihrem eigenen Gerät läuft. Mit der Nutzung der App erkennen Sie diese Bedingungen an.',

  'terms.s1.h': 'Gegenstand',
  'terms.s1.p':
    'LocalSpeech ist eine clientseitige Anwendung, mit der Sie Sprachen im Gespräch mit einem KI-Sprachpartner üben. Spracherkennung, KI-Modell und Sprachausgabe laufen lokal in Ihrem Browser. Es gibt keine Nutzerkonten, keinen Anwendungsserver und keine Cloud-Verarbeitung Ihrer Inhalte.',

  'terms.s2.h': 'Kostenlose Bereitstellung',
  'terms.s2.p':
    'Die Nutzung ist unentgeltlich. Es besteht kein Anspruch auf ständige Verfügbarkeit, eine bestimmte Funktion oder Fehlerfreiheit. Die App wird „wie besehen“ bereitgestellt; wir dürfen Funktionen jederzeit ändern, einschränken oder einstellen. Freiwillige Unterstützungsbeiträge (z. B. über Stripe) begründen keine darüber hinausgehenden Ansprüche.',

  'terms.s3.h': 'KI-generierte Inhalte',
  'terms.s3.p':
    'Die Antworten des Sprachpartners werden maschinell von einem KI-Modell erzeugt und können sachlich falsch, unvollständig, veraltet oder unangemessen sein. Sie geben nicht die Auffassung des Betreibers wieder und stellen keine Rechts-, Medizin-, Finanz- oder sonstige Fachberatung dar. Prüfen Sie wichtige Informationen eigenständig und verlassen Sie sich nicht ungeprüft auf KI-Ausgaben. Die Nutzung erfolgt auf eigene Verantwortung.',

  'terms.s4.h': 'Legenden-Modus',
  'terms.s4.p':
    'Die wählbaren Persönlichkeiten sind frei erfundene KI-Nachbildungen verstorbener Personen – weder die realen Personen noch echte Zitate. Die Porträts sind eigene, stilisierte Illustrationen. Selbst erstellte Charaktere liegen in Ihrer Verantwortung.',

  'terms.s5.h': 'Ihre Pflichten',
  'terms.s5.p':
    'Sie verpflichten sich, die App nicht missbräuchlich oder in rechtsverletzender Weise zu nutzen und die erzeugten Inhalte nicht für rechtswidrige Zwecke zu verwenden. Für Dokumente, die Sie als Gesprächskontext hochladen, sowie für selbst erstellte Charaktere sind Sie allein verantwortlich; diese werden ausschließlich lokal verarbeitet.',

  'terms.s6.h': 'Rechte an Inhalten, Software und Modellen',
  'terms.s6.p':
    'Die Software von LocalSpeech steht unter der <strong>GNU General Public License v3.0 oder später</strong>; der Quelltext ist öffentlich einsehbar. Diese Nutzungsbedingungen regeln ausschließlich die Nutzung des von uns betriebenen Angebots und beschränken die Ihnen durch die GPL eingeräumten Rechte an der Software nicht. Die verwendeten KI-Modelle stammen von Dritten und unterliegen deren jeweiligen Lizenzbedingungen. Eine vollständige Aufstellung finden Sie auf der Seite <a href="#/lizenzen">Lizenzen</a>. Ihre lokal gespeicherten Daten und Einstellungen verbleiben auf Ihrem Gerät und gehören Ihnen. Marken- und Namensrechte Dritter — einschließlich des Namens „LocalSpeech“ — bleiben unberührt.',

  'terms.s7.h': 'Haftung',
  'terms.s7.p':
    'Für die von der KI erzeugten Inhalte übernimmt der Betreiber keine Haftung. Da LocalSpeech unentgeltlich bereitgestellt wird, haftet der Betreiber – soweit gesetzlich zulässig – nur für Vorsatz und grobe Fahrlässigkeit. Die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie nach zwingenden gesetzlichen Vorschriften (z. B. Produkthaftungsgesetz) bleibt hiervon unberührt.',

  'terms.s8.h': 'Änderungen dieser Bedingungen',
  'terms.s8.p':
    'Wir können diese Nutzungsbedingungen anpassen, wenn sich die App oder die rechtlichen Rahmenbedingungen ändern. Es gilt jeweils die hier veröffentlichte Fassung.',

  'terms.s9.h': 'Anwendbares Recht &amp; Schlussbestimmungen',
  'terms.s9.p':
    'Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts; zwingende Verbraucherschutzvorschriften Ihres Wohnsitzstaats bleiben unberührt. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.',

  // ------------------------------------------------------------- Lizenzen
  'licenses.h1': 'Lizenzen',
  'licenses.kicker': 'Offener Quelltext',
  'licenses.lead':
    'LocalSpeech ist freie Software. Auf dieser Seite finden Sie den Quelltext, die Lizenz der Anwendung selbst sowie alle verwendeten Bausteine und KI-Modelle mit ihren Lizenzen.',
  'licenses.app.h': 'LocalSpeech selbst',
  'licenses.app.p':
    'LocalSpeech steht unter der <strong>GNU General Public License v3.0 oder später</strong>. Sie dürfen die Software nutzen, weitergeben und verändern; geben Sie sie weiter, muss dies unter derselben Lizenz und mit Quelltext geschehen. Copyright © 2026 Chris Velten. Der Name „LocalSpeech“ und das Logo sind hiervon ausgenommen – Marken- und Namensrechte bleiben vorbehalten.',
  'licenses.app.source': 'Quelltext auf GitHub ansehen',
  'licenses.app.license': 'Lizenztext (GPL-3.0) lesen',
  'licenses.pkg.h': 'Verwendete Bibliotheken',
  'licenses.pkg.p':
    'Diese Liste wird bei jedem Build automatisch aus den tatsächlich verwendeten Paketen erzeugt und kann daher nicht veralten.',
  'licenses.model.h': 'KI-Modelle',
  'licenses.model.p':
    'Die Modelle werden nicht von uns ausgeliefert, sondern von Ihrem Browser direkt bei Hugging Face geladen. Es gelten die Bedingungen der jeweiligen Anbieter.',
  'licenses.full': 'Vollständige Lizenztexte aller Komponenten',
  'licenses.count': '{n} Pakete',
  'licenses.colVersion': 'Version',
  'licenses.colLicense': 'Lizenz',
};

// --------------------------------------------------------------- English
const en: LegalDict = {
  'privacy.h1': 'Privacy Policy',
  'privacy.updated': 'Last updated: 29 July 2026',

  'privacy.s1.h': '1. Controller',
  'privacy.s1.p': 'The controller for data processing on this website is:',

  'privacy.s2.h': '2. Core principle: processing on your device',
  'privacy.s2.p':
    'LocalSpeech is a client-side application. There is <strong>no application server</strong> that receives or stores your learning content. Speech recognition, the AI language model and speech synthesis run entirely in your browser on your own device. In particular, your voice input (microphone), conversation histories, documents you upload and characters you create are never transmitted to us or to third parties. Data is sent over the internet only in the cases described in sections 4 to 6.',

  'privacy.s3.h': '3. Microphone access',
  'privacy.s3.p':
    'Speaking practice requires access to your microphone. Access is granted only after your explicit permission via the browser and can be revoked at any time. The recorded speech is processed exclusively locally and transiently (converted to text by the locally running Whisper model); it is neither stored nor transmitted.<br /><em>Legal basis:</em> Art. 6(1)(b) GDPR, or your consent given via the browser (Art. 6(1)(a) GDPR).',

  'privacy.s4.h': '4. Provision of the website and server log files',
  'privacy.s4.p':
    'When you access the website, the hosting provider automatically collects information transmitted by your browser (server log files): IP address, date and time of access, requested file, volume of data transferred, referrer URL, browser type and operating system. This is technically necessary in order to deliver the website and to ensure its stability and security.',
  'privacy.s4.list':
    '<li><strong>Hosting provider / processor:</strong> Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA (for EU customers contractually involving Cloudflare Germany GmbH, Rosental 7, 80331 Munich, Germany). A data processing agreement pursuant to Art. 28 GDPR is in place with the provider (Cloudflare Data Processing Addendum).</li>' +
    '<li><strong>Legal basis:</strong> Art. 6(1)(f) GDPR (legitimate interest in providing the website securely, quickly and reliably via a content delivery network).</li>' +
    '<li><strong>Retention period:</strong> Cloudflare stores connection data only for as long as required for security and operational purposes (including detection of attacks and abuse); Cloudflare does not publish a fixed blanket retention period. Further details can be found in Cloudflare’s privacy policy (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>).</li>' +
    '<li><strong>Transfers to third countries:</strong> Because Cloudflare operates as a global network, processing of connection data outside the EU/EEA (in particular in the USA) cannot be ruled out. The EU standard contractual clauses agreed in the data processing agreement pursuant to Art. 46(2)(c) GDPR serve as the safeguard.</li>',

  'privacy.s5.h': '5. Downloading the AI models',
  'privacy.s5.p1':
    'So that the app works offline, your browser downloads the required AI model files (language model, speech recognition, speech synthesis) <strong>once</strong> and stores them locally (see section 7). These files are currently obtained directly from the servers of <strong>Hugging Face</strong> (together with the content delivery network it uses):',
  'privacy.s5.p2':
    'During the download, your browser transmits technically necessary connection data to Hugging Face, in particular your <strong>IP address</strong> as well as information about your browser and the requested file. Hugging Face’s privacy policy applies in addition (<a href="https://huggingface.co/privacy" target="_blank" rel="noopener">huggingface.co/privacy</a>).',
  'privacy.s5.list':
    '<li><strong>Legal basis:</strong> Art. 6(1)(f) GDPR (legitimate interest in providing a locally running application without operating our own server infrastructure).</li>' +
    '<li><strong>Transfers to third countries:</strong> Data is transferred to the USA. The safeguards are the standard contractual clauses used by the provider pursuant to Art. 46(2)(c) GDPR and/or certification under the EU-U.S. Data Privacy Framework. Access by US authorities cannot be entirely ruled out.</li>' +
    '<li><strong>Note:</strong> The download only takes place during initial setup or when you switch models. After that the app uses the local copy and no longer needs an internet connection.</li>',

  'privacy.s6.h': '6. Payment processing for voluntary support (Stripe)',
  'privacy.s6.p':
    'On the “Support” section you can voluntarily support the project with a sum of money. Payment is handled by the payment service provider Stripe (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Ireland). Only once you actively start the payment process is the Stripe library loaded from Stripe and a payment form embedded; the data required for the payment (e.g. payment method or card details, amount, IP address and browser information) is then transmitted directly to Stripe and processed there. We neither receive nor store complete payment or card details. Stripe’s privacy policy applies in addition (<a href="https://stripe.com/privacy" target="_blank" rel="noopener">stripe.com/privacy</a>). Transfers to third countries may take place on the basis of the EU standard contractual clauses.<br /><em>Legal basis:</em> Art. 6(1)(b) GDPR (carrying out the payment you initiated) and Art. 6(1)(f) GDPR (secure, low-fraud processing).',

  'privacy.s61.h': '6.1 Our server function when a payment starts',
  'privacy.s61.p1':
    'We ourselves request <strong>no personal data whatsoever</strong> for supporting the project — neither name nor email address nor postal address. Our server function receives only the desired amount and uses it to create a payment with Stripe. We do not create user accounts or mailing lists; the data is not used for newsletters, advertising or any other form of contact.',
  'privacy.s61.p2':
    '<strong>Abuse protection:</strong> When a payment is started, your browser calls a server function operated by us. In doing so, your IP address is held in memory for a maximum of 10 minutes in order to limit the number of requests per sender. It is not stored permanently, not logged, and not combined with any other data.<br /><em>Legal basis:</em> Art. 6(1)(f) GDPR (legitimate interest in preventing abusive use).',
  'privacy.s61.p3':
    '<em>Note:</em> Depending on the payment method chosen, the embedded Stripe payment form may request details of its own (such as name or email address, where the payment service provider strictly requires them). These entries are made directly to Stripe; we do not receive them. They are stored there within Stripe’s payment and retention periods (statutory commercial and tax retention obligations of up to ten years).',

  'privacy.s7.h': '7. Local storage on your device',
  'privacy.s7.p':
    'The app stores data exclusively locally in your browser: your settings (e.g. selected languages, model choice, voice, proficiency level, custom character, and any uploaded document text) in <code>localStorage</code>, and the downloaded AI models in browser storage (Origin Private File System / Cache) so that the app starts quickly and works offline. This storage is strictly necessary for the operation of the application you have requested; no information is transmitted to us or to third parties, and no cookies are set for analytics or advertising purposes.<br /><em>Legal basis:</em> Section 25(2) no. 2 TDDDG in conjunction with Art. 6(1)(f) GDPR. You can delete this data at any time via your browser settings or via “Delete all data &amp; models” in the app.',

  'privacy.s7.p2':
    '<strong>Service worker:</strong> So that the app also starts without an internet connection, this website installs a small background script in your browser (a so-called service worker, file <code>sw.js</code>). It stores the site&rsquo;s program files in your browser&rsquo;s cache and answers later requests from that copy. It handles only requests to this website itself, transmits nothing to us or to third parties and does not evaluate your behaviour. You can remove it at any time via your browser&rsquo;s site settings.<br /><em>Legal basis:</em> Section 25(2) no. 2 TDDDG in conjunction with Art. 6(1)(f) GDPR.',
  'privacy.s8.h': '8. Legends mode and custom characters',
  'privacy.s8.p':
    'In Legends mode you can hold conversations with AI recreations of well-known, deceased figures, or create your own characters. These are artificially generated, fictional simulations — not the real people and not genuine quotations. All processing (role prompt, your input, the responses) takes place entirely locally; no content is transmitted.',

  'privacy.s9.h': '9. No tracking, no advertising cookies',
  'privacy.s9.p':
    'We ourselves do not set analytics, tracking or advertising cookies, we carry out no audience measurement and we create no user profiles. Automated decision-making, including profiling within the meaning of Art. 22 GDPR, does not take place.',
  'privacy.s9.p2':
    '<strong>Strictly necessary cookies set by our hosting provider:</strong> In order to fend off attacks and automated access, Cloudflare (see section 4) may set security cookies of its own, such as <code>__cf_bm</code> for bot detection (retained for around 30 minutes) or <code>cf_clearance</code> after a successful security check. These cookies serve solely the security and uninterrupted operation of the website; they are not evaluated for analytics or advertising purposes and do not enable us to identify you.<br /><em>Legal basis:</em> Section 25(2) no. 2 TDDDG (strictly necessary in order to provide the service you have requested) in conjunction with Art. 6(1)(f) GDPR. No consent is required for this, which is why this website displays no cookie banner.',

  'privacy.s9.p3':
    '<strong>Cookies of the payment service provider:</strong> Stripe.js is loaded only once you actively start the payment process. In doing so, Stripe sets its own technically necessary cookies or comparable storage entries on this domain in order to associate a payment with your session and to detect fraud; for this purpose Stripe may additionally load the hCaptcha service. These entries serve solely to process and secure the payment you initiated, not for analytics or advertising. As long as you do not start the payment process, Stripe.js is not loaded and no such cookies are set. The current list can be found in Stripe&rsquo;s cookie policy (<a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener">stripe.com/cookies-policy/legal</a>).<br /><em>Legal basis:</em> Section 25(2) no. 2 TDDDG (strictly necessary for the service you requested) in conjunction with Art. 6(1)(b) and (f) GDPR.',
  'privacy.s10.h': '10. Contacting us',
  'privacy.s10.p':
    'If you contact us by email, we process the data you provide in order to handle your enquiry.<br /><em>Legal basis:</em> Art. 6(1)(f) or (b) GDPR. The data is deleted as soon as it is no longer required to achieve that purpose, subject to statutory retention obligations.',

  'privacy.s11.h': '11. Your rights',
  'privacy.s11.p':
    'You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and the right to object to processing based on Art. 6(1)(f) GDPR (Art. 21). You may withdraw any consent you have given at any time with effect for the future (Art. 7(3) GDPR).',

  'privacy.s12.h': '12. Right to lodge a complaint with a supervisory authority',
  'privacy.s12.p':
    'You have the right to lodge a complaint with a data protection supervisory authority. The authority responsible for the controller is:',

  'privacy.s13.h': '13. Currency of this policy',
  'privacy.s13.p':
    'We update this privacy policy whenever data processing changes (for example if model delivery is moved to our own hosting). The version published here applies in each case.',

  'terms.h1': 'Terms of Use',
  'terms.updated': 'Last updated: 29 July 2026',
  'terms.lead':
    'These terms govern the use of LocalSpeech — a free language-learning tool that runs entirely on your own device. By using the app you accept these terms. This is a translation provided for convenience; in the event of any discrepancy, the German version of these terms shall prevail.',

  'terms.s1.h': 'Subject matter',
  'terms.s1.p':
    'LocalSpeech is a client-side application that lets you practise languages in conversation with an AI speaking partner. Speech recognition, the AI model and speech synthesis run locally in your browser. There are no user accounts, no application server and no cloud processing of your content.',

  'terms.s2.h': 'Free provision',
  'terms.s2.p':
    'Use is free of charge. There is no entitlement to continuous availability, to any particular feature, or to freedom from defects. The app is provided “as is”; we may change, restrict or discontinue features at any time. Voluntary support contributions (e.g. via Stripe) do not give rise to any further claims.',

  'terms.s3.h': 'AI-generated content',
  'terms.s3.p':
    'The speaking partner’s responses are generated automatically by an AI model and may be factually incorrect, incomplete, outdated or inappropriate. They do not reflect the operator’s views and do not constitute legal, medical, financial or other professional advice. Verify important information independently and do not rely on AI output without checking it. Use is at your own risk.',

  'terms.s4.h': 'Legends mode',
  'terms.s4.p':
    'The available figures are entirely fictional AI recreations of deceased people — neither the real persons nor genuine quotations. The portraits are our own stylised illustrations. Characters you create yourself are your own responsibility.',

  'terms.s5.h': 'Your obligations',
  'terms.s5.p':
    'You undertake not to use the app abusively or in any way that infringes the law, and not to use the generated content for unlawful purposes. You are solely responsible for documents you upload as conversation context and for characters you create yourself; these are processed exclusively locally.',

  'terms.s6.h': 'Rights to content, software and models',
  'terms.s6.p':
    'The LocalSpeech software is licensed under the <strong>GNU General Public License v3.0 or later</strong>; the source code is publicly available. These terms govern only the use of the service we operate and do not restrict the rights the GPL grants you in the software. The AI models used originate from third parties and are subject to their respective licence terms. A complete list is available on the <a href="#/lizenzen">Licences</a> page. Your locally stored data and settings remain on your device and belong to you. Third-party trade mark and name rights — including the name “LocalSpeech” — remain unaffected.',

  'terms.s7.h': 'Liability',
  'terms.s7.p':
    'The operator accepts no liability for content generated by the AI. As LocalSpeech is provided free of charge, the operator is liable — to the extent permitted by law — only for intent and gross negligence. Liability for damage arising from injury to life, limb or health and under mandatory statutory provisions (e.g. the German Product Liability Act) remains unaffected.',

  'terms.s8.h': 'Changes to these terms',
  'terms.s8.p':
    'We may amend these terms of use if the app or the legal framework changes. The version published here applies in each case.',

  'terms.s9.h': 'Applicable law &amp; final provisions',
  'terms.s9.p':
    'The law of the Federal Republic of Germany applies, excluding the UN Convention on Contracts for the International Sale of Goods; mandatory consumer protection provisions of your country of residence remain unaffected. Should any provision be invalid, the validity of the remaining provisions remains unaffected.',

  // -------------------------------------------------------------- Licences
  'licenses.h1': 'Licences',
  'licenses.kicker': 'Open source',
  'licenses.lead':
    'LocalSpeech is free software. This page lists the source code, the licence of the application itself, and every component and AI model used, with their licences.',
  'licenses.app.h': 'LocalSpeech itself',
  'licenses.app.p':
    'LocalSpeech is licensed under the <strong>GNU General Public License v3.0 or later</strong>. You may use, share and modify the software; if you pass it on, you must do so under the same licence and include the source code. Copyright © 2026 Chris Velten. The name “LocalSpeech” and the logo are excluded from this; trademark and name rights remain reserved.',
  'licenses.app.source': 'View the source code on GitHub',
  'licenses.app.license': 'Read the licence text (GPL-3.0)',
  'licenses.pkg.h': 'Libraries used',
  'licenses.pkg.p':
    'This list is generated automatically from the packages actually in use on every build, so it cannot go out of date.',
  'licenses.model.h': 'AI models',
  'licenses.model.p':
    'The models are not distributed by us — your browser downloads them directly from Hugging Face. The terms of the respective providers apply.',
  'licenses.full': 'Full licence texts of all components',
  'licenses.count': '{n} packages',
  'licenses.colVersion': 'Version',
  'licenses.colLicense': 'Licence',
};

// --------------------------------------------------------------- Español
const es: LegalDict = {
  'privacy.h1': 'Política de privacidad',
  'privacy.updated': 'Última actualización: 29 de julio de 2026',

  'privacy.s1.h': '1. Responsable del tratamiento',
  'privacy.s1.p': 'El responsable del tratamiento de datos en este sitio web es:',

  'privacy.s2.h': '2. Principio básico: el tratamiento se realiza en su dispositivo',
  'privacy.s2.p':
    'LocalSpeech es una aplicación que se ejecuta en el cliente. No existe <strong>ningún servidor de aplicación</strong> que reciba o almacene sus contenidos de aprendizaje. El reconocimiento de voz, el modelo de lenguaje de IA y la síntesis de voz se ejecutan íntegramente en su navegador, en su propio dispositivo. En particular, sus entradas de voz (micrófono), los historiales de conversación, los documentos que suba y los personajes que cree no se transmiten en ningún momento ni a nosotros ni a terceros. Solo se envían datos a internet en los casos descritos en los apartados 4 a 6.',

  'privacy.s3.h': '3. Acceso al micrófono',
  'privacy.s3.p':
    'Para practicar la conversación, la aplicación necesita acceder a su micrófono. El acceso solo se produce tras su autorización expresa a través del navegador y puede revocarse en cualquier momento. La voz grabada se procesa exclusivamente de forma local y transitoria (conversión a texto mediante el modelo Whisper que se ejecuta localmente) y no se almacena ni se transmite.<br /><em>Base jurídica:</em> art. 6.1.b RGPD o su consentimiento otorgado a través del navegador (art. 6.1.a RGPD).',

  'privacy.s4.h': '4. Prestación del sitio web y archivos de registro del servidor',
  'privacy.s4.p':
    'Al acceder al sitio web, el proveedor de alojamiento recoge automáticamente la información que transmite su navegador (archivos de registro del servidor): dirección IP, fecha y hora del acceso, archivo solicitado, volumen de datos transferidos, URL de referencia, tipo de navegador y sistema operativo. Esto es técnicamente necesario para entregar el sitio web y garantizar su estabilidad y seguridad.',
  'privacy.s4.list':
    '<li><strong>Proveedor de alojamiento / encargado del tratamiento:</strong> Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, EE. UU. (para clientes de la UE, con participación contractual de Cloudflare Germany GmbH, Rosental 7, 80331 Múnich, Alemania). Existe un contrato de encargo del tratamiento conforme al art. 28 RGPD (Cloudflare Data Processing Addendum).</li>' +
    '<li><strong>Base jurídica:</strong> art. 6.1.f RGPD (interés legítimo en prestar el sitio web de forma segura, rápida y resistente a fallos mediante una red de distribución de contenidos).</li>' +
    '<li><strong>Plazo de conservación:</strong> Cloudflare conserva los datos de conexión únicamente durante el tiempo necesario para fines de seguridad y funcionamiento (entre otros, la detección de ataques y usos abusivos); Cloudflare no publica un plazo general fijo. Más información en la política de privacidad de Cloudflare (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>).</li>' +
    '<li><strong>Transferencias a terceros países:</strong> Dado que Cloudflare opera como red global, no cabe excluir un tratamiento de los datos de conexión fuera de la UE/EEE (en particular en EE. UU.). Como garantía sirven las cláusulas contractuales tipo de la UE acordadas en el contrato de encargo, conforme al art. 46.2.c RGPD.</li>',

  'privacy.s5.h': '5. Descarga de los modelos de IA',
  'privacy.s5.p1':
    'Para que la aplicación funcione sin conexión, su navegador descarga <strong>una sola vez</strong> los archivos de los modelos de IA necesarios (modelo de lenguaje, reconocimiento de voz, síntesis de voz) y los guarda localmente (véase el apartado 7). Actualmente, estos archivos se obtienen directamente de los servidores de <strong>Hugging Face</strong> (junto con la red de distribución de contenidos que emplea):',
  'privacy.s5.p2':
    'Durante la descarga, su navegador transmite a Hugging Face los datos de conexión técnicamente necesarios, en particular su <strong>dirección IP</strong>, así como información sobre el navegador y el archivo solicitado. Se aplica adicionalmente la política de privacidad de Hugging Face (<a href="https://huggingface.co/privacy" target="_blank" rel="noopener">huggingface.co/privacy</a>).',
  'privacy.s5.list':
    '<li><strong>Base jurídica:</strong> art. 6.1.f RGPD (interés legítimo en ofrecer la aplicación de ejecución local sin infraestructura de servidor propia).</li>' +
    '<li><strong>Transferencias a terceros países:</strong> La transferencia se realiza a EE. UU. Como garantía sirven las cláusulas contractuales tipo empleadas por el proveedor conforme al art. 46.2.c RGPD o una certificación conforme al Marco de Privacidad de Datos UE-EE. UU. No puede descartarse por completo el acceso por parte de las autoridades estadounidenses.</li>' +
    '<li><strong>Nota:</strong> La descarga solo se produce durante la configuración inicial o al cambiar de modelo. Después, la aplicación utiliza la copia local y ya no necesita conexión a internet.</li>',

  'privacy.s6.h': '6. Tramitación de pagos para el apoyo voluntario (Stripe)',
  'privacy.s6.p':
    'En la sección «Apoyar» puede apoyar el proyecto voluntariamente con una cantidad de dinero. El pago lo tramita el proveedor de servicios de pago Stripe (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublín, Irlanda). Solo cuando usted inicia activamente el proceso de pago se carga la biblioteca de Stripe y se incrusta un formulario de pago; en ese momento, los datos necesarios para el pago (p. ej. datos del medio de pago o de la tarjeta, importe, dirección IP e información del navegador) se transmiten directamente a Stripe y se tratan allí. Nosotros no recibimos ni almacenamos datos completos de pago o de tarjeta. Se aplica adicionalmente la política de privacidad de Stripe (<a href="https://stripe.com/es/privacy" target="_blank" rel="noopener">stripe.com/es/privacy</a>). Puede producirse una transferencia a terceros países sobre la base de las cláusulas contractuales tipo de la UE.<br /><em>Base jurídica:</em> art. 6.1.b RGPD (ejecución del pago iniciado por usted) y art. 6.1.f RGPD (tramitación segura y con bajo riesgo de fraude).',

  'privacy.s61.h': '6.1 Nuestra función de servidor al iniciar un pago',
  'privacy.s61.p1':
    'Nosotros no solicitamos <strong>ningún dato personal</strong> para el apoyo: ni nombre, ni dirección de correo electrónico, ni dirección postal. Nuestra función de servidor recibe únicamente el importe deseado y con él crea una operación de pago en Stripe. No creamos cuentas de usuario ni listas de direcciones; los datos no se utilizan para boletines, publicidad ni ningún otro tipo de contacto.',
  'privacy.s61.p2':
    '<strong>Protección frente a usos abusivos:</strong> Al iniciar un pago, su navegador llama a una función de servidor operada por nosotros. En ese proceso, su dirección IP se mantiene en memoria durante un máximo de 10 minutos con el fin de limitar el número de solicitudes por remitente. No se almacena de forma permanente, no se registra y no se combina con otros datos.<br /><em>Base jurídica:</em> art. 6.1.f RGPD (interés legítimo en evitar un uso abusivo).',
  'privacy.s61.p3':
    '<em>Nota:</em> Según el medio de pago elegido, el formulario de pago incrustado de Stripe puede solicitar datos propios (por ejemplo, nombre o dirección de correo electrónico, cuando el proveedor de servicios de pago lo exija obligatoriamente). Estas entradas se realizan directamente ante Stripe; nosotros no las recibimos. Su conservación se produce allí en el marco de los plazos de pago y conservación (obligaciones legales mercantiles y fiscales de hasta diez años).',

  'privacy.s7.h': '7. Almacenamiento local en su dispositivo',
  'privacy.s7.p':
    'La aplicación almacena datos exclusivamente de forma local en su navegador: sus ajustes (p. ej. idiomas elegidos, selección de modelo, voz, nivel, personaje propio y, en su caso, el texto de un documento subido) en <code>localStorage</code>, así como los modelos de IA descargados en el almacenamiento del navegador (Origin Private File System / caché), para que la aplicación se inicie con rapidez y funcione sin conexión. Este almacenamiento es estrictamente necesario para el funcionamiento de la aplicación que usted ha solicitado; no se transmite información alguna ni a nosotros ni a terceros, y no se instalan cookies con fines analíticos o publicitarios.<br /><em>Base jurídica:</em> § 25.2 n.º 2 TDDDG en relación con el art. 6.1.f RGPD. Puede eliminar estos datos en cualquier momento desde los ajustes de su navegador o mediante «Eliminar todos los datos y modelos» en la aplicación.',

  'privacy.s7.p2':
    '<strong>Service worker:</strong> Para que la aplicación también se inicie sin conexión a internet, este sitio web instala un pequeño script en segundo plano en su navegador (denominado service worker, archivo <code>sw.js</code>). Almacena los archivos de programa de la página en la memoria caché de su navegador y responde a las solicitudes posteriores desde esa copia. Solo trata solicitudes dirigidas a este mismo sitio web, no transmite nada a nosotros ni a terceros y no evalúa su comportamiento. Puede eliminarlo en cualquier momento desde la configuración de sitios de su navegador.<br /><em>Base jurídica:</em> § 25 ap. 2 n.º 2 TDDDG en relación con el art. 6 ap. 1 letra f RGPD.',
  'privacy.s8.h': '8. Modo Leyendas y personajes propios',
  'privacy.s8.p':
    'En el modo Leyendas puede mantener conversaciones con recreaciones de IA de personalidades conocidas ya fallecidas, o crear sus propios personajes. Se trata de simulaciones ficticias generadas artificialmente: no son las personas reales ni citas auténticas. Todo el tratamiento (indicación del papel, sus entradas, las respuestas) se realiza íntegramente en local; no se transmite ningún contenido.',

  'privacy.s9.h': '9. Sin seguimiento, sin cookies publicitarias',
  'privacy.s9.p':
    'Nosotros no instalamos cookies analíticas, de seguimiento ni publicitarias, no realizamos medición de audiencia ni creamos perfiles de usuario. No se produce ninguna decisión automatizada, incluida la elaboración de perfiles en el sentido del art. 22 RGPD.',
  'privacy.s9.p2':
    '<strong>Cookies técnicamente necesarias de nuestro proveedor de alojamiento:</strong> Para repeler ataques y accesos automatizados, Cloudflare (véase el apartado 4) puede instalar cookies de seguridad propias, como <code>__cf_bm</code> para la detección de bots (con una duración aproximada de 30 minutos) o <code>cf_clearance</code> tras superar una comprobación de seguridad. Estas cookies sirven exclusivamente a la seguridad y al funcionamiento sin interrupciones del sitio web; no se evalúan con fines analíticos o publicitarios y no nos permiten reconocerle a usted.<br /><em>Base jurídica:</em> § 25.2 n.º 2 TDDDG (estrictamente necesarias para prestar el servicio que usted ha solicitado) en relación con el art. 6.1.f RGPD. Para ello no se requiere consentimiento, razón por la cual este sitio web no muestra ningún aviso de cookies.',

  'privacy.s9.p3':
    '<strong>Cookies del proveedor de servicios de pago:</strong> Stripe.js solo se carga cuando usted inicia activamente el proceso de pago. Al hacerlo, Stripe establece sus propias cookies técnicamente necesarias o entradas de almacenamiento equiparables en este dominio para asociar un pago a su sesión y detectar fraudes; con esta finalidad, Stripe puede cargar además el servicio hCaptcha. Estas entradas sirven exclusivamente para tramitar y asegurar el pago que usted ha iniciado, y no para análisis ni publicidad. Mientras no inicie el proceso de pago, Stripe.js no se carga y, en consecuencia, tampoco se establecen tales cookies. Encontrará la relación actualizada en la política de cookies de Stripe (<a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener">stripe.com/cookies-policy/legal</a>).<br /><em>Base jurídica:</em> § 25 ap. 2 n.º 2 TDDDG (estrictamente necesario para el servicio solicitado) en relación con el art. 6 ap. 1 letras b y f RGPD.',
  'privacy.s10.h': '10. Contacto',
  'privacy.s10.p':
    'Si se pone en contacto con nosotros por correo electrónico, trataremos los datos que nos facilite para gestionar su consulta.<br /><em>Base jurídica:</em> art. 6.1.f o 6.1.b RGPD. Los datos se suprimen en cuanto dejan de ser necesarios para alcanzar dicha finalidad, sin perjuicio de las obligaciones legales de conservación.',

  'privacy.s11.h': '11. Sus derechos',
  'privacy.s11.p':
    'Tiene derecho de acceso (art. 15 RGPD), rectificación (art. 16), supresión (art. 17), limitación del tratamiento (art. 18), portabilidad de los datos (art. 20), así como derecho de oposición frente a tratamientos basados en el art. 6.1.f RGPD (art. 21). Puede retirar en cualquier momento un consentimiento otorgado, con efectos para el futuro (art. 7.3 RGPD).',

  'privacy.s12.h': '12. Derecho a presentar una reclamación ante la autoridad de control',
  'privacy.s12.p':
    'Le asiste el derecho a presentar una reclamación ante una autoridad de control en materia de protección de datos. La autoridad competente para el responsable es:',

  'privacy.s13.h': '13. Vigencia',
  'privacy.s13.p':
    'Adaptamos esta política de privacidad cuando cambia el tratamiento de datos (por ejemplo, si la entrega de los modelos pasa a alojamiento propio). Rige en cada caso la versión publicada aquí.',

  'terms.h1': 'Condiciones de uso',
  'terms.updated': 'Última actualización: 29 de julio de 2026',
  'terms.lead':
    'Estas condiciones regulan el uso de LocalSpeech, una herramienta gratuita para aprender idiomas que se ejecuta íntegramente en su propio dispositivo. Al utilizar la aplicación, usted acepta estas condiciones. Esta es una traducción de cortesía; en caso de discrepancia, prevalecerá la versión alemana de estas condiciones.',

  'terms.s1.h': 'Objeto',
  'terms.s1.p':
    'LocalSpeech es una aplicación de cliente con la que puede practicar idiomas conversando con un interlocutor de IA. El reconocimiento de voz, el modelo de IA y la síntesis de voz se ejecutan localmente en su navegador. No hay cuentas de usuario, ni servidor de aplicación, ni tratamiento en la nube de sus contenidos.',

  'terms.s2.h': 'Prestación gratuita',
  'terms.s2.p':
    'El uso es gratuito. No existe derecho alguno a una disponibilidad permanente, a una función determinada o a la ausencia de errores. La aplicación se ofrece «tal cual»; podemos modificar, limitar o suspender funciones en cualquier momento. Las aportaciones voluntarias de apoyo (p. ej. a través de Stripe) no generan derechos adicionales.',

  'terms.s3.h': 'Contenidos generados por IA',
  'terms.s3.p':
    'Las respuestas del interlocutor se generan automáticamente mediante un modelo de IA y pueden ser objetivamente incorrectas, incompletas, desactualizadas o inadecuadas. No reflejan la opinión del operador y no constituyen asesoramiento jurídico, médico, financiero ni de ningún otro tipo profesional. Verifique de forma independiente la información importante y no confíe en los resultados de la IA sin comprobarlos. El uso se realiza bajo su propia responsabilidad.',

  'terms.s4.h': 'Modo Leyendas',
  'terms.s4.p':
    'Las personalidades disponibles son recreaciones de IA totalmente ficticias de personas fallecidas: no son las personas reales ni citas auténticas. Los retratos son ilustraciones estilizadas propias. Los personajes que cree usted mismo son responsabilidad suya.',

  'terms.s5.h': 'Sus obligaciones',
  'terms.s5.p':
    'Se compromete a no utilizar la aplicación de forma abusiva o lesiva de derechos, ni a emplear los contenidos generados con fines ilícitos. Usted es el único responsable de los documentos que suba como contexto de conversación y de los personajes que cree; estos se tratan exclusivamente en local.',

  'terms.s6.h': 'Derechos sobre contenidos, software y modelos',
  'terms.s6.p':
    'El software de LocalSpeech se distribuye bajo la <strong>Licencia Pública General de GNU v3.0 o posterior</strong>; el código fuente es de acceso público. Estas condiciones regulan únicamente el uso del servicio que operamos y no limitan los derechos que la GPL le concede sobre el software. Los modelos de IA empleados proceden de terceros y están sujetos a sus respectivas condiciones de licencia. Encontrará una relación completa en la página de <a href="#/lizenzen">Licencias</a>. Sus datos y ajustes almacenados localmente permanecen en su dispositivo y le pertenecen. Los derechos de marca y de denominación de terceros —incluido el nombre «LocalSpeech»— permanecen inalterados.',

  'terms.s7.h': 'Responsabilidad',
  'terms.s7.p':
    'El operador no asume responsabilidad alguna por los contenidos generados por la IA. Dado que LocalSpeech se ofrece de forma gratuita, el operador responde —en la medida en que la ley lo permita— únicamente por dolo y culpa grave. Queda a salvo la responsabilidad por daños derivados de lesiones a la vida, la integridad física o la salud, así como la derivada de disposiciones legales imperativas (p. ej. la Ley alemana de responsabilidad por productos defectuosos).',

  'terms.s8.h': 'Modificaciones de estas condiciones',
  'terms.s8.p':
    'Podemos adaptar estas condiciones de uso si cambian la aplicación o el marco jurídico. Rige en cada caso la versión publicada aquí.',

  'terms.s9.h': 'Derecho aplicable y disposiciones finales',
  'terms.s9.p':
    'Se aplica el Derecho de la República Federal de Alemania, con exclusión de la Convención de las Naciones Unidas sobre los Contratos de Compraventa Internacional de Mercaderías; las disposiciones imperativas de protección de los consumidores de su país de residencia permanecen inalteradas. Si alguna disposición fuera nula, ello no afectará a la validez de las restantes.',

  // -------------------------------------------------------------- Licencias
  'licenses.h1': 'Licencias',
  'licenses.kicker': 'Código abierto',
  'licenses.lead':
    'LocalSpeech es software libre. En esta página encontrará el código fuente, la licencia de la propia aplicación y todos los componentes y modelos de IA utilizados con sus licencias.',
  'licenses.app.h': 'LocalSpeech en sí',
  'licenses.app.p':
    'LocalSpeech se distribuye bajo la <strong>Licencia Pública General de GNU v3.0 o posterior</strong>. Puede usar, compartir y modificar el software; si lo distribuye, debe hacerlo bajo la misma licencia e incluir el código fuente. Copyright © 2026 Chris Velten. El nombre «LocalSpeech» y el logotipo quedan excluidos; los derechos de marca y denominación quedan reservados.',
  'licenses.app.source': 'Ver el código fuente en GitHub',
  'licenses.app.license': 'Leer el texto de la licencia (GPL-3.0)',
  'licenses.pkg.h': 'Bibliotecas utilizadas',
  'licenses.pkg.p':
    'Esta lista se genera automáticamente en cada compilación a partir de los paquetes realmente utilizados, por lo que no puede quedar obsoleta.',
  'licenses.model.h': 'Modelos de IA',
  'licenses.model.p':
    'Los modelos no los distribuimos nosotros: su navegador los descarga directamente de Hugging Face. Se aplican las condiciones de los respectivos proveedores.',
  'licenses.full': 'Textos completos de las licencias de todos los componentes',
  'licenses.count': '{n} paquetes',
  'licenses.colVersion': 'Versión',
  'licenses.colLicense': 'Licencia',
};

// --------------------------------------------------------------- Français
const fr: LegalDict = {
  'privacy.h1': 'Politique de confidentialité',
  'privacy.updated': 'Dernière mise à jour : 29 juillet 2026',

  'privacy.s1.h': '1. Responsable du traitement',
  'privacy.s1.p': 'Le responsable du traitement des données sur ce site web est :',

  'privacy.s2.h': '2. Principe fondamental : le traitement a lieu sur votre appareil',
  'privacy.s2.p':
    'LocalSpeech est une application côté client. Il n’existe <strong>aucun serveur applicatif</strong> qui reçoive ou stocke vos contenus d’apprentissage. La reconnaissance vocale, le modèle de langage d’IA et la synthèse vocale s’exécutent intégralement dans votre navigateur, sur votre propre appareil. En particulier, vos entrées vocales (microphone), les historiques de conversation, les documents que vous importez et les personnages que vous créez ne sont à aucun moment transmis à nous-mêmes ou à des tiers. Une transmission sur internet n’a lieu que dans les cas décrits aux points 4 à 6.',

  'privacy.s3.h': '3. Accès au microphone',
  'privacy.s3.p':
    'Pour l’entraînement à l’oral, l’application a besoin d’accéder à votre microphone. L’accès n’a lieu qu’après votre autorisation expresse via le navigateur et peut être révoqué à tout moment. La parole enregistrée est traitée exclusivement en local et de manière éphémère (conversion en texte par le modèle Whisper exécuté localement) ; elle n’est ni conservée ni transmise.<br /><em>Base juridique :</em> art. 6, § 1, point b du RGPD ou votre consentement donné via le navigateur (art. 6, § 1, point a du RGPD).',

  'privacy.s4.h': '4. Mise à disposition du site web et fichiers journaux du serveur',
  'privacy.s4.p':
    'Lors de la consultation du site web, l’hébergeur collecte automatiquement les informations transmises par votre navigateur (fichiers journaux du serveur) : adresse IP, date et heure de l’accès, fichier demandé, volume de données transféré, URL de référence, type de navigateur et système d’exploitation. Cela est techniquement nécessaire pour délivrer le site web ainsi que pour garantir sa stabilité et sa sécurité.',
  'privacy.s4.list':
    '<li><strong>Hébergeur / sous-traitant :</strong> Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis (pour les clients de l’UE, avec l’intervention contractuelle de Cloudflare Germany GmbH, Rosental 7, 80331 Munich, Allemagne). Un contrat de sous-traitance au sens de l’art. 28 du RGPD a été conclu avec le prestataire (Cloudflare Data Processing Addendum).</li>' +
    '<li><strong>Base juridique :</strong> art. 6, § 1, point f du RGPD (intérêt légitime à une mise à disposition sûre, rapide et résiliente du site web via un réseau de diffusion de contenu).</li>' +
    '<li><strong>Durée de conservation :</strong> Cloudflare ne conserve les données de connexion que le temps nécessaire aux finalités de sécurité et d’exploitation (notamment la détection des attaques et des abus) ; Cloudflare ne publie pas de durée forfaitaire fixe. Pour en savoir plus, voir la politique de confidentialité de Cloudflare (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>).</li>' +
    '<li><strong>Transfert vers des pays tiers :</strong> Cloudflare étant exploité comme un réseau mondial, un traitement des données de connexion en dehors de l’UE/EEE (en particulier aux États-Unis) ne peut être exclu. Les clauses contractuelles types de l’UE convenues dans le contrat de sous-traitance, au sens de l’art. 46, § 2, point c du RGPD, servent de garantie.</li>',

  'privacy.s5.h': '5. Téléchargement des modèles d’IA',
  'privacy.s5.p1':
    'Pour que l’application fonctionne hors ligne, votre navigateur télécharge <strong>une seule fois</strong> les fichiers de modèles d’IA nécessaires (modèle de langage, reconnaissance vocale, synthèse vocale) et les enregistre localement (voir point 7). Ces fichiers sont actuellement obtenus directement auprès des serveurs de <strong>Hugging Face</strong> (ainsi que du réseau de diffusion de contenu utilisé) :',
  'privacy.s5.p2':
    'Lors du téléchargement, votre navigateur transmet à Hugging Face les données de connexion techniquement nécessaires, en particulier votre <strong>adresse IP</strong> ainsi que des informations sur le navigateur et le fichier demandé. La politique de confidentialité de Hugging Face s’applique en complément (<a href="https://huggingface.co/privacy" target="_blank" rel="noopener">huggingface.co/privacy</a>).',
  'privacy.s5.list':
    '<li><strong>Base juridique :</strong> art. 6, § 1, point f du RGPD (intérêt légitime à proposer l’application exécutée localement sans infrastructure serveur propre).</li>' +
    '<li><strong>Transfert vers des pays tiers :</strong> Le transfert a lieu vers les États-Unis. Les garanties sont les clauses contractuelles types utilisées par le prestataire au sens de l’art. 46, § 2, point c du RGPD ou une certification au titre du cadre de protection des données UE–États-Unis. Un accès par les autorités américaines ne peut être totalement exclu.</li>' +
    '<li><strong>Remarque :</strong> Le téléchargement n’a lieu que lors de la configuration initiale ou d’un changement de modèle. Ensuite, l’application utilise la copie locale et n’a plus besoin d’internet.</li>',

  'privacy.s6.h': '6. Traitement des paiements en cas de soutien volontaire (Stripe)',
  'privacy.s6.p':
    'Dans la section « Soutenir », vous pouvez soutenir volontairement le projet par un versement. Le paiement est traité par le prestataire de services de paiement Stripe (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irlande). Ce n’est qu’au moment où vous lancez activement le paiement que la bibliothèque Stripe est chargée et qu’un formulaire de paiement est intégré ; les données nécessaires au paiement (p. ex. données du moyen de paiement ou de la carte, montant, adresse IP et informations relatives au navigateur) sont alors transmises directement à Stripe et y sont traitées. Nous ne recevons ni ne conservons de données de paiement ou de carte complètes. La politique de confidentialité de Stripe s’applique en complément (<a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener">stripe.com/fr/privacy</a>). Un transfert vers des pays tiers peut avoir lieu sur la base des clauses contractuelles types de l’UE.<br /><em>Base juridique :</em> art. 6, § 1, point b du RGPD (exécution du paiement que vous avez initié) ainsi que art. 6, § 1, point f du RGPD (traitement sûr et peu exposé à la fraude).',

  'privacy.s61.h': '6.1 Notre fonction serveur au lancement du paiement',
  'privacy.s61.p1':
    'Nous ne demandons pour notre part <strong>aucune donnée à caractère personnel</strong> pour le soutien : ni nom, ni adresse e-mail, ni adresse postale. Notre fonction serveur reçoit uniquement le montant souhaité et crée avec celui-ci une opération de paiement chez Stripe. Nous ne créons ni comptes utilisateurs ni listes d’adresses ; aucune utilisation à des fins de newsletter, de publicité ou de toute autre prise de contact n’a lieu.',
  'privacy.s61.p2':
    '<strong>Protection contre les abus :</strong> Au lancement d’un paiement, votre navigateur appelle une fonction serveur que nous exploitons. À cette occasion, votre adresse IP est conservée en mémoire vive pendant 10 minutes au maximum afin de limiter le nombre de requêtes par expéditeur. Elle n’est ni conservée durablement, ni journalisée, ni recoupée avec d’autres données.<br /><em>Base juridique :</em> art. 6, § 1, point f du RGPD (intérêt légitime à prévenir une utilisation abusive).',
  'privacy.s61.p3':
    '<em>Remarque :</em> Selon le moyen de paiement choisi, le formulaire de paiement Stripe intégré peut demander ses propres informations (par exemple le nom ou l’adresse e-mail, lorsque le prestataire de services de paiement l’exige impérativement). Ces saisies sont effectuées directement auprès de Stripe ; nous ne les recevons pas. Leur conservation y a lieu dans le cadre des délais de paiement et de conservation (obligations légales commerciales et fiscales pouvant aller jusqu’à dix ans).',

  'privacy.s7.h': '7. Stockage local sur votre appareil',
  'privacy.s7.p':
    'L’application enregistre les données exclusivement en local dans votre navigateur : vos réglages (p. ex. langues choisies, sélection du modèle, voix, niveau, personnage personnalisé et, le cas échéant, le texte d’un document importé) dans le <code>localStorage</code>, ainsi que les modèles d’IA téléchargés dans le stockage du navigateur (Origin Private File System / cache), afin que l’application démarre rapidement et fonctionne hors ligne. Ce stockage est strictement nécessaire au fonctionnement de l’application que vous avez demandée ; aucune information n’est transmise à nous-mêmes ou à des tiers et aucun cookie n’est déposé à des fins d’analyse ou de publicité.<br /><em>Base juridique :</em> § 25, al. 2, n° 2 TDDDG en liaison avec l’art. 6, § 1, point f du RGPD. Vous pouvez supprimer ces données à tout moment via les réglages de votre navigateur ou via « Supprimer toutes les données et tous les modèles » dans l’application.',

  'privacy.s7.p2':
    '<strong>Service worker :</strong> Afin que l&rsquo;application démarre également sans connexion internet, ce site installe un petit script d&rsquo;arrière-plan dans votre navigateur (appelé service worker, fichier <code>sw.js</code>). Il enregistre les fichiers de programme de la page dans le cache de votre navigateur et répond aux appels ultérieurs à partir de cette copie. Il ne traite que les requêtes adressées à ce site lui-même, ne transmet rien à nous ni à des tiers et n&rsquo;analyse pas votre comportement. Vous pouvez le supprimer à tout moment via les paramètres de site de votre navigateur.<br /><em>Base juridique :</em> § 25 al. 2 n° 2 TDDDG combiné à l&rsquo;art. 6 al. 1 point f RGPD.',
  'privacy.s8.h': '8. Mode Légendes et personnages personnalisés',
  'privacy.s8.p':
    'Dans le mode Légendes, vous pouvez converser avec des reconstitutions par IA de personnalités connues et décédées, ou créer vos propres personnages. Il s’agit de simulations fictives générées artificiellement — ni les personnes réelles ni de véritables citations. L’ensemble du traitement (consigne de rôle, vos saisies, les réponses) a lieu intégralement en local ; aucun contenu n’est transmis.',

  'privacy.s9.h': '9. Pas de traçage, pas de cookies publicitaires',
  'privacy.s9.p':
    'Nous ne déposons pour notre part ni cookies d’analyse, de traçage ou publicitaires, n’effectuons aucune mesure d’audience et ne constituons aucun profil d’utilisateur. Aucune décision automatisée, y compris le profilage au sens de l’art. 22 du RGPD, n’a lieu.',
  'privacy.s9.p2':
    '<strong>Cookies techniquement nécessaires de notre hébergeur :</strong> Afin de repousser les attaques et les accès automatisés, Cloudflare (voir point 4) peut déposer ses propres cookies de sécurité, tels que <code>__cf_bm</code> pour la détection des robots (conservation d’environ 30 minutes) ou <code>cf_clearance</code> après une vérification de sécurité réussie. Ces cookies servent exclusivement à la sécurité et au bon fonctionnement du site web ; ils ne sont pas exploités à des fins d’analyse ou de publicité et ne nous permettent pas de vous identifier.<br /><em>Base juridique :</em> § 25, al. 2, n° 2 TDDDG (strictement nécessaires à la fourniture du service que vous avez demandé) en liaison avec l’art. 6, § 1, point f du RGPD. Aucun consentement n’est requis à cet effet, raison pour laquelle ce site web n’affiche pas de bandeau cookies.',

  'privacy.s9.p3':
    '<strong>Cookies du prestataire de paiement :</strong> Stripe.js n&rsquo;est chargé qu&rsquo;au moment où vous lancez activement le processus de paiement. Stripe dépose alors ses propres cookies techniquement nécessaires ou entrées de stockage comparables sur ce domaine afin de rattacher un paiement à votre session et de détecter les fraudes ; à cette fin, Stripe peut en outre charger le service hCaptcha. Ces entrées servent uniquement au traitement et à la sécurisation du paiement que vous avez initié, et non à des fins d&rsquo;analyse ou de publicité. Tant que vous ne lancez pas le processus de paiement, Stripe.js n&rsquo;est pas chargé et aucun de ces cookies n&rsquo;est donc déposé. La liste à jour figure dans la politique de cookies de Stripe (<a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener">stripe.com/cookies-policy/legal</a>).<br /><em>Base juridique :</em> § 25 al. 2 n° 2 TDDDG (strictement nécessaire au service demandé) combiné à l&rsquo;art. 6 al. 1 points b et f RGPD.',
  'privacy.s10.h': '10. Prise de contact',
  'privacy.s10.p':
    'Si vous nous contactez par e-mail, nous traitons les données que vous nous communiquez afin de traiter votre demande.<br /><em>Base juridique :</em> art. 6, § 1, point f ou point b du RGPD. Les données sont supprimées dès qu’elles ne sont plus nécessaires à cette finalité, sous réserve des obligations légales de conservation.',

  'privacy.s11.h': '11. Vos droits',
  'privacy.s11.p':
    'Vous disposez d’un droit d’accès (art. 15 du RGPD), de rectification (art. 16), d’effacement (art. 17), de limitation du traitement (art. 18), à la portabilité des données (art. 20) ainsi que d’un droit d’opposition aux traitements fondés sur l’art. 6, § 1, point f du RGPD (art. 21). Vous pouvez retirer à tout moment un consentement donné, avec effet pour l’avenir (art. 7, § 3 du RGPD).',

  'privacy.s12.h': '12. Droit de réclamation auprès de l’autorité de contrôle',
  'privacy.s12.p':
    'Vous disposez d’un droit de réclamation auprès d’une autorité de contrôle de la protection des données. L’autorité compétente pour le responsable du traitement est :',

  'privacy.s13.h': '13. Actualité de la présente politique',
  'privacy.s13.p':
    'Nous adaptons la présente politique de confidentialité lorsque le traitement des données évolue (par exemple en cas de passage à un hébergement propre pour la distribution des modèles). La version publiée ici fait foi à chaque instant.',

  'terms.h1': 'Conditions d’utilisation',
  'terms.updated': 'Dernière mise à jour : 29 juillet 2026',
  'terms.lead':
    'Les présentes conditions régissent l’utilisation de LocalSpeech — un outil gratuit d’apprentissage des langues qui s’exécute intégralement sur votre propre appareil. En utilisant l’application, vous acceptez ces conditions. Il s’agit d’une traduction de courtoisie ; en cas de divergence, la version allemande des présentes conditions prévaut.',

  'terms.s1.h': 'Objet',
  'terms.s1.p':
    'LocalSpeech est une application côté client qui vous permet de pratiquer les langues en conversant avec un partenaire de conversation doté d’IA. La reconnaissance vocale, le modèle d’IA et la synthèse vocale s’exécutent localement dans votre navigateur. Il n’existe ni comptes utilisateurs, ni serveur applicatif, ni traitement de vos contenus dans le cloud.',

  'terms.s2.h': 'Mise à disposition gratuite',
  'terms.s2.p':
    'L’utilisation est gratuite. Il n’existe aucun droit à une disponibilité permanente, à une fonctionnalité déterminée ou à l’absence de défauts. L’application est fournie « en l’état » ; nous pouvons modifier, restreindre ou interrompre des fonctionnalités à tout moment. Les contributions de soutien volontaires (p. ex. via Stripe) ne créent aucun droit supplémentaire.',

  'terms.s3.h': 'Contenus générés par l’IA',
  'terms.s3.p':
    'Les réponses du partenaire de conversation sont générées automatiquement par un modèle d’IA et peuvent être factuellement fausses, incomplètes, obsolètes ou inappropriées. Elles ne reflètent pas l’opinion de l’exploitant et ne constituent pas un conseil juridique, médical, financier ou tout autre conseil professionnel. Vérifiez par vous-même les informations importantes et ne vous fiez pas sans contrôle aux réponses de l’IA. L’utilisation se fait sous votre propre responsabilité.',

  'terms.s4.h': 'Mode Légendes',
  'terms.s4.p':
    'Les personnalités proposées sont des reconstitutions par IA entièrement fictives de personnes décédées — ni les personnes réelles ni de véritables citations. Les portraits sont nos propres illustrations stylisées. Les personnages que vous créez vous-même relèvent de votre responsabilité.',

  'terms.s5.h': 'Vos obligations',
  'terms.s5.p':
    'Vous vous engagez à ne pas utiliser l’application de manière abusive ou contraire au droit et à ne pas employer les contenus générés à des fins illicites. Vous êtes seul responsable des documents que vous importez comme contexte de conversation ainsi que des personnages que vous créez ; ceux-ci sont traités exclusivement en local.',

  'terms.s6.h': 'Droits sur les contenus, le logiciel et les modèles',
  'terms.s6.p':
    'Le logiciel LocalSpeech est placé sous <strong>licence publique générale GNU v3.0 ou ultérieure</strong> ; le code source est accessible publiquement. Les présentes conditions régissent uniquement l’utilisation du service que nous exploitons et ne restreignent pas les droits que la GPL vous confère sur le logiciel. Les modèles d’IA utilisés proviennent de tiers et sont soumis à leurs conditions de licence respectives. Vous trouverez une liste complète sur la page <a href="#/lizenzen">Licences</a>. Vos données et réglages enregistrés localement restent sur votre appareil et vous appartiennent. Les droits de marque et de dénomination de tiers — y compris le nom « LocalSpeech » — demeurent inchangés.',

  'terms.s7.h': 'Responsabilité',
  'terms.s7.p':
    'L’exploitant n’assume aucune responsabilité pour les contenus générés par l’IA. LocalSpeech étant mis à disposition gratuitement, l’exploitant n’est responsable — dans la mesure permise par la loi — qu’en cas de faute intentionnelle et de négligence grave. La responsabilité pour les dommages résultant d’une atteinte à la vie, à l’intégrité physique ou à la santé, ainsi qu’en vertu de dispositions légales impératives (p. ex. la loi allemande sur la responsabilité du fait des produits), demeure inchangée.',

  'terms.s8.h': 'Modification des présentes conditions',
  'terms.s8.p':
    'Nous pouvons adapter les présentes conditions d’utilisation si l’application ou le cadre juridique évolue. La version publiée ici fait foi à chaque instant.',

  'terms.s9.h': 'Droit applicable et dispositions finales',
  'terms.s9.p':
    'Le droit de la République fédérale d’Allemagne s’applique, à l’exclusion de la Convention des Nations unies sur les contrats de vente internationale de marchandises ; les dispositions impératives de protection des consommateurs de votre pays de résidence demeurent inchangées. Si une disposition devait être nulle, la validité des autres dispositions n’en serait pas affectée.',

  // --------------------------------------------------------------- Licences
  'licenses.h1': 'Licences',
  'licenses.kicker': 'Code source ouvert',
  'licenses.lead':
    'LocalSpeech est un logiciel libre. Cette page présente le code source, la licence de l’application elle-même ainsi que tous les composants et modèles d’IA utilisés avec leurs licences.',
  'licenses.app.h': 'LocalSpeech lui-même',
  'licenses.app.p':
    'LocalSpeech est placé sous <strong>licence publique générale GNU v3.0 ou ultérieure</strong>. Vous pouvez utiliser, partager et modifier le logiciel ; si vous le transmettez, vous devez le faire sous la même licence et fournir le code source. Copyright © 2026 Chris Velten. Le nom « LocalSpeech » et le logo sont exclus de cette licence ; les droits de marque et de nom restent réservés.',
  'licenses.app.source': 'Voir le code source sur GitHub',
  'licenses.app.license': 'Lire le texte de la licence (GPL-3.0)',
  'licenses.pkg.h': 'Bibliothèques utilisées',
  'licenses.pkg.p':
    'Cette liste est générée automatiquement à chaque compilation à partir des paquets réellement utilisés ; elle ne peut donc pas devenir obsolète.',
  'licenses.model.h': 'Modèles d’IA',
  'licenses.model.p':
    'Les modèles ne sont pas distribués par nous : votre navigateur les télécharge directement depuis Hugging Face. Les conditions des fournisseurs respectifs s’appliquent.',
  'licenses.full': 'Textes complets des licences de tous les composants',
  'licenses.count': '{n} paquets',
  'licenses.colVersion': 'Version',
  'licenses.colLicense': 'Licence',
};

// --------------------------------------------------------------- Italiano
const it: LegalDict = {
  'privacy.h1': 'Informativa sulla privacy',
  'privacy.updated': 'Ultimo aggiornamento: 29 luglio 2026',

  'privacy.s1.h': '1. Titolare del trattamento',
  'privacy.s1.p': 'Il titolare del trattamento dei dati su questo sito web è:',

  'privacy.s2.h': '2. Principio fondamentale: il trattamento avviene sul suo dispositivo',
  'privacy.s2.p':
    'LocalSpeech è un’applicazione lato client. Non esiste <strong>alcun server applicativo</strong> che riceva o memorizzi i suoi contenuti di apprendimento. Il riconoscimento vocale, il modello linguistico di IA e la sintesi vocale vengono eseguiti interamente nel suo browser, sul suo dispositivo. In particolare, i suoi input vocali (microfono), le cronologie delle conversazioni, i documenti che carica e i personaggi che crea non vengono in nessun momento trasmessi a noi o a terzi. Una trasmissione su internet avviene solo nei casi descritti ai punti da 4 a 6.',

  'privacy.s3.h': '3. Accesso al microfono',
  'privacy.s3.p':
    'Per l’allenamento alla conversazione l’app necessita dell’accesso al suo microfono. L’accesso avviene solo dopo la sua autorizzazione esplicita tramite il browser e può essere revocato in qualsiasi momento. La voce registrata viene elaborata esclusivamente in locale e in modo transitorio (conversione in testo tramite il modello Whisper eseguito localmente) e non viene né memorizzata né trasmessa.<br /><em>Base giuridica:</em> art. 6, par. 1, lett. b GDPR ovvero il suo consenso prestato tramite il browser (art. 6, par. 1, lett. a GDPR).',

  'privacy.s4.h': '4. Erogazione del sito web e file di log del server',
  'privacy.s4.p':
    'Quando si accede al sito web, il fornitore di hosting raccoglie automaticamente le informazioni trasmesse dal suo browser (file di log del server): indirizzo IP, data e ora dell’accesso, file richiesto, volume di dati trasferiti, URL di provenienza, tipo di browser e sistema operativo. Ciò è tecnicamente necessario per erogare il sito web e per garantirne stabilità e sicurezza.',
  'privacy.s4.list':
    '<li><strong>Fornitore di hosting / responsabile del trattamento:</strong> Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA (per i clienti dell’UE con il coinvolgimento contrattuale di Cloudflare Germany GmbH, Rosental 7, 80331 Monaco di Baviera, Germania). Con il fornitore è in essere un accordo sul trattamento dei dati ai sensi dell’art. 28 GDPR (Cloudflare Data Processing Addendum).</li>' +
    '<li><strong>Base giuridica:</strong> art. 6, par. 1, lett. f GDPR (legittimo interesse a un’erogazione sicura, rapida e resiliente del sito web tramite una rete di distribuzione dei contenuti).</li>' +
    '<li><strong>Periodo di conservazione:</strong> Cloudflare conserva i dati di connessione soltanto per il tempo necessario alle finalità di sicurezza e di esercizio (tra cui il rilevamento di attacchi e abusi); Cloudflare non indica un termine forfettario fisso. Maggiori informazioni nell’informativa sulla privacy di Cloudflare (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>).</li>' +
    '<li><strong>Trasferimento verso paesi terzi:</strong> Poiché Cloudflare opera come rete globale, non è escluso un trattamento dei dati di connessione anche al di fuori dell’UE/SEE (in particolare negli USA). Come garanzia valgono le clausole contrattuali tipo dell’UE concordate nell’accordo sul trattamento, ai sensi dell’art. 46, par. 2, lett. c GDPR.</li>',

  'privacy.s5.h': '5. Download dei modelli di IA',
  'privacy.s5.p1':
    'Affinché l’app funzioni offline, il suo browser scarica <strong>una sola volta</strong> i file dei modelli di IA necessari (modello linguistico, riconoscimento vocale, sintesi vocale) e li memorizza localmente (vedi punto 7). Attualmente questi file vengono prelevati direttamente dai server di <strong>Hugging Face</strong> (unitamente alla rete di distribuzione dei contenuti utilizzata):',
  'privacy.s5.p2':
    'Durante il download il suo browser trasmette a Hugging Face i dati di connessione tecnicamente necessari, in particolare il suo <strong>indirizzo IP</strong> nonché informazioni sul browser e sul file richiesto. Si applica inoltre l’informativa sulla privacy di Hugging Face (<a href="https://huggingface.co/privacy" target="_blank" rel="noopener">huggingface.co/privacy</a>).',
  'privacy.s5.list':
    '<li><strong>Base giuridica:</strong> art. 6, par. 1, lett. f GDPR (legittimo interesse a offrire l’applicazione eseguita localmente senza una propria infrastruttura server).</li>' +
    '<li><strong>Trasferimento verso paesi terzi:</strong> Il trasferimento avviene verso gli USA. Come garanzia valgono le clausole contrattuali tipo utilizzate dal fornitore ai sensi dell’art. 46, par. 2, lett. c GDPR ovvero una certificazione nell’ambito dell’EU-U.S. Data Privacy Framework. Non può essere escluso del tutto un accesso da parte delle autorità statunitensi.</li>' +
    '<li><strong>Nota:</strong> Il download avviene solo alla prima configurazione o in caso di cambio di modello. Successivamente l’app utilizza la copia locale e non necessita più di internet.</li>',

  'privacy.s6.h': '6. Gestione dei pagamenti per il sostegno volontario (Stripe)',
  'privacy.s6.p':
    'Nella sezione «Sostieni» può sostenere volontariamente il progetto con un importo in denaro. Il pagamento è gestito dal prestatore di servizi di pagamento Stripe (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublino, Irlanda). Solo quando avvia attivamente la procedura di pagamento la libreria di Stripe viene caricata e viene incorporato un modulo di pagamento; in quel momento i dati necessari al pagamento (ad es. dati del mezzo di pagamento o della carta, importo, indirizzo IP e informazioni sul browser) vengono trasmessi direttamente a Stripe ed elaborati presso di essa. Noi non riceviamo né memorizziamo dati di pagamento o di carta completi. Si applica inoltre l’informativa sulla privacy di Stripe (<a href="https://stripe.com/it/privacy" target="_blank" rel="noopener">stripe.com/it/privacy</a>). Un trasferimento verso paesi terzi può avvenire sulla base delle clausole contrattuali tipo dell’UE.<br /><em>Base giuridica:</em> art. 6, par. 1, lett. b GDPR (esecuzione del pagamento da lei disposto) nonché art. 6, par. 1, lett. f GDPR (gestione sicura e a basso rischio di frode).',

  'privacy.s61.h': '6.1 La nostra funzione server all’avvio del pagamento',
  'privacy.s61.p1':
    'Da parte nostra non richiediamo <strong>alcun dato personale</strong> per il sostegno: né nome, né indirizzo e-mail, né indirizzo postale. La nostra funzione server riceve esclusivamente l’importo desiderato e con esso crea un’operazione di pagamento presso Stripe. Non creiamo account utente né elenchi di indirizzi; non ha luogo alcun utilizzo per newsletter, pubblicità o altre forme di contatto.',
  'privacy.s61.p2':
    '<strong>Protezione dagli abusi:</strong> All’avvio di un pagamento il suo browser richiama una funzione server da noi gestita. In tale occasione il suo indirizzo IP viene mantenuto in memoria per un massimo di 10 minuti, al fine di limitare il numero di richieste per mittente. Non avviene alcuna conservazione permanente, alcuna registrazione né alcun collegamento con altri dati.<br /><em>Base giuridica:</em> art. 6, par. 1, lett. f GDPR (legittimo interesse a prevenire un utilizzo abusivo).',
  'privacy.s61.p3':
    '<em>Nota:</em> A seconda del mezzo di pagamento scelto, il modulo di pagamento Stripe incorporato può richiedere dati propri (ad esempio nome o indirizzo e-mail, qualora il prestatore di servizi di pagamento lo richieda obbligatoriamente). Tali inserimenti avvengono direttamente nei confronti di Stripe; noi non li riceviamo. La conservazione avviene presso di essa nell’ambito dei termini di pagamento e conservazione (obblighi legali di conservazione in materia commerciale e fiscale fino a dieci anni).',

  'privacy.s7.h': '7. Memorizzazione locale sul suo dispositivo',
  'privacy.s7.p':
    'L’app memorizza i dati esclusivamente in locale nel suo browser: le sue impostazioni (ad es. lingue scelte, selezione del modello, voce, livello, personaggio personalizzato ed eventuale testo di un documento caricato) nel <code>localStorage</code>, nonché i modelli di IA scaricati nella memoria del browser (Origin Private File System / cache), affinché l’app si avvii rapidamente e funzioni offline. Questa memorizzazione è strettamente necessaria per il funzionamento dell’applicazione da lei richiesto; nessuna informazione viene trasmessa a noi o a terzi e non vengono impostati cookie a scopo di analisi o pubblicità.<br /><em>Base giuridica:</em> § 25, comma 2, n. 2 TDDDG in combinato disposto con l’art. 6, par. 1, lett. f GDPR. Può eliminare questi dati in qualsiasi momento tramite le impostazioni del suo browser o tramite «Elimina tutti i dati e i modelli» nell’app.',

  'privacy.s7.p2':
    '<strong>Service worker:</strong> Affinché l&rsquo;app si avvii anche senza connessione a internet, questo sito installa un piccolo script in background nel suo browser (il cosiddetto service worker, file <code>sw.js</code>). Esso memorizza i file di programma della pagina nella cache del suo browser e risponde alle chiamate successive a partire da tale copia. Tratta esclusivamente le richieste rivolte a questo stesso sito, non trasmette nulla a noi né a terzi e non analizza il suo comportamento. Può rimuoverlo in qualsiasi momento dalle impostazioni dei siti del suo browser.<br /><em>Base giuridica:</em> § 25 comma 2 n. 2 TDDDG in combinato disposto con l&rsquo;art. 6 par. 1 lett. f GDPR.',
  'privacy.s8.h': '8. Modalità Leggende e personaggi personalizzati',
  'privacy.s8.p':
    'Nella modalità Leggende può conversare con ricostruzioni realizzate dall’IA di personalità note e defunte, oppure creare personaggi propri. Si tratta di simulazioni fittizie generate artificialmente — non delle persone reali né di citazioni autentiche. L’intero trattamento (indicazione del ruolo, i suoi input, le risposte) avviene interamente in locale; nessun contenuto viene trasmesso.',

  'privacy.s9.h': '9. Nessun tracciamento, nessun cookie pubblicitario',
  'privacy.s9.p':
    'Da parte nostra non impostiamo cookie di analisi, tracciamento o pubblicitari, non effettuiamo rilevazioni di audience e non creiamo profili utente. Non ha luogo alcun processo decisionale automatizzato, compresa la profilazione ai sensi dell’art. 22 GDPR.',
  'privacy.s9.p2':
    '<strong>Cookie tecnicamente necessari del nostro fornitore di hosting:</strong> Per respingere attacchi e accessi automatizzati, Cloudflare (vedi punto 4) può impostare propri cookie di sicurezza, come <code>__cf_bm</code> per il rilevamento dei bot (durata di circa 30 minuti) oppure <code>cf_clearance</code> dopo il superamento di un controllo di sicurezza. Tali cookie servono esclusivamente alla sicurezza e al funzionamento senza disturbi del sito web; non vengono analizzati a fini statistici o pubblicitari e non ci consentono di riconoscerla.<br /><em>Base giuridica:</em> § 25, comma 2, n. 2 TDDDG (strettamente necessari per fornire il servizio da lei richiesto) in combinato disposto con l’art. 6, par. 1, lett. f GDPR. Per questo non è necessario alcun consenso, motivo per cui questo sito web non mostra alcun banner sui cookie.',

  'privacy.s9.p3':
    '<strong>Cookie del prestatore di servizi di pagamento:</strong> Stripe.js viene caricato solo nel momento in cui lei avvia attivamente la procedura di pagamento. In tale occasione Stripe imposta propri cookie tecnicamente necessari o voci di memorizzazione equiparabili su questo dominio, al fine di associare un pagamento alla sua sessione e di rilevare frodi; a questo scopo Stripe può inoltre caricare il servizio hCaptcha. Tali voci servono esclusivamente all&rsquo;esecuzione e alla messa in sicurezza del pagamento da lei disposto e non a finalità di analisi o pubblicità. Finché non avvia la procedura di pagamento, Stripe.js non viene caricato e di conseguenza non vengono impostati tali cookie. L&rsquo;elenco aggiornato è disponibile nella cookie policy di Stripe (<a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener">stripe.com/cookies-policy/legal</a>).<br /><em>Base giuridica:</em> § 25 comma 2 n. 2 TDDDG (strettamente necessario per il servizio richiesto) in combinato disposto con l&rsquo;art. 6 par. 1 lett. b e f GDPR.',
  'privacy.s10.h': '10. Contatti',
  'privacy.s10.p':
    'Se ci contatta via e-mail, trattiamo i dati da lei comunicati al fine di gestire la sua richiesta.<br /><em>Base giuridica:</em> art. 6, par. 1, lett. f ovvero lett. b GDPR. I dati vengono cancellati non appena non sono più necessari al raggiungimento di tale finalità, fatti salvi gli obblighi legali di conservazione.',

  'privacy.s11.h': '11. I suoi diritti',
  'privacy.s11.p':
    'Ha diritto di accesso (art. 15 GDPR), rettifica (art. 16), cancellazione (art. 17), limitazione del trattamento (art. 18), portabilità dei dati (art. 20) nonché diritto di opposizione ai trattamenti fondati sull’art. 6, par. 1, lett. f GDPR (art. 21). Può revocare in qualsiasi momento un consenso prestato, con effetto per il futuro (art. 7, par. 3 GDPR).',

  'privacy.s12.h': '12. Diritto di reclamo all’autorità di controllo',
  'privacy.s12.p':
    'Le spetta il diritto di proporre reclamo a un’autorità di controllo per la protezione dei dati. L’autorità competente per il titolare è:',

  'privacy.s13.h': '13. Attualità',
  'privacy.s13.p':
    'Adeguiamo la presente informativa sulla privacy quando il trattamento dei dati cambia (ad esempio in caso di passaggio a un hosting proprio per la distribuzione dei modelli). Vale di volta in volta la versione qui pubblicata.',

  'terms.h1': 'Condizioni d’uso',
  'terms.updated': 'Ultimo aggiornamento: 29 luglio 2026',
  'terms.lead':
    'Le presenti condizioni disciplinano l’utilizzo di LocalSpeech — uno strumento gratuito per l’apprendimento delle lingue che viene eseguito interamente sul suo dispositivo. Utilizzando l’app lei accetta queste condizioni. La presente è una traduzione di cortesia; in caso di discrepanza prevale la versione tedesca delle presenti condizioni.',

  'terms.s1.h': 'Oggetto',
  'terms.s1.p':
    'LocalSpeech è un’applicazione lato client con cui può esercitarsi nelle lingue conversando con un interlocutore basato su IA. Il riconoscimento vocale, il modello di IA e la sintesi vocale vengono eseguiti localmente nel suo browser. Non esistono account utente, né un server applicativo, né alcun trattamento dei suoi contenuti nel cloud.',

  'terms.s2.h': 'Messa a disposizione gratuita',
  'terms.s2.p':
    'L’utilizzo è gratuito. Non sussiste alcun diritto a una disponibilità continua, a una determinata funzione o all’assenza di difetti. L’app viene fornita «così com’è»; possiamo modificare, limitare o sospendere funzioni in qualsiasi momento. I contributi volontari di sostegno (ad es. tramite Stripe) non fondano alcun diritto ulteriore.',

  'terms.s3.h': 'Contenuti generati dall’IA',
  'terms.s3.p':
    'Le risposte dell’interlocutore sono generate automaticamente da un modello di IA e possono risultare oggettivamente errate, incomplete, obsolete o inappropriate. Non riflettono l’opinione del gestore e non costituiscono consulenza legale, medica, finanziaria o altra consulenza professionale. Verifichi autonomamente le informazioni importanti e non si affidi senza controllo agli output dell’IA. L’utilizzo avviene sotto la sua responsabilità.',

  'terms.s4.h': 'Modalità Leggende',
  'terms.s4.p':
    'Le personalità selezionabili sono ricostruzioni realizzate dall’IA, del tutto fittizie, di persone defunte — non le persone reali né citazioni autentiche. I ritratti sono nostre illustrazioni stilizzate. I personaggi da lei creati ricadono sotto la sua responsabilità.',

  'terms.s5.h': 'I suoi obblighi',
  'terms.s5.p':
    'Si impegna a non utilizzare l’app in modo abusivo o lesivo di diritti e a non impiegare i contenuti generati per finalità illecite. È lei l’unico responsabile dei documenti che carica come contesto della conversazione nonché dei personaggi da lei creati; questi vengono trattati esclusivamente in locale.',

  'terms.s6.h': 'Diritti su contenuti, software e modelli',
  'terms.s6.p':
    'Il software di LocalSpeech è distribuito con <strong>licenza GNU General Public License v3.0 o successiva</strong>; il codice sorgente è pubblicamente consultabile. Le presenti condizioni disciplinano esclusivamente l’uso del servizio da noi gestito e non limitano i diritti che la GPL le riconosce sul software. I modelli di IA utilizzati provengono da terzi e sono soggetti alle rispettive condizioni di licenza. Un elenco completo è disponibile nella pagina <a href="#/lizenzen">Licenze</a>. I suoi dati e le sue impostazioni memorizzati localmente restano sul suo dispositivo e le appartengono. I diritti di marchio e di denominazione di terzi — incluso il nome «LocalSpeech» — restano impregiudicati.',

  'terms.s7.h': 'Responsabilità',
  'terms.s7.p':
    'Il gestore non si assume alcuna responsabilità per i contenuti generati dall’IA. Poiché LocalSpeech viene messo a disposizione gratuitamente, il gestore risponde — nei limiti consentiti dalla legge — solo per dolo e colpa grave. Resta impregiudicata la responsabilità per danni derivanti dalla lesione della vita, dell’integrità fisica o della salute nonché quella prevista da disposizioni di legge inderogabili (ad es. la legge tedesca sulla responsabilità da prodotto).',

  'terms.s8.h': 'Modifiche delle presenti condizioni',
  'terms.s8.p':
    'Possiamo adeguare le presenti condizioni d’uso qualora l’app o il quadro giuridico cambino. Vale di volta in volta la versione qui pubblicata.',

  'terms.s9.h': 'Legge applicabile e disposizioni finali',
  'terms.s9.p':
    'Si applica il diritto della Repubblica Federale di Germania, con esclusione della Convenzione delle Nazioni Unite sui contratti di vendita internazionale di merci; restano impregiudicate le disposizioni inderogabili a tutela dei consumatori del suo Stato di residenza. Qualora una disposizione risultasse inefficace, resta impregiudicata l’efficacia delle restanti disposizioni.',

  // --------------------------------------------------------------- Licenze
  'licenses.h1': 'Licenze',
  'licenses.kicker': 'Codice aperto',
  'licenses.lead':
    'LocalSpeech è software libero. In questa pagina trova il codice sorgente, la licenza dell’applicazione stessa e tutti i componenti e modelli di IA utilizzati con le rispettive licenze.',
  'licenses.app.h': 'LocalSpeech stesso',
  'licenses.app.p':
    'LocalSpeech è distribuito con <strong>licenza GNU General Public License v3.0 o successiva</strong>. Può usare, condividere e modificare il software; se lo distribuisce, deve farlo con la stessa licenza e includere il codice sorgente. Copyright © 2026 Chris Velten. Il nome «LocalSpeech» e il logo sono esclusi; i diritti sul marchio e sul nome restano riservati.',
  'licenses.app.source': 'Vedi il codice sorgente su GitHub',
  'licenses.app.license': 'Leggi il testo della licenza (GPL-3.0)',
  'licenses.pkg.h': 'Librerie utilizzate',
  'licenses.pkg.p':
    'Questo elenco viene generato automaticamente a ogni build dai pacchetti effettivamente in uso e non può quindi diventare obsoleto.',
  'licenses.model.h': 'Modelli di IA',
  'licenses.model.p':
    'I modelli non vengono distribuiti da noi: il suo browser li scarica direttamente da Hugging Face. Si applicano le condizioni dei rispettivi fornitori.',
  'licenses.full': 'Testi completi delle licenze di tutti i componenti',
  'licenses.count': '{n} pacchetti',
  'licenses.colVersion': 'Versione',
  'licenses.colLicense': 'Licenza',
};

// --------------------------------------------------------------- Português
const pt: LegalDict = {
  'privacy.h1': 'Política de Privacidade',
  'privacy.updated': 'Última atualização: 29 de julho de 2026',

  'privacy.s1.h': '1. Responsável pelo tratamento',
  'privacy.s1.p': 'O responsável pelo tratamento de dados neste sítio web é:',

  'privacy.s2.h': '2. Princípio fundamental: o tratamento decorre no seu dispositivo',
  'privacy.s2.p':
    'O LocalSpeech é uma aplicação do lado do cliente. Não existe <strong>qualquer servidor aplicacional</strong> que receba ou armazene os seus conteúdos de aprendizagem. O reconhecimento de voz, o modelo de linguagem de IA e a síntese de voz são executados integralmente no seu navegador, no seu próprio dispositivo. Em particular, as suas entradas de voz (microfone), os históricos de conversa, os documentos que carrega e as personagens que cria nunca são transmitidos a nós nem a terceiros. Só há transmissão pela internet nos casos descritos nos pontos 4 a 6.',

  'privacy.s3.h': '3. Acesso ao microfone',
  'privacy.s3.p':
    'Para o treino de conversação, a aplicação necessita de aceder ao seu microfone. O acesso só ocorre após a sua autorização expressa através do navegador e pode ser revogado a qualquer momento. A voz gravada é tratada exclusivamente de forma local e transitória (conversão em texto pelo modelo Whisper executado localmente) e não é armazenada nem transmitida.<br /><em>Fundamento jurídico:</em> art. 6.º, n.º 1, al. b) do RGPD ou o seu consentimento dado através do navegador (art. 6.º, n.º 1, al. a) do RGPD).',

  'privacy.s4.h': '4. Disponibilização do sítio web e ficheiros de registo do servidor',
  'privacy.s4.p':
    'Ao aceder ao sítio web, o fornecedor de alojamento recolhe automaticamente as informações transmitidas pelo seu navegador (ficheiros de registo do servidor): endereço IP, data e hora do acesso, ficheiro solicitado, volume de dados transferidos, URL de referência, tipo de navegador e sistema operativo. Tal é tecnicamente necessário para disponibilizar o sítio web e assegurar a sua estabilidade e segurança.',
  'privacy.s4.list':
    '<li><strong>Fornecedor de alojamento / subcontratante:</strong> Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, EUA (para clientes da UE, com intervenção contratual da Cloudflare Germany GmbH, Rosental 7, 80331 Munique, Alemanha). Foi celebrado com o fornecedor um contrato de subcontratação nos termos do art. 28.º do RGPD (Cloudflare Data Processing Addendum).</li>' +
    '<li><strong>Fundamento jurídico:</strong> art. 6.º, n.º 1, al. f) do RGPD (interesse legítimo numa disponibilização segura, rápida e resiliente do sítio web através de uma rede de distribuição de conteúdos).</li>' +
    '<li><strong>Prazo de conservação:</strong> A Cloudflare conserva os dados de ligação apenas durante o tempo necessário para fins de segurança e de funcionamento (nomeadamente a deteção de ataques e utilizações abusivas); a Cloudflare não indica um prazo fixo e generalizado. Mais informações na política de privacidade da Cloudflare (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>).</li>' +
    '<li><strong>Transferência para países terceiros:</strong> Uma vez que a Cloudflare é operada como uma rede global, não se exclui o tratamento de dados de ligação fora da UE/EEE (em especial nos EUA). Servem de garantia as cláusulas contratuais-tipo da UE acordadas no contrato de subcontratação, nos termos do art. 46.º, n.º 2, al. c) do RGPD.</li>',

  'privacy.s5.h': '5. Descarregamento dos modelos de IA',
  'privacy.s5.p1':
    'Para que a aplicação funcione offline, o seu navegador descarrega <strong>uma única vez</strong> os ficheiros dos modelos de IA necessários (modelo de linguagem, reconhecimento de voz, síntese de voz) e guarda-os localmente (ver ponto 7). Atualmente, estes ficheiros são obtidos diretamente dos servidores da <strong>Hugging Face</strong> (bem como da rede de distribuição de conteúdos utilizada):',
  'privacy.s5.p2':
    'Durante o descarregamento, o seu navegador transmite à Hugging Face os dados de ligação tecnicamente necessários, em especial o seu <strong>endereço IP</strong>, bem como informações sobre o navegador e o ficheiro solicitado. Aplica-se adicionalmente a política de privacidade da Hugging Face (<a href="https://huggingface.co/privacy" target="_blank" rel="noopener">huggingface.co/privacy</a>).',
  'privacy.s5.list':
    '<li><strong>Fundamento jurídico:</strong> art. 6.º, n.º 1, al. f) do RGPD (interesse legítimo em disponibilizar a aplicação de execução local sem infraestrutura de servidor própria).</li>' +
    '<li><strong>Transferência para países terceiros:</strong> A transferência é efetuada para os EUA. Servem de garantia as cláusulas contratuais-tipo utilizadas pelo fornecedor nos termos do art. 46.º, n.º 2, al. c) do RGPD ou uma certificação ao abrigo do Quadro de Privacidade de Dados UE-EUA. Não é possível excluir totalmente o acesso por parte das autoridades norte-americanas.</li>' +
    '<li><strong>Nota:</strong> O descarregamento só ocorre na configuração inicial ou aquando de uma mudança de modelo. Depois disso, a aplicação utiliza a cópia local e deixa de necessitar de internet.</li>',

  'privacy.s6.h': '6. Processamento de pagamentos no apoio voluntário (Stripe)',
  'privacy.s6.p':
    'Na secção «Apoiar» pode apoiar voluntariamente o projeto com uma quantia em dinheiro. O pagamento é processado pelo prestador de serviços de pagamento Stripe (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublim, Irlanda). Só quando inicia ativamente o processo de pagamento é que a biblioteca da Stripe é carregada e um formulário de pagamento é incorporado; nesse momento, os dados necessários ao pagamento (p. ex. dados do meio de pagamento ou do cartão, montante, endereço IP e informações do navegador) são transmitidos diretamente à Stripe e aí tratados. Não recebemos nem armazenamos dados completos de pagamento ou de cartão. Aplica-se adicionalmente a política de privacidade da Stripe (<a href="https://stripe.com/pt/privacy" target="_blank" rel="noopener">stripe.com/pt/privacy</a>). Pode ocorrer uma transferência para países terceiros com base nas cláusulas contratuais-tipo da UE.<br /><em>Fundamento jurídico:</em> art. 6.º, n.º 1, al. b) do RGPD (execução do pagamento por si determinado) e art. 6.º, n.º 1, al. f) do RGPD (processamento seguro e com baixo risco de fraude).',

  'privacy.s61.h': '6.1 A nossa função de servidor no início do pagamento',
  'privacy.s61.p1':
    'Da nossa parte não solicitamos <strong>quaisquer dados pessoais</strong> para o apoio — nem nome, nem endereço de correio eletrónico, nem morada. A nossa função de servidor recebe apenas o montante pretendido e cria com ele uma operação de pagamento junto da Stripe. Não criamos contas de utilizador nem listas de endereços; não há qualquer utilização para newsletters, publicidade ou outro tipo de contacto.',
  'privacy.s61.p2':
    '<strong>Proteção contra utilização abusiva:</strong> Ao iniciar um pagamento, o seu navegador invoca uma função de servidor por nós operada. Nesse processo, o seu endereço IP é mantido em memória durante um máximo de 10 minutos, a fim de limitar o número de pedidos por remetente. Não há conservação permanente, registo nem associação a quaisquer outros dados.<br /><em>Fundamento jurídico:</em> art. 6.º, n.º 1, al. f) do RGPD (interesse legítimo na prevenção de uma utilização abusiva).',
  'privacy.s61.p3':
    '<em>Nota:</em> Consoante o meio de pagamento escolhido, o formulário de pagamento da Stripe incorporado pode solicitar dados próprios (por exemplo, nome ou endereço de correio eletrónico, quando o prestador de serviços de pagamento o exija obrigatoriamente). Estas introduções são feitas diretamente perante a Stripe; nós não as recebemos. A conservação ocorre aí no âmbito dos prazos de pagamento e de conservação (obrigações legais comerciais e fiscais de conservação até dez anos).',

  'privacy.s7.h': '7. Armazenamento local no seu dispositivo',
  'privacy.s7.p':
    'A aplicação armazena dados exclusivamente de forma local no seu navegador: as suas definições (p. ex. idiomas escolhidos, seleção de modelo, voz, nível, personagem própria e, se aplicável, o texto de um documento carregado) no <code>localStorage</code>, bem como os modelos de IA descarregados no armazenamento do navegador (Origin Private File System / cache), para que a aplicação arranque rapidamente e funcione offline. Este armazenamento é estritamente necessário ao funcionamento da aplicação por si pretendido; não é transmitida qualquer informação a nós ou a terceiros e não são definidos cookies para fins de análise ou publicidade.<br /><em>Fundamento jurídico:</em> § 25.º, n.º 2, ponto 2 do TDDDG em conjugação com o art. 6.º, n.º 1, al. f) do RGPD. Pode eliminar estes dados a qualquer momento através das definições do seu navegador ou de «Eliminar todos os dados e modelos» na aplicação.',

  'privacy.s7.p2':
    '<strong>Service worker:</strong> Para que a aplicação também inicie sem ligação à internet, este sítio instala um pequeno script em segundo plano no seu navegador (o chamado service worker, ficheiro <code>sw.js</code>). Guarda os ficheiros de programa da página na cache do seu navegador e responde a chamadas posteriores a partir dessa cópia. Trata exclusivamente pedidos dirigidos a este próprio sítio, não transmite nada a nós nem a terceiros e não avalia o seu comportamento. Pode removê-lo em qualquer momento através das definições de sítios do seu navegador.<br /><em>Base jurídica:</em> § 25 n.º 2 al. 2 TDDDG em conjugação com o art. 6.º n.º 1 alínea f RGPD.',
  'privacy.s8.h': '8. Modo Lendas e personagens próprias',
  'privacy.s8.p':
    'No modo Lendas pode conversar com recriações por IA de personalidades conhecidas já falecidas, ou criar personagens próprias. Trata-se de simulações fictícias geradas artificialmente — não das pessoas reais nem de citações autênticas. Todo o tratamento (indicação do papel, as suas entradas, as respostas) decorre integralmente em local; nenhum conteúdo é transmitido.',

  'privacy.s9.h': '9. Sem rastreio, sem cookies publicitários',
  'privacy.s9.p':
    'Da nossa parte não instalamos cookies de análise, de rastreio ou publicitários, não realizamos medição de audiências nem criamos perfis de utilizador. Não há qualquer decisão automatizada, incluindo a definição de perfis na aceção do art. 22.º do RGPD.',
  'privacy.s9.p2':
    '<strong>Cookies tecnicamente necessários do nosso fornecedor de alojamento:</strong> Para repelir ataques e acessos automatizados, a Cloudflare (ver ponto 4) pode instalar cookies de segurança próprios, como <code>__cf_bm</code> para deteção de bots (com uma duração de cerca de 30 minutos) ou <code>cf_clearance</code> após uma verificação de segurança bem-sucedida. Estes cookies servem exclusivamente a segurança e o funcionamento sem perturbações do sítio web; não são analisados para fins estatísticos ou publicitários e não nos permitem reconhecê-lo.<br /><em>Fundamento jurídico:</em> § 25.º, n.º 2, ponto 2 do TDDDG (estritamente necessários para prestar o serviço por si pretendido) em conjugação com o art. 6.º, n.º 1, al. f) do RGPD. Não é necessário qualquer consentimento para o efeito, razão pela qual este sítio web não apresenta qualquer aviso de cookies.',

  'privacy.s9.p3':
    '<strong>Cookies do prestador de serviços de pagamento:</strong> O Stripe.js só é carregado quando inicia ativamente o processo de pagamento. Nessa altura, o Stripe coloca os seus próprios cookies tecnicamente necessários ou entradas de armazenamento equiparáveis neste domínio, a fim de associar um pagamento à sua sessão e detetar fraudes; para este efeito, o Stripe pode carregar adicionalmente o serviço hCaptcha. Estas entradas servem exclusivamente para processar e proteger o pagamento por si iniciado e não para fins de análise ou publicidade. Enquanto não iniciar o processo de pagamento, o Stripe.js não é carregado e, consequentemente, não são colocados tais cookies. A lista atualizada encontra-se na política de cookies do Stripe (<a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener">stripe.com/cookies-policy/legal</a>).<br /><em>Base jurídica:</em> § 25 n.º 2 al. 2 TDDDG (estritamente necessário para o serviço solicitado) em conjugação com o art. 6.º n.º 1 alíneas b e f RGPD.',
  'privacy.s10.h': '10. Contacto',
  'privacy.s10.p':
    'Se nos contactar por correio eletrónico, tratamos os dados que nos comunicar para dar resposta ao seu pedido.<br /><em>Fundamento jurídico:</em> art. 6.º, n.º 1, al. f) ou al. b) do RGPD. Os dados são eliminados logo que deixem de ser necessários para atingir essa finalidade, sem prejuízo das obrigações legais de conservação.',

  'privacy.s11.h': '11. Os seus direitos',
  'privacy.s11.p':
    'Tem direito de acesso (art. 15.º do RGPD), retificação (art. 16.º), apagamento (art. 17.º), limitação do tratamento (art. 18.º), portabilidade dos dados (art. 20.º), bem como direito de oposição a tratamentos baseados no art. 6.º, n.º 1, al. f) do RGPD (art. 21.º). Pode retirar a qualquer momento um consentimento dado, com efeitos para o futuro (art. 7.º, n.º 3 do RGPD).',

  'privacy.s12.h': '12. Direito de reclamação junto da autoridade de controlo',
  'privacy.s12.p':
    'Assiste-lhe o direito de apresentar reclamação junto de uma autoridade de controlo da proteção de dados. A autoridade competente para o responsável pelo tratamento é:',

  'privacy.s13.h': '13. Atualidade',
  'privacy.s13.p':
    'Adaptamos a presente política de privacidade sempre que o tratamento de dados se altere (por exemplo, em caso de mudança da distribuição dos modelos para alojamento próprio). Aplica-se, em cada momento, a versão aqui publicada.',

  'terms.h1': 'Condições de Utilização',
  'terms.updated': 'Última atualização: 29 de julho de 2026',
  'terms.lead':
    'Estas condições regulam a utilização do LocalSpeech — uma ferramenta gratuita de aprendizagem de línguas que é executada integralmente no seu próprio dispositivo. Ao utilizar a aplicação, aceita estas condições. Esta é uma tradução de cortesia; em caso de divergência, prevalece a versão alemã das presentes condições.',

  'terms.s1.h': 'Objeto',
  'terms.s1.p':
    'O LocalSpeech é uma aplicação do lado do cliente com a qual pode praticar línguas em conversa com um interlocutor de IA. O reconhecimento de voz, o modelo de IA e a síntese de voz são executados localmente no seu navegador. Não existem contas de utilizador, nem servidor aplicacional, nem tratamento dos seus conteúdos na nuvem.',

  'terms.s2.h': 'Disponibilização gratuita',
  'terms.s2.p':
    'A utilização é gratuita. Não existe qualquer direito a disponibilidade permanente, a uma determinada funcionalidade ou à ausência de erros. A aplicação é disponibilizada «tal como está»; podemos alterar, limitar ou descontinuar funcionalidades a qualquer momento. As contribuições voluntárias de apoio (p. ex. através da Stripe) não fundamentam quaisquer direitos adicionais.',

  'terms.s3.h': 'Conteúdos gerados por IA',
  'terms.s3.p':
    'As respostas do interlocutor são geradas automaticamente por um modelo de IA e podem ser factualmente incorretas, incompletas, desatualizadas ou inadequadas. Não refletem a opinião do operador e não constituem aconselhamento jurídico, médico, financeiro ou outro aconselhamento profissional. Verifique autonomamente as informações importantes e não confie sem verificação nos resultados da IA. A utilização é feita sob a sua própria responsabilidade.',

  'terms.s4.h': 'Modo Lendas',
  'terms.s4.p':
    'As personalidades selecionáveis são recriações por IA totalmente fictícias de pessoas falecidas — não as pessoas reais nem citações autênticas. Os retratos são ilustrações estilizadas da nossa autoria. As personagens que criar são da sua responsabilidade.',

  'terms.s5.h': 'As suas obrigações',
  'terms.s5.p':
    'Compromete-se a não utilizar a aplicação de forma abusiva ou lesiva de direitos e a não empregar os conteúdos gerados para fins ilícitos. É o único responsável pelos documentos que carregar como contexto de conversa, bem como pelas personagens que criar; estes são tratados exclusivamente em local.',

  'terms.s6.h': 'Direitos sobre conteúdos, software e modelos',
  'terms.s6.p':
    'O software do LocalSpeech é disponibilizado sob a <strong>Licença Pública Geral GNU v3.0 ou posterior</strong>; o código-fonte é de acesso público. Estas condições regulam apenas a utilização do serviço que operamos e não restringem os direitos que a GPL lhe concede sobre o software. Os modelos de IA utilizados provêm de terceiros e estão sujeitos às respetivas condições de licença. Encontra uma lista completa na página <a href="#/lizenzen">Licenças</a>. Os seus dados e definições armazenados localmente permanecem no seu dispositivo e pertencem-lhe. Os direitos de marca e de denominação de terceiros — incluindo o nome «LocalSpeech» — permanecem inalterados.',

  'terms.s7.h': 'Responsabilidade',
  'terms.s7.p':
    'O operador não assume qualquer responsabilidade pelos conteúdos gerados pela IA. Dado que o LocalSpeech é disponibilizado gratuitamente, o operador responde — na medida em que a lei o permita — apenas por dolo e negligência grosseira. Mantém-se inalterada a responsabilidade por danos decorrentes da lesão da vida, da integridade física ou da saúde, bem como a decorrente de disposições legais imperativas (p. ex. a lei alemã da responsabilidade pelo produto).',

  'terms.s8.h': 'Alterações às presentes condições',
  'terms.s8.p':
    'Podemos adaptar as presentes condições de utilização caso a aplicação ou o enquadramento jurídico se alterem. Aplica-se, em cada momento, a versão aqui publicada.',

  'terms.s9.h': 'Lei aplicável e disposições finais',
  'terms.s9.p':
    'Aplica-se o direito da República Federal da Alemanha, com exclusão da Convenção das Nações Unidas sobre Contratos de Compra e Venda Internacional de Mercadorias; mantêm-se inalteradas as disposições imperativas de proteção do consumidor do seu país de residência. Caso alguma disposição seja inválida, mantém-se inalterada a validade das restantes disposições.',

  // --------------------------------------------------------------- Licenças
  'licenses.h1': 'Licenças',
  'licenses.kicker': 'Código aberto',
  'licenses.lead':
    'O LocalSpeech é software livre. Nesta página encontra o código-fonte, a licença da própria aplicação e todos os componentes e modelos de IA utilizados com as respetivas licenças.',
  'licenses.app.h': 'O próprio LocalSpeech',
  'licenses.app.p':
    'O LocalSpeech é disponibilizado sob a <strong>Licença Pública Geral GNU v3.0 ou posterior</strong>. Pode utilizar, partilhar e modificar o software; se o distribuir, tem de fazê-lo sob a mesma licença e incluir o código-fonte. Copyright © 2026 Chris Velten. O nome «LocalSpeech» e o logótipo estão excluídos; os direitos de marca e de nome permanecem reservados.',
  'licenses.app.source': 'Ver o código-fonte no GitHub',
  'licenses.app.license': 'Ler o texto da licença (GPL-3.0)',
  'licenses.pkg.h': 'Bibliotecas utilizadas',
  'licenses.pkg.p':
    'Esta lista é gerada automaticamente em cada compilação a partir dos pacotes efetivamente utilizados, pelo que não pode ficar desatualizada.',
  'licenses.model.h': 'Modelos de IA',
  'licenses.model.p':
    'Os modelos não são distribuídos por nós: o seu navegador descarrega-os diretamente do Hugging Face. Aplicam-se as condições dos respetivos fornecedores.',
  'licenses.full': 'Textos completos das licenças de todos os componentes',
  'licenses.count': '{n} pacotes',
  'licenses.colVersion': 'Versão',
  'licenses.colLicense': 'Licença',
};

export const LEGAL: Record<UILang, LegalDict> = { de, en, es, fr, it, pt };
