// Sprachkatalog fuer den internationalen Markt: Muttersprachen (bestimmen
// die UI-Sprache und den Kontext fuer den Tutor) und Lernsprachen (bestimmen
// Whisper-Sprache, Phonemisierung und Kokoro-Stimmen).
//
// Lernsprachen sind durch die TTS begrenzt: Kokoro-82M v1.0 hat eigene,
// nativ trainierte Stimmen nur fuer Englisch, Spanisch, Franzoesisch,
// Italienisch und Portugiesisch (BR). Hindi ist bewusst nicht im Angebot
// (Beta). Deutsch ist vorerst ebenfalls nicht als Lernsprache im Angebot
// (keine eigene Kokoro-Stimme, nur geliehene englische Stimmvektoren per
// espeak-ng-Phonemisierung — Qualitaet erst pruefen). Als Muttersprache
// (NATIVE_LANGS unten) bleibt Deutsch selbstverstaendlich verfuegbar.

export type UILang = 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt';

export interface NativeLang {
  id: string;
  name: string; // Endonym — Name der Sprache in der Sprache selbst
  flag: string;
  ui: UILang; // in welcher Sprache die Oberflaeche angezeigt wird
  english: string; // englischer Name (fuer den System-Prompt)
  flores: string; // FLORES-200-Code fuers NLLB-Uebersetzungsmodell
}

export const NATIVE_LANGS: NativeLang[] = [
  { id: 'en', name: 'English', flag: '🇬🇧', ui: 'en', english: 'English', flores: 'eng_Latn' },
  { id: 'de', name: 'Deutsch', flag: '🇩🇪', ui: 'de', english: 'German', flores: 'deu_Latn' },
  { id: 'es', name: 'Español', flag: '🇪🇸', ui: 'es', english: 'Spanish', flores: 'spa_Latn' },
  { id: 'fr', name: 'Français', flag: '🇫🇷', ui: 'fr', english: 'French', flores: 'fra_Latn' },
  { id: 'it', name: 'Italiano', flag: '🇮🇹', ui: 'it', english: 'Italian', flores: 'ita_Latn' },
  { id: 'pt', name: 'Português', flag: '🇧🇷', ui: 'pt', english: 'Portuguese', flores: 'por_Latn' },
];

export function nativeLangById(id: string): NativeLang {
  return NATIVE_LANGS.find((l) => l.id === id) ?? NATIVE_LANGS[0];
}

export interface VoiceOption {
  id: string;
  name: string; // sprachneutral (Symbole statt uebersetzter Woerter)
}

export interface TargetLang {
  id: string;
  name: string; // Endonym
  flag: string;
  english: string; // englischer Name (System-Prompt)
  ui: UILang; // UI-Sprache im Immersions-Modus (Oberflaeche in der Lernsprache)
  whisper: string; // language-Option fuer Whisper
  espeak: string; // espeak-ng-Code fuer die Phonemisierung (TTS)
  flores: string; // FLORES-200-Code fuers NLLB-Uebersetzungsmodell
  tutor: string; // Name der Tutor-Persona
  voices: VoiceOption[];
  defaultVoice: string;
  preview: string; // Satz fuer die Stimmvorschau (in der Lernsprache)
  warmup: string; // kurzer Warmup-Satz fuer die TTS
}

export const TARGET_LANGS: TargetLang[] = [
  {
    id: 'en',
    name: 'English',
    flag: '🇬🇧',
    english: 'English',
    ui: 'en',
    whisper: 'english',
    espeak: 'en-us',
    flores: 'eng_Latn',
    tutor: 'Sam',
    voices: [
      { id: 'af_heart', name: 'Heart · US ♀' },
      { id: 'af_bella', name: 'Bella · US ♀' },
      { id: 'af_nicole', name: 'Nicole · US ♀' },
      { id: 'am_michael', name: 'Michael · US ♂' },
      { id: 'am_fenrir', name: 'Fenrir · US ♂' },
      { id: 'bf_emma', name: 'Emma · UK ♀' },
      { id: 'bm_george', name: 'George · UK ♂' },
    ],
    defaultVoice: 'af_heart',
    preview: "Hi! I'm {name}, your English conversation partner. Ready when you are.",
    warmup: 'Hi there.',
  },
  {
    id: 'es',
    name: 'Español',
    flag: '🇪🇸',
    english: 'Spanish',
    ui: 'es',
    whisper: 'spanish',
    espeak: 'es',
    flores: 'spa_Latn',
    tutor: 'Sofía',
    voices: [
      { id: 'ef_dora', name: 'Dora ♀' },
      { id: 'em_alex', name: 'Alex ♂' },
      { id: 'em_santa', name: 'Santa ♂' },
    ],
    defaultVoice: 'ef_dora',
    preview: '¡Hola! Soy {name}, tu compañera de conversación en español. ¿Empezamos?',
    warmup: '¡Hola!',
  },
  {
    id: 'fr',
    name: 'Français',
    flag: '🇫🇷',
    english: 'French',
    ui: 'fr',
    whisper: 'french',
    espeak: 'fr-fr',
    flores: 'fra_Latn',
    tutor: 'Chloé',
    voices: [{ id: 'ff_siwis', name: 'Siwis ♀' }],
    defaultVoice: 'ff_siwis',
    preview: "Salut ! Moi c'est {name}, ta partenaire de conversation en français. On commence ?",
    warmup: 'Salut !',
  },
  {
    id: 'it',
    name: 'Italiano',
    flag: '🇮🇹',
    english: 'Italian',
    ui: 'it',
    whisper: 'italian',
    espeak: 'it',
    flores: 'ita_Latn',
    tutor: 'Sara',
    voices: [
      { id: 'if_sara', name: 'Sara ♀' },
      { id: 'im_nicola', name: 'Nicola ♂' },
    ],
    defaultVoice: 'if_sara',
    preview: 'Ciao! Sono {name}, la tua partner di conversazione in italiano. Cominciamo?',
    warmup: 'Ciao!',
  },
  {
    id: 'pt',
    name: 'Português',
    flag: '🇧🇷',
    english: 'Portuguese',
    ui: 'pt',
    whisper: 'portuguese',
    espeak: 'pt-br',
    flores: 'por_Latn',
    tutor: 'Ana',
    voices: [
      { id: 'pf_dora', name: 'Dora ♀' },
      { id: 'pm_alex', name: 'Alex ♂' },
      { id: 'pm_santa', name: 'Santa ♂' },
    ],
    defaultVoice: 'pf_dora',
    preview: 'Oi! Eu sou {name}, sua parceira de conversação em português. Vamos começar?',
    warmup: 'Oi!',
  },
];

export function targetLangById(id: string): TargetLang {
  return TARGET_LANGS.find((l) => l.id === id) ?? TARGET_LANGS[0];
}

// Vorschau-Satz mit eingesetztem Namen des Gespraechspartners. Ohne Name
// (oder leer) faellt es auf den Sprach-Standard ("Sam" etc.) zurueck.
export function previewLine(lang: TargetLang, name?: string): string {
  return lang.preview.replace('{name}', name?.trim() || lang.tutor);
}

// Beste Lernsprache, wenn die Muttersprache mit der bisherigen Wahl
// kollidiert: Englisch — ausser man spricht schon Englisch, dann Spanisch.
export function fallbackTarget(nativeId: string): string {
  return nativeId === 'en' ? 'es' : 'en';
}

// Welche UI-Sprache gilt: normalerweise die Muttersprache, im Immersions-
// Modus (uiInTarget) die Lernsprache — so lernt man auch ueber die Oberflaeche.
export function uiLangFor(nativeId: string | null, targetId: string, uiInTarget: boolean): UILang {
  return uiInTarget ? targetLangById(targetId).ui : nativeLangById(nativeId ?? 'en').ui;
}

// Muttersprache aus den Browser-Einstellungen raten (erster Treffer gewinnt).
export function detectNativeLang(): string {
  const candidates = [...(navigator.languages ?? []), navigator.language ?? 'en'];
  for (const c of candidates) {
    const short = c.toLowerCase().split('-')[0];
    if (NATIVE_LANGS.some((l) => l.id === short)) return short;
  }
  return 'en';
}
