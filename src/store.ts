// Persistente Einstellungen (localStorage) — sorgt dafuer, dass gewaehlte
// Modelle & Praeferenzen beim naechsten Besuch wiedergefunden werden.

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

// Vom Nutzer selbst gebauter Gespraechspartner (Legenden-Modus "Eigener
// Charakter"): Verhalten und Wissen sind frei konfigurierbar.
export interface CustomPersona {
  name: string; // Anzeigename
  role: string; // kurze Rolle/Tagline, z. B. "strenger Mathe-Professor"
  personality: string; // Ton, Temperament, Eigenheiten
  knowledge: string; // Wissen, Hintergrund, Expertise
  accent: string; // Akzentfarbe (Orb-Glow / Chip)
  voice?: string; // Stimme (Kokoro-ID); fehlt = Standardstimme der Lernsprache
}

export interface Settings {
  setupDone: boolean;
  // Gefuehrte App-Tour waehrend des Erst-Downloads: true nach explizitem
  // Fertig/Ueberspringen — ein Abbruch (Tab zu) zeigt sie beim Resume erneut.
  tourSeen: boolean;
  // Muttersprache (bestimmt auch die UI-Sprache); null = noch nicht gewaehlt,
  // wird beim ersten Start aus den Browser-Einstellungen geraten.
  nativeLang: string | null;
  targetLang: string; // Lernsprache
  // Oberflaeche in der Lernsprache statt in der Muttersprache anzeigen —
  // so lernt man auch ueber die Bedienung (Immersion).
  uiInTarget: boolean;
  // Frei waehlbarer Name des KI-Gespraechspartners (null = Sprach-Standard,
  // z. B. "Sam" fuer Englisch).
  tutorName: string | null;
  // Aktive Legenden-Persona (personas.ts) — null = normaler Tutor-Modus,
  // 'custom' = der selbst gebaute Charakter (customPersona).
  persona: string | null;
  // Zuletzt gespeicherter eigener Charakter (bleibt erhalten, auch wenn er
  // gerade nicht aktiv ist).
  customPersona: CustomPersona | null;
  // Vom Nutzer hochgeladene Datei als Gespraechs-Kontext (Text). Wird in den
  // System-Prompt eingebettet, damit die KI darueber sprechen kann.
  contextDoc: { name: string; text: string } | null;
  llmModel: string | null;
  sttModel: string;
  voice: string;
  speed: number;
  level: Level;
  scenario: string;
  // Zuletzt gezogener Eroeffnungs-Aufhaenger (personas.ts `openers` bzw.
  // conversation.ts `Scenario.openers`). Nur dazu da, ihn beim naechsten Start
  // NICHT noch einmal zu ziehen — sonst faengt gefuehlt jedes Gespraech gleich
  // an. Bewusst persistent, weil sich der Effekt gerade ueber Sitzungsgrenzen
  // hinweg bemerkbar macht.
  lastOpener: string | null;
  autoListen: boolean;
  // Allgemeiner KI-/Haftungshinweis nach Onboarding + Modell-Download einmalig
  // bestaetigt (siehe finishHandoff in app.ts).
  disclaimerSeen: boolean;
  // Rechtlicher Vorschalt-Hinweis vor dem Legenden-Modus einmalig bestaetigt.
  legendsDisclaimerSeen: boolean;
  // Einmaliger Hinweis, wie man ein Wort uebersetzt (Doppelklick bzw. Tippen) —
  // erscheint einmal beim ersten Gespraech und danach nie wieder.
  translateHintSeen: boolean;
  // Einmaliges „Schon gewusst?“-Popup zur Korrektur-Geste (eigene Nachricht
  // antippen) — erscheint nach ein paar eigenen Zuegen, danach nie wieder.
  editHintSeen: boolean;
  // Freiwillige Unterstuetzung: true, sobald jemand unterstuetzt (oder es sagt) —
  // schaltet die gelegentliche Erinnerung dauerhaft stumm. Wird auch von der
  // Landing-Sektion (donate.ts) nach erfolgreicher Zahlung gesetzt.
  supporter?: boolean;
  // Zeitstempel der letzten Unterstuetzungs-Erinnerung (fuer den Cooldown).
  donatePromptAt?: number;
}

const KEY = 'localspeech.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  setupDone: false,
  tourSeen: false,
  nativeLang: null,
  targetLang: 'en',
  uiInTarget: false,
  tutorName: null,
  persona: null,
  customPersona: null,
  contextDoc: null,
  llmModel: null,
  sttModel: 'onnx-community/whisper-base',
  voice: 'af_heart',
  speed: 1.0,
  level: 'B1',
  scenario: 'free',
  lastOpener: null,
  autoListen: true,
  disclaimerSeen: false,
  legendsDisclaimerSeen: false,
  translateHintSeen: false,
  editHintSeen: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Speicher voll o.ae. — nicht kritisch */
  }
}

// Browser bitten, den Speicher (Modell-Cache!) nicht automatisch zu raeumen.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* ignorieren */
  }
  return false;
}

export async function storageEstimate(): Promise<{ usedMB: number; quotaMB: number } | null> {
  try {
    const est = await navigator.storage.estimate();
    return {
      usedMB: (est.usage ?? 0) / 1e6,
      quotaMB: (est.quota ?? 0) / 1e6,
    };
  } catch {
    return null;
  }
}
