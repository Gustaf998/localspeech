// LocalSpeech — App-Orchestrierung: Setup, Modell-Laden und die
// Gespraechsschleife (Aufnahme -> Whisper -> LLM-Stream -> Kokoro-TTS).
// Wird von main.ts lazy geladen, sobald der Nutzer die App oeffnet.

import {
  loadSettings,
  saveSettings,
  requestPersistentStorage,
  storageEstimate,
  type Settings,
} from './store';
import {
  LLM_OPTIONS,
  STT_OPTIONS,
  TTS_SIZE_MB,
  TTS_SIZE_WEBGPU_MB,
  TRANSLATE_MODEL_ID,
  PHONEME_MODEL_ID,
  llmOptionForId,
  type LLMOption,
} from './catalog';
import { startTour, type TourHandle, type TourStep } from './tour';
import {
  NATIVE_LANGS,
  TARGET_LANGS,
  targetLangById,
  nativeLangById,
  previewLine,
  fallbackTarget,
  detectNativeLang,
  uiLangFor,
  type TargetLang,
  type UILang,
} from './languages';
import { t, tList, setUILang, applyI18n } from './i18n';
import { detectHardware, describeHardware, llmOptionsForTier, tierLabel, isWeakDevice, type HardwareInfo } from './hardware';
import {
  SCENARIOS,
  LEVELS,
  buildSystemPrompt,
  buildDocumentPreamble,
  buildTurnAnchor,
  estimateTokens,
  newConversationSeed,
  buildKickoffPrompt,
  splitIncremental,
  sanitizeForSpeech,
  containsUnsafeContent,
  safeRedirectLine,
} from './conversation';
import { LLMEngine } from './engines/llm';
import { STTEngine } from './engines/stt';
import { TTSEngine } from './engines/tts';
import { TranslateEngine } from './engines/translate';
import { PhonemeEngine } from './engines/phoneme';
import { splitWords, scorePronunciation, type PronunciationResult } from './pronunciation';
import { Recorder } from './audio/recorder';
import { SpeechPlayer } from './audio/player';
import { OrbGL } from './ui/orb';
import { DotGrid } from './ui/dots';
import { personaById, PERSONAS, NATIVES, personaVoice, type Persona } from './personas';
import { AvatarStage, portraitSVG, type AvatarState } from './ui/avatar';
import { SUPPORT_ENABLED, hideSupportUI } from './support-config';

// --------------------------------------------------------------- Utilities

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Element fehlt: ${sel}`);
  return el;
};

function toast(msg: string, isError = false, ms?: number) {
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms ?? (isError ? 7000 : 4000));
}

// Ist die Haupt-Eingabe Touch (Handy/Tablet)? Bestimmt die Uebersetzungs-Geste
// (Tippen statt Doppelklick) und den passenden Hinweistext.
const coarsePointer = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;
const translateHintKey = (): string => (coarsePointer() ? 'translate.hintTouch' : 'translate.hintClick');

function fmtGB(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

// ------------------------------------------------------------------ State

const settings: Settings = loadSettings();
let hw: HardwareInfo | null = null;

// Aktuelle Lernsprache (Whisper-Sprache, espeak-Code, Stimmen, Tutor-Name).
const target = (): TargetLang => targetLangById(settings.targetLang);
const ttsLang = () => ({ espeak: target().espeak, warmup: target().warmup });
// Aktive Legenden-Persona (null = normaler Tutor-Modus oder eigener Charakter).
const activePersona = (): Persona | null => personaById(settings.persona);
// Ist der selbst gebaute Charakter aktiv?
const customActive = (): boolean => settings.persona === 'custom' && !!settings.customPersona;
// Name des Gespraechspartners: eigener Charakter > Persona > Wunschname > Standard.
const tutorName = (): string =>
  (customActive() ? settings.customPersona!.name.trim() : '') ||
  activePersona()?.short ||
  settings.tutorName?.trim() ||
  target().tutor;
// Stimme fuer die Sprachausgabe: Persona-Stimme gewinnt, sonst Einstellung.
const currentVoice = (): string => {
  if (customActive()) return settings.customPersona!.voice || settings.voice;
  const p = activePersona();
  return p ? personaVoice(p, settings.targetLang, settings.voice) : settings.voice;
};
// Aktuelle UI-Sprache neu setzen und anwenden (beachtet den Immersions-Modus).
function applyUILang() {
  setUILang(uiLangFor(settings.nativeLang, settings.targetLang, settings.uiInTarget));
  applyI18n();
}

const llm = new LLMEngine();
const stt = new STTEngine();
const tts = new TTSEngine();
// Dediziertes Uebersetzungsmodell (NLLB-200, s. catalog.ts) statt des
// Chat-LLM — laedt lazy beim ersten Uebersetzungswunsch (Wort-Popover oder
// Ganztext-Knopf), nicht Teil des Pflicht-Setups.
const translator = new TranslateEngine();
// Phonem-Erkennung fuer die Aussprache-Uebung — laedt lazy beim ersten
// Shadowing-Versuch (grosser, optionaler Download), s. ensurePhonemeReady().
const phoneme = new PhonemeEngine();
const recorder = new Recorder();
const player = new SpeechPlayer();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
}
let history: ChatMessage[] = [];

type OrbState = 'loading' | 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
let orbState: OrbState = 'loading';
let generating = false;

// Waehrend das LLM antwortet, ist Senden gesperrt — zwei ueberlappende
// Anfragen bringen die Engine aus dem Tritt (keine Antwort mehr).
function setGenerating(on: boolean) {
  generating = on;
  refreshComposerLock();
}

// Wird die Antwort noch gesprochen (TTS-Queue voll oder Wiedergabe laeuft)?
function isSpeaking(): boolean {
  return speechPumpActive || speechQueue.length > 0 || player.isPlaying;
}

// Ist gerade eine Antwort in Arbeit (wird generiert oder noch gesprochen)?
// Dann darf kein neuer Prompt abgeschickt werden.
function isBusy(): boolean {
  return generating || isSpeaking();
}

// Sende-Knopf sperren, solange eine Antwort generiert oder gesprochen wird.
function refreshComposerLock() {
  const send = document.querySelector<HTMLButtonElement>('.send-btn');
  if (send) send.disabled = isBusy();
}
let genAbort = { aborted: false };
// Zaehler fuer das laufende Gespraech: jeder Start (launchConversation) zaehlt
// hoch. Ein Zug, der zu einer aelteren Epoche gehoert, darf weder eine Blase in
// den frisch geleerten Chat haengen noch etwas sprechen — sonst mischt sich die
// letzte Sitzung in die erste Nachricht der neuen.
let convEpoch = 0;
let modelsReady = false;
// Audio darf erst nach einer Nutzer-Geste starten (Autoplay-Policy) — darum
// beginnt das Gespraech erst mit dem ersten Klick auf das Mikro.
let conversationStarted = false;
let activeTurn: Promise<void> | null = null;

// TTS-Pipeline: Saetze werden waehrend des LLM-Streams generiert & abgespielt.
let speechEpoch = 0;
const speechQueue: string[] = [];
let speechPumpActive = false;

// ------------------------------------------------------------- Orb-Zustand

const orbEl = () => $('#orb');
let orbGl: OrbGL | null = null;
let dots: DotGrid | null = null;
let avatar: AvatarStage | null = null;

// WebGL-Kugeln der Galerie (Tutor- und Charakter-Karte) sowie der Builder-
// Vorschau — dieselbe "Liquid Ink"-Kugel wie im Chat, nur klein und im
// Ruhezustand: sie driften sanft, pulsieren aber nicht in der Größe.
const gridOrbs: OrbGL[] = [];
let previewOrb: OrbGL | null = null;

function mountOrb(host: HTMLElement, tint?: string | null): OrbGL | null {
  try {
    const orb = new OrbGL(host);
    orb.setState('idle');
    if (tint) orb.setTint(tint);
    orb.start();
    return orb;
  } catch {
    return null; // Ohne WebGL bleibt die CSS-Kugel als Fallback sichtbar.
  }
}

function clearGridOrbs() {
  for (const orb of gridOrbs) orb.destroy();
  gridOrbs.length = 0;
}

function clearPreviewOrb() {
  previewOrb?.destroy();
  previewOrb = null;
}

function setOrb(state: OrbState, label?: string) {
  orbState = state;
  orbGl?.setState(state);
  avatar?.setState(state as AvatarState);
  // Außerhalb des Zuhörens sinkt der Pegel zurück — sowohl in der WebGL-Kugel
  // als auch in der CSS-Glow-Kugel hinter dem Legenden-Gesicht (--level).
  if (state !== 'listening') {
    orbGl?.setLevel(0);
    orbEl().style.setProperty('--level', '0');
  }
  // Nur die state-*-Klasse tauschen — has-avatar und custom-orb müssen erhalten
  // bleiben, sonst blitzt im Legenden-Modus bei jedem Statuswechsel wieder die
  // fancy WebGL-Kugel hinter dem Gesicht auf (statt der schlichten Glow-Kugel).
  const stateClasses = ['state-loading', 'state-idle', 'state-listening', 'state-transcribing', 'state-thinking', 'state-speaking'];
  orbEl().classList.remove(...stateClasses);
  orbEl().classList.add(`state-${state}`);
  const orbMini = $('#btn-orb-mini');
  orbMini.classList.remove(...stateClasses);
  orbMini.classList.add(`state-${state}`);
  // Tooltip/Screenreader-Text folgt dem echten Mikro-Zustand statt eines
  // statischen "Sprachgespräch starten" — sonst bleibt unklar, ob das Mikro
  // gerade aktiv ist, wenn man nur den Knopf sieht (grosse Kugel ausgeblendet,
  // Fokus woanders). Nur bei "listening" nimmt das Mikro tatsaechlich Audio auf.
  const micTitle = state === 'listening' ? t('composer.micActive') : t('composer.mic');
  orbMini.title = micTitle;
  orbMini.setAttribute('aria-label', micTitle);
  orbMini.setAttribute('aria-pressed', String(state === 'listening'));
  const params = { tutor: tutorName(), lang: target().name };
  const labels: Record<OrbState, string> = {
    loading: t('orb.loading'),
    idle: t('orb.idle', params),
    listening: t('orb.listening'),
    transcribing: t('orb.transcribing'),
    thinking: t('orb.thinking', params),
    speaking: t('orb.speaking', params),
  };
  $('#orb-label').textContent = label ?? labels[state];
  updateOrbHint();
}

// Die grosse Kugel ist von Anfang an sichtbar. Der Knopf unten links blendet
// sie ein und aus; ein Tipp auf die Kugel selbst startet das Sprechen.
function showOrb() {
  const stage = $('#orb-stage');
  // Kugel sichtbar -> Knopf unten links zeigt ein durchgestrichenes Mikrofon.
  $('#btn-orb-mini').classList.add('orb-visible');
  if (!stage.hidden) return;
  stage.hidden = false;
  stage.classList.add('stage-in');
}

function hideOrb() {
  const stage = $('#orb-stage');
  // Kugel ausgeblendet -> normales Mikrofon.
  $('#btn-orb-mini').classList.remove('orb-visible');
  if (stage.hidden) return;
  if (immersion) exitImmersion();
  stage.classList.remove('stage-in');
  stage.hidden = true;
  // Stummschalten muss hart sein: laufende Aufnahme sofort abbrechen und das
  // Mikrofon (getUserMedia-Stream) freigeben — sonst hoert das Geraet weiter zu.
  // startListening() verweigert bei ausgeblendeter Kugel den Neustart, sodass
  // auch das Auto-Listen nach einer KI-Antwort das Mikro nicht wieder oeffnet.
  recorder.cancel(); // gibt auch die warm gehaltene Mikro-Pipeline frei
  if (orbState === 'listening' || orbState === 'transcribing') setOrb('idle');
}

// ------------------------------------------------- Legenden-Modus (Personas)

// Portraet statt Kugel: Im Legenden-Modus zeigt der Orb-Button das animierte
// Gesicht der Persona (Lippensync aus player.levels()), die WebGL-Kugel pausiert.
function syncPersonaVisual() {
  const p = activePersona();
  const orb = orbEl();
  if (p) {
    if (!avatar) avatar = new AvatarStage(orb, () => player.levels());
    avatar.setPortrait(p.portrait);
    avatar.setState(orbState as AvatarState);
    orbGl?.stop();
    avatar.start();
    orb.classList.remove('custom-orb');
    orb.style.removeProperty('--paccent');
  } else {
    // Tutor und eigener Charakter zeigen die Sprech-Kugel; der eigene Charakter
    // faerbt ihren Lichthof in seiner Akzentfarbe ein.
    avatar?.setPortrait(null);
    avatar?.stop();
    orbGl?.start();
    if (customActive()) {
      orb.classList.add('custom-orb');
      orb.style.setProperty('--paccent', settings.customPersona!.accent);
      orbGl?.setTint(settings.customPersona!.accent);
    } else {
      orb.classList.remove('custom-orb');
      orb.style.removeProperty('--paccent');
      orbGl?.setTint(null);
    }
  }
}

// Header: Persona-/Charakter-Chip ersetzt im Legenden-Modus das Szenario-Menue.
function updatePersonaHeader() {
  const active = !!activePersona() || customActive();
  const chip = $('#persona-chip');
  ($('#scenario-select') as unknown as HTMLSelectElement).hidden = active;
  chip.hidden = !active;
  if (active) chip.textContent = tutorName();
}

function selectPersona(id: string | null) {
  // Wahl schließt die Galerie/den Builder — deren WebGL-Kugeln freigeben.
  clearGridOrbs();
  clearPreviewOrb();
  // Eigener Charakter: keine Persona aus PERSONAS, sondern settings.customPersona.
  if (id === 'custom') {
    if (!settings.customPersona) return;
    settings.persona = 'custom';
    saveSettings(settings);
    updatePersonaHeader();
    syncPersonaVisual();
    setOrb(orbState);
    toast(t('toast.persona', { name: tutorName() }));
    if (modelsReady) {
      void tts.warmVoice(currentVoice(), ttsLang());
      startConversation();
    }
    return;
  }

  const persona = id ? personaById(id) : null;
  if (!persona && !settings.persona) return;

  // Persona spricht die aktuelle Lernsprache nicht: auf ihre Sprache wechseln
  // (ausser es bliebe nur die Muttersprache uebrig).
  if (persona && !persona.langs.includes(settings.targetLang)) {
    const alt = persona.langs.find((l) => l !== settings.nativeLang);
    if (!alt) {
      toast(t('persona.unavailable'), true);
      return;
    }
    settings.persona = persona.id;
    saveSettings(settings);
    updatePersonaHeader();
    syncPersonaVisual();
    toast(t('toast.persona', { name: persona.short }));
    changeTargetLang(alt); // stellt Stimme um und startet das Gespraech neu
    return;
  }

  settings.persona = persona?.id ?? null;
  saveSettings(settings);
  updatePersonaHeader();
  syncPersonaVisual();
  setOrb(orbState);
  toast(persona ? t('toast.persona', { name: persona.short }) : t('toast.personaOff'));
  if (modelsReady) {
    void tts.warmVoice(currentVoice(), ttsLang());
    startConversation();
  }
}

// Aktiver Tab der Galerie: Legenden oder Natives ("Talk with Natives").
// Beim Oeffnen springt die Galerie auf den Tab der gerade aktiven Persona.
let personaTab: 'legends' | 'natives' = 'legends';

// Tab-Texte: Titel, Untertitel und Hinweis der Galerie haengen am Tab. Der
// data-i18n-Key wird mit umgeschrieben, damit ein Sprachwechsel (applyI18n)
// die Texte nicht auf den Legenden-Stand zuruecksetzt.
function setPersonaTabTexts() {
  const keys: [string, string][] = personaTab === 'natives'
    ? [['#persona-title', 'persona.nativesTitle'], ['#persona-sub', 'persona.nativesSub'], ['#persona-disclaimer', 'persona.nativesDisclaimer']]
    : [['#persona-title', 'persona.title'], ['#persona-sub', 'persona.sub'], ['#persona-disclaimer', 'persona.disclaimer']];
  for (const [sel, key] of keys) {
    const el = $(sel);
    el.dataset.i18n = key;
    el.textContent = t(key);
  }
  for (const [id, tab] of [['#pt-legends', 'legends'], ['#pt-natives', 'natives']] as const) {
    const btn = $(id);
    btn.classList.toggle('active', personaTab === tab);
    btn.setAttribute('aria-selected', String(personaTab === tab));
  }
}

// Galerie: Tutor-Karte, eigener Charakter, dann alle Legenden — jede frei
// waehlbar. Im Natives-Tab stattdessen Tutor-Karte plus alle Natives.
function renderPersonaGrid() {
  const grid = $('#persona-grid');
  clearGridOrbs(); // alte WebGL-Kugeln freigeben, bevor das Raster neu entsteht
  grid.innerHTML = '';
  const ui = uiLangFor(settings.nativeLang, settings.targetLang, settings.uiInTarget);
  setPersonaTabTexts();

  const tutorCard = document.createElement('button');
  tutorCard.type = 'button';
  tutorCard.className = `persona-card pc-tutor${!settings.persona ? ' selected' : ''}`;
  // Statt eines flachen weissen Kreises die echte Sprech-Kugel (CSS-Fallback
  // der Orb-Optik: Glaskugel mit rotierenden Baendern und Glanzlicht).
  tutorCard.innerHTML = `
    <span class="pc-portrait pc-orb">
      <span class="sphere">
        <span class="band b1"></span><span class="band b2"></span><span class="band b3"></span><span class="sheen"></span>
      </span>
    </span>
    <span class="pc-name">${t('persona.tutorCard')}</span>
    <span class="pc-years">${target().flag} ${settings.tutorName?.trim() || target().tutor}</span>
    <span class="pc-tag">${t('persona.tutorDesc')}</span>`;
  tutorCard.addEventListener('click', () => {
    $('#persona-modal').hidden = true;
    selectPersona(null);
  });
  grid.appendChild(tutorCard);
  if (personaTab === 'legends') {
    grid.appendChild(customCard());
    for (const p of PERSONAS) grid.appendChild(personaCard(p, ui));
  } else {
    // Natives des aktuellen Sprachraums zuerst — der Rest bleibt waehlbar
    // (selectPersona wechselt dann automatisch die Lernsprache).
    const natives = [...NATIVES].sort(
      (a, b) => Number(b.native === settings.targetLang) - Number(a.native === settings.targetLang),
    );
    for (const p of natives) grid.appendChild(personaCard(p, ui));
  }

  // Die echte Chat-Kugel in Tutor- und eigener Charakter-Karte lebendig machen.
  // Die Charakter-Karte (.pc-orb-tint) bekommt eine leichte Akzent-Toenung.
  for (const host of grid.querySelectorAll<HTMLElement>('.pc-orb .sphere')) {
    const tint = host.closest('.pc-orb-tint') ? settings.customPersona?.accent : null;
    const orb = mountOrb(host, tint);
    if (orb) gridOrbs.push(orb);
  }
}

function personaCard(p: Persona, ui: UILang): HTMLButtonElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `persona-card${settings.persona === p.id ? ' selected' : ''}`;
  card.style.setProperty('--pa', p.portrait.accent);
  // Natives: Heimat mit Flagge statt Lebensdaten (fiktive Gegenwarts-Figuren);
  // die Flaggen-Fusszeile entfaellt — sie sprechen ohnehin nur ihre Sprache.
  const sub = p.kind === 'native'
    ? `${p.flag ?? targetLangById(p.native).flag} ${p.home}`
    : p.living
      ? `${t('persona.born')} ${p.years}`
      : p.bc ? `${p.years} ${t('persona.bc')}` : p.years;
  const flags = p.langs.map((l) => targetLangById(l).flag).join(' ');
  const foot = p.kind === 'native' ? '' : `<span class="pc-langs">${flags}</span>`;

  card.innerHTML = `
    <span class="pc-portrait">${portraitSVG(p.portrait)}</span>
    <span class="pc-name">${p.short}</span>
    <span class="pc-years">${sub}</span>
    <span class="pc-tag">${p.tagline[ui]}</span>
    ${foot}`;

  card.addEventListener('click', () => {
    $('#persona-modal').hidden = true;
    selectPersona(p.id);
  });
  return card;
}

// ------------------------------------------------ Eigener Charakter (Builder)

const CUSTOM_ACCENTS = ['#6c8cff', '#37b6a3', '#c6772f', '#b256c9', '#d24d6a', '#4a9d4a', '#c9a83a', '#7c8894'];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// Kompakte, akzentgefaerbte Sprech-Kugel als Karten-/Vorschau-Grafik.
function orbPreviewHTML(): string {
  return `<span class="sphere">
    <span class="band b1"></span><span class="band b2"></span><span class="band b3"></span><span class="sheen"></span>
  </span>`;
}

// Karte im Galerie-Raster: entweder "Charakter erstellen" oder der gespeicherte
// eigene Charakter (auswaehlbar, mit Bearbeiten-Stift).
function customCard(): HTMLButtonElement {
  const c = settings.customPersona;
  const card = document.createElement('button');
  card.type = 'button';
  if (!c) {
    card.className = 'persona-card pc-create';
    card.innerHTML = `
      <span class="pc-portrait pc-plus" aria-hidden="true">+</span>
      <span class="pc-name">${t('custom.cardNew')}</span>
      <span class="pc-tag">${t('custom.cardNewDesc')}</span>`;
    card.addEventListener('click', () => openCustomBuilder());
    return card;
  }
  card.className = `persona-card pc-custom${settings.persona === 'custom' ? ' selected' : ''}`;
  card.style.setProperty('--pa', c.accent);
  card.innerHTML = `
    <span class="pc-edit" role="button" tabindex="0" title="${t('custom.edit')}" aria-label="${t('custom.edit')}">✎</span>
    <span class="badge">${t('custom.badge')}</span>
    <span class="pc-portrait pc-orb pc-orb-tint">${orbPreviewHTML()}</span>
    <span class="pc-name">${escapeHtml(c.name) || t('custom.cardNew')}</span>
    <span class="pc-tag">${escapeHtml(c.role) || t('custom.cardNewDesc')}</span>`;
  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.pc-edit')) {
      openCustomBuilder();
      return;
    }
    $('#persona-modal').hidden = true;
    selectPersona('custom');
  });
  return card;
}

// Baustelle-Zustand des Formulars (bis "Erstellen" gedrueckt wird).
let cfAccent = CUSTOM_ACCENTS[0];
let cfVoice = '';

// Stimmen der aktuellen Lernsprache ins Builder-Dropdown fuellen.
function renderCustomVoices() {
  const sel = $('#cf-voice') as unknown as HTMLSelectElement;
  sel.innerHTML = '';
  for (const v of target().voices) {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = v.name;
    sel.appendChild(o);
  }
  if (!target().voices.some((v) => v.id === cfVoice)) cfVoice = target().defaultVoice;
  sel.value = cfVoice;
}

function renderCustomTraits() {
  const wrap = $('#cf-chips');
  wrap.innerHTML = '';
  for (const trait of tList('custom.traits')) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cf-chip';
    chip.textContent = trait;
    chip.addEventListener('click', () => {
      const ta = $('#cf-personality') as unknown as HTMLTextAreaElement;
      const cur = ta.value.trim();
      // Trait nur anhaengen, wenn noch nicht enthalten.
      if (!cur.toLowerCase().includes(trait.toLowerCase())) {
        ta.value = cur ? `${cur}, ${trait}` : trait;
        updateCustomPreview();
      }
      chip.classList.add('added');
    });
    wrap.appendChild(chip);
  }
}

function renderCustomColors() {
  const wrap = $('#cf-colors');
  wrap.innerHTML = '';
  for (const col of CUSTOM_ACCENTS) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = `cf-color${col === cfAccent ? ' selected' : ''}`;
    sw.style.background = col;
    sw.setAttribute('aria-label', col);
    sw.addEventListener('click', () => {
      cfAccent = col;
      renderCustomColors();
      updateCustomPreview();
    });
    wrap.appendChild(sw);
  }
}

function updateCustomPreview() {
  const name = ($('#cf-name') as unknown as HTMLInputElement).value.trim();
  const role = ($('#cf-role') as unknown as HTMLInputElement).value.trim();
  $('#cp-name').textContent = name || t('custom.previewName');
  $('#cp-role').textContent = role || t('custom.previewRole');
  ($('#cp-orb') as HTMLElement).style.setProperty('--paccent', cfAccent);
  ($('#cp-orb') as HTMLElement).style.setProperty('--pa', cfAccent);
  previewOrb?.setTint(cfAccent); // Kugel-Toenung live an die Farbwahl anpassen
}

function openCustomBuilder() {
  const c = settings.customPersona;
  ($('#cf-name') as unknown as HTMLInputElement).value = c?.name ?? '';
  ($('#cf-role') as unknown as HTMLInputElement).value = c?.role ?? '';
  ($('#cf-personality') as unknown as HTMLTextAreaElement).value = c?.personality ?? '';
  ($('#cf-knowledge') as unknown as HTMLTextAreaElement).value = c?.knowledge ?? '';
  cfAccent = c?.accent ?? CUSTOM_ACCENTS[0];
  cfVoice = c?.voice ?? target().defaultVoice;
  renderCustomTraits();
  renderCustomColors();
  renderCustomVoices();
  updateCustomPreview();
  clearGridOrbs(); // Raster wird verdeckt — Kugeln freigeben
  $('#persona-modal').hidden = true;
  $('#custom-modal').hidden = false;
  clearPreviewOrb();
  previewOrb = mountOrb($('#cp-orb .sphere'), cfAccent);
  ($('#cf-name') as unknown as HTMLInputElement).focus();
}

function saveCustomPersona() {
  const name = ($('#cf-name') as unknown as HTMLInputElement).value.trim();
  const personality = ($('#cf-personality') as unknown as HTMLTextAreaElement).value.trim();
  if (!name) {
    toast(t('custom.needName'), true);
    ($('#cf-name') as unknown as HTMLInputElement).focus();
    return;
  }
  if (!personality) {
    toast(t('custom.needPersonality'), true);
    ($('#cf-personality') as unknown as HTMLTextAreaElement).focus();
    return;
  }
  settings.customPersona = {
    name,
    role: ($('#cf-role') as unknown as HTMLInputElement).value.trim(),
    personality,
    knowledge: ($('#cf-knowledge') as unknown as HTMLTextAreaElement).value.trim(),
    accent: cfAccent,
    voice: cfVoice,
  };
  saveSettings(settings);
  $('#custom-modal').hidden = true;
  selectPersona('custom');
}

// -------------------------------------------- Sprech-only-Modus (Immersion)
// Zieht der Nutzer die grosse Kugel nach oben, loest sie sich aus dem Dock:
// Chat, Punktraster und Kopfzeile werden unscharf, die Kugel rueckt als
// leuchtendes Zentrum in die Bildmitte und ihre Stroemung wird lebendiger.
// Nach unten ziehen, ein Tipp daneben oder Esc beenden den Modus wieder.

let immersion = false;
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragMoved = 0;
let appliedShiftY = 0; // aktuell auf #orb-wrap angewandtes translateY
let immersionShift = 0; // Ziel-Verschiebung, wenn die Kugel zentriert ist
let suppressNextClick = false;

const IMMERSION_TRIGGER = 26; // kurzer Zug nach oben genuegt zum Aktivieren
const IMMERSION_RELEASE = 40; // px nach unten ziehen zum Beenden

function setWrapTransform(y: number, scale: number) {
  appliedShiftY = y;
  const wrap = $('#orb-wrap');
  wrap.style.transform = y === 0 && scale === 1 ? '' : `translateY(${y}px) scale(${scale})`;
}

// Bildschirm-Mitte der Kugel in ihrer natuerlichen (untransformierten) Lage.
// Transform verschiebt nur optisch, nicht das Layout — darum den aktuell
// angewandten Versatz herausrechnen.
function orbNaturalCenterY(): number {
  const rect = $('#orb-wrap').getBoundingClientRect();
  return rect.top + rect.height / 2 - appliedShiftY;
}

// Wie weit muss die Kugel hoch, um leicht oberhalb der Bildmitte zu schweben?
function computeImmersionShift(): number {
  const targetY = window.innerHeight * 0.42;
  return targetY - orbNaturalCenterY();
}

function setImmersionVar(v: number) {
  $('#app').style.setProperty('--imm', String(v));
}

function enterImmersion() {
  if (immersion || $('#orb-stage').hidden) return;
  immersion = true;
  immersionShift = computeImmersionShift();
  $('#app').classList.add('immersion');
  setImmersionVar(1);
  setWrapTransform(immersionShift, 1);
  orbGl?.setImmersion(1);
  updateOrbHint();
}

function exitImmersion() {
  if (!immersion) return;
  immersion = false;
  $('#app').classList.remove('immersion');
  setImmersionVar(0);
  setWrapTransform(0, 1);
  orbGl?.setImmersion(0);
  updateOrbHint();
}

function updateOrbHint() {
  const hint = $('#orb-hint');
  if (orbState === 'loading') {
    hint.textContent = '';
    return;
  }
  hint.textContent = immersion ? t('orb.immersionExit') : t('orb.immersionEnter');
}

// --- Zieh-Geste auf der Kugel ---
// Die Kugel klebt nicht am Zeiger: Erst wenn bei gedrueckter Taste weit genug
// gezogen wurde, pendelt sie sich per Transition von selbst in ihre Ziel-
// Position ein (Bildmitte bzw. zurueck ins Dock). Hovern bewegt sie nie.
function onOrbPointerDown(e: PointerEvent) {
  if (orbState === 'loading') return;
  if (e.button !== 0) return;
  suppressNextClick = false;
  dragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragMoved = 0;
  try { orbEl().setPointerCapture(e.pointerId); } catch { /* egal */ }
}

function finishDrag(e: PointerEvent) {
  dragging = false;
  suppressNextClick = true; // der folgende Klick gehoert zur Geste
  try { orbEl().releasePointerCapture(e.pointerId); } catch { /* egal */ }
}

function onOrbPointerMove(e: PointerEvent) {
  if (!dragging) return;
  // Sicherheitsnetz: Ohne gedrueckte Taste ist es kein Ziehen (etwa wenn das
  // pointerup verloren ging) — sonst wuerde die Kugel dem Hovern folgen.
  if (e.buttons === 0) { dragging = false; return; }
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY; // negativ = nach oben
  dragMoved = Math.max(dragMoved, Math.hypot(dx, dy));
  if (!immersion && -dy > IMMERSION_TRIGGER) {
    finishDrag(e);
    enterImmersion();
  } else if (immersion && dy > IMMERSION_RELEASE) {
    finishDrag(e);
    exitImmersion();
  }
}

function onOrbPointerUp(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  try { orbEl().releasePointerCapture(e.pointerId); } catch { /* egal */ }
  if (dragMoved > 8) suppressNextClick = true; // Wackler ist kein Klick
}

// Knopf unten links: Kugel ein-/ausblenden.
function toggleOrb() {
  if ($('#orb-stage').hidden) showOrb();
  else hideOrb();
}

// Leertaste: sprechen — Kugel bei Bedarf zuerst einblenden.
function onVoiceButton() {
  if (orbState === 'loading') return;
  showOrb();
  onOrbClick();
}

// Sobald die Modelle bereit sind: Kugel zeigen und das Gespraech von selbst
// beginnen. Die KI spricht die Begruessung; blockt die Autoplay-Policy den Ton
// anfangs, startet er spaetestens bei der ersten Nutzer-Geste (siehe player).
function onModelsReady() {
  showOrb();
  if (!conversationStarted) startConversation();
}

// ---------------------------------------------------------------- Chat-UI

function appendMessage(role: 'user' | 'assistant', text = '', docName?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `msg msg-${role}`;
  const host = $('#chat');
  // Ist der Nachricht ein Dokument beigelegt, sitzt ein Datei-Chip ueber dem
  // Text — sichtbare Bestaetigung, dass die Datei mit dieser Nachricht rausging.
  if (docName) {
    const chip = document.createElement('span');
    chip.className = 'msg-doc';
    chip.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>';
    const name = document.createElement('span');
    name.className = 'msg-doc-name';
    name.textContent = docName;
    chip.appendChild(name);
    el.appendChild(chip);
  }
  const textEl = document.createElement('div');
  textEl.className = 'msg-text';
  textEl.textContent = text;
  // Auffindbarkeit der Wort-Uebersetzung: dezenter Hover-Hinweis auf dem Text.
  textEl.title = t(translateHintKey());
  el.appendChild(textEl);
  host.appendChild(el);
  scrollChat();
  return el;
}

// Aktionsleiste unter fertigen Assistenten-Nachrichten: noch einmal vorlesen.
function addAssistantActions(msgEl: HTMLElement, text: string) {
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const speak = document.createElement('button');
  speak.type = 'button';
  speak.className = 'msg-action msg-speak';
  speak.title = t('msg.speakAgain');
  speak.setAttribute('aria-label', t('msg.speakAgain'));
  speak.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 9v6h4l5 4.2V4.8L7.5 9h-4z" fill="currentColor"/>
      <path d="M16 8.4a5 5 0 0 1 0 7.2M18.6 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  speak.addEventListener('click', () => {
    if (!tts.ready || generating) return;
    cancelSpeech();
    const { complete, rest } = splitIncremental(text);
    for (const sentence of complete) enqueueSpeech(sentence);
    if (rest.trim()) enqueueSpeech(rest);
  });
  actions.appendChild(speak);

  // Ganze Antwort uebersetzen: blendet unter der Nachricht eine Uebersetzung in
  // die Muttersprache ein (erneuter Klick blendet sie wieder aus).
  const translate = document.createElement('button');
  translate.type = 'button';
  translate.className = 'msg-action msg-translate';
  translate.title = t('msg.translate');
  translate.setAttribute('aria-label', t('msg.translate'));
  translate.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 5h7M9 3v2c0 4-2 7-5 8"/><path d="M6 9c0 2.5 2.5 4.5 6 5"/>
      <path d="M13 20l4-9 4 9M14.5 17h5"/>
    </svg>`;
  translate.addEventListener('click', () => toggleMessageTranslation(msgEl, text, translate));
  actions.appendChild(translate);

  // Nachsprechen-Funktion vorerst deaktiviert (Aussprache-Uebung per
  // Phonem-Modell) — Implementierung bleibt in pronunciation.ts/phoneme.ts
  // erhalten, nur der Einstiegspunkt (dieser Button) ist entfernt.

  msgEl.appendChild(actions);
  maybeShowTranslateHint(translate);
}

// ------------------------------------------- Eigene Nachricht nachbessern
// Die Spracherkennung verhoert sich gelegentlich. Statt deswegen das ganze
// Gespraech neu zu starten, tippt man einfach seine JUENGSTE eigene Nachricht
// an: die darauf gegebene Antwort (und die Tutor-Karte) verschwinden sofort,
// das Mikro geht wieder an — man sagt den Satz noch einmal (oder tippt ihn in
// der Blase) und die KI antwortet ganz normal darauf.
// Bewusst nur die letzte Nachricht — an allem davor haengt schon weiterer
// Gespraechsverlauf, der sonst still verfaelscht wuerde.

// Antippbare (= letzte eigene) Blase und die Nachricht dahinter.
let editableEl: HTMLElement | null = null;
let editableMsg: ChatMessage | null = null;
// Blase, die gerade im Korrektur-Modus steht (hoechstens eine).
let editingEl: HTMLElement | null = null;

// Die letzte eigene Blase wird zur Schaltflaeche. Kein Extra-Knopf: die ganze
// Blase reagiert, erkennbar an Zeiger, Hover und Titel.
function setEditable(msgEl: HTMLElement, msg: ChatMessage) {
  clearEditable();
  editableEl = msgEl;
  editableMsg = msg;
  msgEl.classList.add('msg-editable');
  msgEl.tabIndex = 0;
  msgEl.setAttribute('role', 'button');
  msgEl.title = t('msg.edit');
  // Auf dieser Blase gilt der Tipp/Doppelklick jetzt dem Korrigieren, nicht
  // der Wort-Uebersetzung — also auch keinen irrefuehrenden Hinweis zeigen.
  msgEl.querySelector('.msg-text')?.removeAttribute('title');
}

function clearEditable() {
  const el = editableEl;
  editableEl = null;
  editableMsg = null;
  if (!el) return;
  el.classList.remove('msg-editable');
  el.removeAttribute('role');
  el.removeAttribute('tabindex');
  el.removeAttribute('title');
  const textEl = el.querySelector<HTMLElement>('.msg-text');
  if (textEl) textEl.title = t(translateHintKey());
}

// Klick irgendwo auf der letzten eigenen Blase (Delegation am Chat).
function onChatClick(e: MouseEvent) {
  const el = editableEl;
  if (!el || !editableMsg) return;
  if (!el.contains(e.target as Node)) return;
  if (editingEl === el) return; // Editor steht schon offen
  startCorrection(el, editableMsg);
}

// Tastatur: Enter loest die Korrektur aus. Leertaste bewusst NICHT — die ist
// appweit fuers Sprechen reserviert (s. wireEvents).
function onChatKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter') return;
  const el = editableEl;
  if (!el || !editableMsg || e.target !== el) return;
  e.preventDefault();
  if (editingEl !== el) startCorrection(el, editableMsg);
}

// Korrektur-Modus: alles unter der Blase faellt sofort weg (die Antwort galt
// einem Satz, den es so nicht gab), der Verlauf wird gekappt, das Mikro geht
// an und die Blase wird schreibbar.
function startCorrection(msgEl: HTMLElement, msg: ChatMessage) {
  const idx = history.indexOf(msg);
  if (idx < 0 || !msgEl.isConnected) {
    // Gespraech wurde zwischenzeitlich ersetzt (Szenario-/Sprachwechsel).
    toast(t('toast.editGone'), true);
    clearEditable();
    return;
  }
  cancelEditMode();

  // Laufende Antwort zum alten Wortlaut abbrechen.
  cancelSpeech();
  genAbort.aborted = true;
  llm.interrupt();
  setGenerating(false);

  // Verlauf hinter der Nachricht kappen — als NEUES Array, damit ein noch
  // auslaufender Stream seinen Resttext in den alten, verwaisten Verlauf
  // schreibt und nicht in den frischen (gleicher Trick wie assistantTurn).
  history = history.slice(0, idx + 1);
  // Alte Antwort, Tutor-Karte und Uebersetzung unter der Blase loeschen.
  while (msgEl.nextSibling) msgEl.nextSibling.remove();

  openEditor(msgEl, msg);

  // Mikro sichtbar scharf schalten — unabhaengig von Auto-Listen, denn der
  // Klick IST die Ansage "ich sage es noch einmal".
  if (modelsReady) {
    showOrb();
    void startListening();
  }
}

function openEditor(msgEl: HTMLElement, msg: ChatMessage) {
  const textEl = msgEl.querySelector<HTMLElement>('.msg-text');
  if (!textEl) return;
  editingEl = msgEl;
  msgEl.classList.add('msg-editing');
  textEl.hidden = true;

  const box = document.createElement('div');
  box.className = 'msg-edit';

  const input = document.createElement('textarea');
  input.className = 'msg-edit-input';
  input.rows = 1;
  input.value = msg.content;
  input.setAttribute('aria-label', t('msg.edit'));
  input.spellcheck = false;

  const row = document.createElement('div');
  row.className = 'msg-edit-actions';
  const keep = document.createElement('button');
  keep.type = 'button';
  keep.className = 'msg-edit-pill';
  keep.textContent = t('msg.editCancel');
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'msg-edit-pill solid';
  save.textContent = t('msg.editSave');
  row.append(keep, save);
  box.append(input, row);
  msgEl.appendChild(box);

  // Feld waechst mit dem Text — eine korrigierte Nachricht soll nie in einem
  // Ein-Zeilen-Schlitz stecken.
  const autosize = () => {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  };
  input.addEventListener('input', autosize);
  autosize();
  // Auf dem Handy KEIN Autofokus: die Bildschirmtastatur wuerde ueber die
  // gerade scharf geschaltete Kugel klappen. Am Desktop darf man sofort tippen.
  if (!coarsePointer()) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  scrollChat();

  keep.addEventListener('click', () => applyCorrection(msg.content));
  save.addEventListener('click', () => applyCorrection(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      applyCorrection(msg.content);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Wie im Composer: Enter schickt ab, Shift+Enter macht einen Umbruch.
      e.preventDefault();
      applyCorrection(input.value);
    }
  });
}

// Editor schliessen und den (ggf. unveraenderten) Text wieder anzeigen.
function cancelEditMode() {
  const el = editingEl;
  if (!el) return;
  editingEl = null;
  el.classList.remove('msg-editing');
  el.querySelector('.msg-edit')?.remove();
  const textEl = el.querySelector<HTMLElement>('.msg-text');
  if (textEl) textEl.hidden = false;
}

// Neu gesprochener Satz: nur ins Feld schreiben. Das letzte Wort hat der
// Knopf — auch beim freihaendigen Sprechen, sonst ersetzt ein zweiter
// Verhoerer den ersten, ohne dass jemand es haette pruefen koennen.
function fillCorrection(text: string) {
  const input = editingEl?.querySelector<HTMLTextAreaElement>('.msg-edit-input');
  if (!input) return;
  input.value = text;
  input.dispatchEvent(new Event('input')); // Hoehe nachziehen
  // Waehrend man den Vorschlag prueft, laeuft kein Mikro mehr mit: die
  // Aufnahme ist ohnehin durch (stopAndProcess), die Kugel geht in den
  // Ruhezustand, bis der Knopf gedrueckt wird.
  recorder.cancel();
  if (orbState === 'transcribing' || orbState === 'listening') setOrb('idle');
  if (!coarsePointer()) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  // Kurz auf den Knopf zeigen: hier fehlt noch ein Klick.
  const save = editingEl?.querySelector<HTMLElement>('.msg-edit-pill.solid');
  if (save) {
    save.classList.remove('nudge');
    void save.offsetWidth; // Animation neu starten
    save.classList.add('nudge');
  }
  scrollChat();
}

// -------------------------------------------- „Schon gewusst?“-Popup
// Die Geste (eigene Nachricht antippen) ist bewusst unaufdringlich — genau
// darum findet sie niemand von allein. Nach ein paar eigenen Zuegen zeigt ein
// einmaliges Popup kurz, was sie tut; danach nie wieder.
const EDIT_HINT_AFTER_TURNS = 3;
// Faellig, aber noch nicht gezeigt: eingeloest wird erst am Ende des Zuges
// (maybeFinishTurn), damit das Popup nicht in eine laufende Antwort platzt.
let editHintPending = false;

function openEditHint() {
  settings.editHintSeen = true;
  saveSettings(settings);
  // Waehrend man liest, soll das Mikro nicht mitlaufen.
  recorder.cancel();
  if (orbState === 'listening' || orbState === 'transcribing') setOrb('idle');
  $('#hint-modal').hidden = false;
  ($('#btn-hint-ok') as unknown as HTMLButtonElement).focus();
}

function closeEditHint() {
  $('#hint-modal').hidden = true;
  resumeAutoListen();
}

// Freihaendiges Zuhoeren nach einem Popup wieder aufnehmen.
function resumeAutoListen() {
  if (!settings.autoListen || !modelsReady || isBusy()) return;
  if (orbState !== 'idle' || $('#orb-stage').hidden) return;
  void startListening();
}

// Nicht in etwas hineinplatzen: kein anderes Overlay offen, keine laufende
// Antwort, keine Tour — und nur, solange es ueberhaupt etwas anzutippen gibt.
function canShowEditHint(): boolean {
  if (settings.editHintSeen || supportTurns < EDIT_HINT_AFTER_TURNS) return false;
  if (!editableEl || editingEl) return false;
  if (isBusy() || activeTour?.active()) return false;
  return !document.querySelector('#app .overlay:not([hidden])');
}

function maybeShowEditHint() {
  if (settings.editHintSeen || supportTurns < EDIT_HINT_AFTER_TURNS) return;
  editHintPending = true;
}

// Zug ist zu Ende (s. maybeFinishTurn): kurz durchatmen lassen, dann zeigen.
// Klappt es gerade nicht (anderes Overlay, Korrektur offen), bleibt der Hinweis
// ungesehen und der naechste Zug versucht es erneut.
function flushEditHint() {
  if (!editHintPending) return;
  editHintPending = false;
  setTimeout(() => {
    if (canShowEditHint()) openEditHint();
    else if (!settings.editHintSeen) editHintPending = true;
  }, 700);
}

// Korrektur uebernehmen — aus dem Textfeld, ueber "unveraendert" oder aus dem
// erneut gesprochenen Satz (s. userTurn). Die alte Antwort ist beim Oeffnen
// schon gefallen, also antwortet die KI in jedem Fall neu.
function applyCorrection(raw: string) {
  const msgEl = editingEl;
  const msg = editableMsg;
  if (!msgEl || !msg) return;
  const text = raw.trim() || msg.content;
  cancelEditMode();
  if (history.indexOf(msg) < 0 || !msgEl.isConnected) {
    toast(t('toast.editGone'), true);
    return;
  }
  // Ein noch offenes Mikro wuerde sonst die gleich startende Antwort mithoeren.
  recorder.cancel();
  if (orbState === 'listening' || orbState === 'transcribing') setOrb('idle');

  msg.content = text;
  const textEl = msgEl.querySelector<HTMLElement>('.msg-text');
  if (textEl) textEl.textContent = text;

  void assistantTurn();
  scrollChat();
}

// -------------------------------------------------- Aussprache-Uebung
// Eine einzelne Aufnahme kann zur Zeit laufen (geteiltes Mikro mit dem
// Hauptgespraech) — dieser Button verfolgt, welcher genau das gerade ist.
let shadowBtn: HTMLButtonElement | null = null;

function resetShadowButton(btn: HTMLButtonElement) {
  if (shadowBtn === btn) shadowBtn = null;
  btn.classList.remove('recording', 'busy');
  btn.style.removeProperty('--level');
  btn.title = t('msg.shadow');
  btn.setAttribute('aria-label', t('msg.shadow'));
}

async function onShadowClick(msgEl: HTMLElement, text: string, btn: HTMLButtonElement) {
  if (btn === shadowBtn) {
    // Zweiter Klick auf denselben Knopf: Aufnahme manuell beenden.
    void finishShadowRecording(msgEl, text, btn);
    return;
  }
  if (!stt.ready || generating || recorder.recording) {
    // Mikro dem Auto-Zuhoeren des Hauptgespraechs fuer die Uebung abnehmen,
    // statt die Aufnahme still zu verweigern.
    if (orbState === 'listening') {
      await recorder.stop(); // laufende Aufnahme verwerfen, kein echter Zug
      setOrb('idle');
    } else if (orbState === 'thinking' || orbState === 'speaking') {
      genAbort.aborted = true;
      llm.interrupt();
      cancelSpeech();
      setGenerating(false);
      setOrb('idle');
    } else {
      return; // z.B. eine andere Nachsprechen-Aufnahme laeuft schon
    }
  }
  cancelSpeech();
  msgEl.querySelector('.msg-shadow-result')?.remove();
  shadowBtn = btn;
  btn.classList.add('recording');
  btn.title = t('msg.shadowStop');
  btn.setAttribute('aria-label', t('msg.shadowStop'));
  try {
    await recorder.start({
      onLevel: (rms) => btn.style.setProperty('--level', String(Math.min(1, rms * 7))),
      onAutoStop: () => void finishShadowRecording(msgEl, text, btn),
    });
  } catch (err: any) {
    resetShadowButton(btn);
    if (err?.name === 'NotAllowedError') toast(t('toast.micDenied'), true);
    else toast(t('toast.micErr', { err: err?.message ?? err }), true);
  }
}

// Phonem-Modell fuer die Aussprache-Uebung lazy laden (grosser, optionaler
// Download — daher nicht Teil des Pflicht-Setups). Idempotent: mehrfaches
// Aufrufen teilt sich denselben Ladevorgang.
function ensurePhonemeReady(onProgress: (pct: number) => void): Promise<void> {
  const device: 'webgpu' | 'wasm' = hw?.webgpu ? 'webgpu' : 'wasm';
  return phoneme.ensure(PHONEME_MODEL_ID, device, (p) => onProgress(p.pct));
}

async function finishShadowRecording(msgEl: HTMLElement, text: string, btn: HTMLButtonElement) {
  if (shadowBtn !== btn || !recorder.recording) return;
  btn.classList.remove('recording');
  btn.classList.add('busy');
  btn.style.removeProperty('--level');

  // Ergebnis-Block sofort einsetzen — zeigt erst (Down-)Load-Fortschritt, dann
  // die Bewertung.
  msgEl.querySelector('.msg-shadow-result')?.remove();
  const block = document.createElement('div');
  block.className = 'msg-shadow-result';
  block.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
  msgEl.insertBefore(block, msgEl.querySelector('.msg-actions'));
  scrollChat();

  try {
    const hadSpeech = recorder.hasSpeech;
    const audio = await recorder.stop();
    if (!hadSpeech || audio.length < 8000) {
      block.remove(); // nichts Verwertbares aufgenommen -> still zuruecksetzen
      resetShadowButton(btn);
      return;
    }
    // Beim ersten Mal wird hier das ~300-MB-Modell geladen; Fortschritt im Block.
    await ensurePhonemeReady((pct) => {
      if (block.isConnected) block.textContent = t('shadow.loading', { pct: Math.round(pct) });
    });
    // Tatsaechlich produzierte Laute (ohne Sprachprior) …
    const produced = await phoneme.recognize(audio);
    // … gegen die erwarteten espeak-Phoneme je Wort des Zielsatzes.
    const words = splitWords(text);
    const expected = await tts.phonemizeWords(words.map((w) => w.clean), target().espeak);
    const result = scorePronunciation(words, expected, produced);
    resetShadowButton(btn);
    if (!block.isConnected) return; // Block wurde zwischenzeitlich ersetzt
    renderShadowResult(block, result);
  } catch (err: any) {
    block.remove();
    resetShadowButton(btn);
    toast(t('toast.pronFail', { err: err?.message ?? err }), true);
  }
}

// Bewertung rendern: Kopfzeile mit Gesamt-Prozent + Lob/Hinweis, darunter der
// Zielsatz Wort fuer Wort nach Laut-Treffer eingefaerbt (gut / teils / schlecht).
function renderShadowResult(block: HTMLElement, result: PronunciationResult) {
  const pct = Math.round(result.overall * 100);
  const level = result.overall >= 0.85 ? 'great' : result.overall >= 0.6 ? 'ok' : 'low';
  const headKey = level === 'great' ? 'shadow.great' : level === 'ok' ? 'shadow.good' : 'shadow.again';
  const wordsHtml = result.words
    .map((w) => {
      if (w.score === null) return escapeHtml(w.word); // Interpunktion o. ä. — nicht bewertet
      const cls = w.ok ? 'sw-ok' : w.score >= 0.4 ? 'sw-mid' : 'sw-bad';
      return `<span class="${cls}">${escapeHtml(w.word)}</span>`;
    })
    .join(' ');
  block.innerHTML =
    `<div class="shadow-score shadow-${level}">` +
    `<span class="shadow-pct">${pct}%</span><span>${escapeHtml(t(headKey))}</span></div>` +
    `<div class="shadow-words">${wordsHtml}</div>`;
  scrollChat();
}

// DEV-Testhaken (in PROD via import.meta.env.DEV entfernt): fuehrt die
// Aussprache-Bewertung deterministisch mit uebergebenem Audio + Zieltext aus,
// ohne Recorder/LLM — fuer die Browser-Verifikation mit echter Sprache.
if (import.meta.env.DEV) {
  (window as any).__pron = async (text: string, audio: Float32Array) => {
    await ensurePhonemeReady(() => {});
    const produced = await phoneme.recognize(audio);
    const words = splitWords(text);
    const expected = await tts.phonemizeWords(words.map((w) => w.clean), target().espeak);
    const result = scorePronunciation(words, expected, produced);
    return { produced, expected, result };
  };
}

// Einmaliger, geraeteabhaengiger Hinweis auf die Wort-Uebersetzung — beim ersten
// Mal, dass eine fertige Antwort mit Uebersetzen-Knopf erscheint. Kurz verzoegert,
// damit er sich nicht mit dem "Alles bereit"-Toast der Begruessung ueberlagert.
function maybeShowTranslateHint(anchorBtn: HTMLButtonElement) {
  if (settings.translateHintSeen) return;
  settings.translateHintSeen = true;
  saveSettings(settings);
  setTimeout(() => showGestureHint(anchorBtn), 1200);
}

// Schwebender Hinweis-Callout neben dem Uebersetzen-Knopf (ersetzt den
// frueheren Bottom-Toast) — gleiche Optik/Positionierung wie das
// Wort-Popover, damit der Hinweis wie Teil des Features wirkt. Schliesst
// automatisch nach ein paar Sekunden oder ueber dieselben Trigger wie das
// Wort-Popover (Scroll/Klick-daneben/Esc/Resize, s. u.).
let gestureHintEl: HTMLElement | null = null;

function dismissGestureHint() {
  gestureHintEl?.remove();
  gestureHintEl = null;
}

function showGestureHint(anchorBtn: HTMLButtonElement) {
  if (!anchorBtn.isConnected) return;
  const pop = document.createElement('div');
  pop.className = 'gesture-hint';
  pop.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 5h7M9 3v2c0 4-2 7-5 8"/><path d="M6 9c0 2.5 2.5 4.5 6 5"/>
      <path d="M13 20l4-9 4 9M14.5 17h5"/>
    </svg>
    <span>${t(translateHintKey())}</span>`;
  document.body.appendChild(pop);
  positionWordPopover(pop, anchorBtn.getBoundingClientRect());
  gestureHintEl = pop;
  setTimeout(dismissGestureHint, 6500);
}

// Uebersetzer lazy laden (engines/translate.ts): einmalig pro Sitzung, danach
// bleibt er fuers Uebersetzen von Woertern und ganzen Antworten geladen.
// Immer Lernsprache -> Muttersprache. Laeuft in einem eigenen Worker, nicht
// auf der Chat-Engine — kann also parallel zu einer laufenden Antwort
// uebersetzen, ohne mit ihr um dieselbe Engine zu konkurrieren.
// Bewusst IMMER 'wasm', nie WebGPU: mit dtype q8 liefert die WebGPU-Route bei
// diesem Modell nachweislich Kauderwelsch (mehrsprachiger Wortsalat statt
// Uebersetzung, per Playwright reproduziert) — auf WASM uebersetzt exakt
// dasselbe Modell/dtype fehlerfrei. Uebersetzung ist nicht latenzkritisch wie
// das Gespraech, also lohnt sich das GPU-Risiko hier nicht.
function ensureTranslatorReady(onProgress: (pct: number) => void): Promise<void> {
  return translator.load(
    TRANSLATE_MODEL_ID,
    'wasm',
    target().flores,
    nativeLangById(settings.nativeLang ?? 'en').flores,
    target().warmup,
    (p) => onProgress(p.pct),
  );
}

// Fortschritts-Text fuers Laden des Uebersetzers: der Download-Prozentsatz
// deckt nur die Gewichte ab, nicht den anschliessenden Warmup-Inferenzlauf
// (Kernel-Kompilierung, bei diesem 600M-Modell spuerbar) — bei 100 % bliebe
// der Text sonst laenger eingefroren stehen, deshalb ab da wieder Punkte.
function translatorProgressText(pct: number): string {
  const rounded = Math.round(pct);
  return rounded >= 100 ? '<span class="dots"><i></i><i></i><i></i></span>' : t('translate.loading', { pct: rounded });
}

// Ganze Antwort in die Muttersprache uebersetzen und als ruhigen Block unter der
// Nachricht zeigen. Toggle: erneuter Klick entfernt die Uebersetzung wieder.
function toggleMessageTranslation(msgEl: HTMLElement, text: string, btn: HTMLButtonElement) {
  const existing = msgEl.querySelector('.msg-translation');
  if (existing) {
    existing.remove();
    btn.classList.remove('active');
    return;
  }
  btn.classList.add('active');
  const block = document.createElement('div');
  block.className = 'msg-translation';
  block.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
  msgEl.insertBefore(block, msgEl.querySelector('.msg-actions'));
  scrollChat();
  const srcLang = target().flores;
  const tgtLang = nativeLangById(settings.nativeLang ?? 'en').flores;
  ensureTranslatorReady((pct) => {
    if (block.isConnected) block.innerHTML = translatorProgressText(pct);
  })
    .then(() => {
      if (!block.isConnected) return null;
      block.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
      return translator.translate(text, srcLang, tgtLang);
    })
    .then((out) => {
      if (!block.isConnected || out === null) return; // Uebersetzung wurde wieder ausgeblendet
      block.textContent = out || t('translate.failed');
      scrollChat();
    })
    .catch(() => {
      if (block.isConnected) block.textContent = t('translate.failed');
    });
}

function scrollChat() {
  const chat = $('#chat');
  chat.scrollTop = chat.scrollHeight;
}

// ------------------------------------------------------ Wort-Uebersetzung
// Doppelklick auf ein Wort in einer Blase: Der Browser markiert das Wort, wir
// uebersetzen es (isoliert, wie Google Translate es bei einem markierten Wort
// auch tut) und zeigen die Uebersetzung in einem schwebenden Popover ueber
// dem Wort.

let translatePop: HTMLElement | null = null;
// Laufende-Nummer der aktuellen Wort-Uebersetzung: eine spaeter eintreffende
// Antwort eines schon geschlossenen/ersetzten Popovers wird verworfen.
let translateSeq = 0;

function dismissWordPopover() {
  translatePop?.remove();
  translatePop = null;
  translateSeq++;
}

// Popover an der Wort-Auswahl ausrichten: bevorzugt darueber, sonst darunter;
// waagerecht in den Viewport geklemmt. rect ist viewport-relativ (Auswahl),
// die Seite kann gescrollt sein -> Scroll-Offset addieren.
function positionWordPopover(pop: HTMLElement, rect: DOMRect) {
  const margin = 8;
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = rect.left + rect.width / 2 - pw / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
  let top = rect.top - ph - 10;
  if (top < margin) top = rect.bottom + 10; // kein Platz oben -> unter das Wort
  pop.style.left = `${left + window.scrollX}px`;
  pop.style.top = `${top + window.scrollY}px`;
}

// Gemeinsamer Kern beider Gesten: ein Wort uebersetzen und das Ergebnis im
// schwebenden Popover an der uebergebenen Stelle zeigen.
function showWordTranslation(word: string, rect: DOMRect) {
  dismissWordPopover();
  const seq = ++translateSeq;
  const pop = document.createElement('div');
  pop.className = 'translate-pop';
  pop.innerHTML =
    `<span class="tp-word">${escapeHtml(word)}</span>` +
    '<span class="tp-arrow" aria-hidden="true">→</span>' +
    '<span class="tp-result"><span class="dots"><i></i><i></i><i></i></span></span>';
  document.body.appendChild(pop);
  translatePop = pop;
  positionWordPopover(pop, rect);

  const srcLang = target().flores;
  const tgtLang = nativeLangById(settings.nativeLang ?? 'en').flores;
  const setResult = (txt: string) => {
    if (seq !== translateSeq || pop !== translatePop) return; // veraltet
    const res = pop.querySelector<HTMLElement>('.tp-result');
    if (res) res.textContent = txt;
    positionWordPopover(pop, rect); // Groesse hat sich geaendert -> neu setzen
  };
  ensureTranslatorReady((pct) => {
    if (seq !== translateSeq || pop !== translatePop) return;
    const res = pop.querySelector<HTMLElement>('.tp-result');
    if (res) res.innerHTML = translatorProgressText(pct);
    positionWordPopover(pop, rect);
  })
    .then(() => translator.translate(word, srcLang, tgtLang))
    .then((out) => setResult(out || '—'))
    .catch(() => setResult(t('translate.failed')));
}

// Desktop-Geste: Doppelklick markiert ein Wort -> aus der Auswahl uebersetzen.
function onChatDblClick(e: MouseEvent) {
  const host = (e.target as HTMLElement).closest?.('.msg-text');
  if (!host) return;
  // Auf der letzten eigenen Blase gilt der Klick dem Korrigieren.
  if (host.closest('.msg-editable')) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const word = sel.toString().trim();
  // Nur echte Woerter (mind. ein Buchstabe) und keine ganzen Saetze uebersetzen.
  if (!word || !/\p{L}/u.test(word) || countWords(word) > 4) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  showWordTranslation(word, rect);
}

// Wort unter einem Bildschirmpunkt bestimmen (fuer den Touch-Tipp) und als Range
// zurueckgeben. caretRangeFromPoint (Blink/WebKit) bzw. caretPositionFromPoint
// (Firefox) liefert die Einfuegemarke; von dort nach beiden Seiten bis zur
// Wortgrenze aufweiten.
function wordRangeAtPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  } else if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) { node = p.offsetNode; offset = p.offset; }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? '';
  const isWord = (ch: string) => /[\p{L}\p{N}'’\-]/u.test(ch);
  let start = offset;
  let end = offset;
  while (start > 0 && isWord(text[start - 1])) start--;
  while (end < text.length && isWord(text[end])) end++;
  if (start >= end) return null;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

// Touch-Geste: kurzer Tipp auf ein Wort. Start merken, um Scrollen (Bewegung)
// und langes Halten von einem echten Tipp zu unterscheiden.
let tapStart: { x: number; y: number; t: number } | null = null;

function onChatPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'touch') return;
  tapStart = { x: e.clientX, y: e.clientY, t: Date.now() };
}

function onChatPointerUp(e: PointerEvent) {
  if (e.pointerType !== 'touch' || !tapStart) return;
  const start = tapStart;
  tapStart = null;
  // Verwackelt (Scroll) oder langer Druck? Dann kein Uebersetzungs-Tipp.
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10 || Date.now() - start.t > 500) return;
  const host = (e.target as HTMLElement).closest?.('.msg-text');
  if (!host) return;
  if (host.closest('.msg-editable')) return; // dort korrigiert der Tipp
  const range = wordRangeAtPoint(e.clientX, e.clientY);
  if (!range) return;
  const word = range.toString().trim();
  if (!word || !/\p{L}/u.test(word)) return;
  showWordTranslation(word, range.getBoundingClientRect());
}

// ------------------------------------------------------------ TTS-Pipeline

// epoch = Sprech-Epoche des Aufrufers (s. cancelSpeech). Ein abgebrochener Zug
// liefert nach dem Abbruch noch ein bis zwei Deltas nach (der Abbruch greift
// erst am naechsten Schleifendurchlauf); ohne diese Pruefung landeten dessen
// Saetze in der bereits geleerten Queue und wurden als Anfang der naechsten
// Antwort gesprochen — die "halb alte, halb neue" erste Nachricht.
function enqueueSpeech(text: string, epoch = speechEpoch) {
  if (epoch !== speechEpoch) return;
  const clean = sanitizeForSpeech(text);
  if (!clean) return;
  speechQueue.push(clean);
  refreshComposerLock();
  void pumpSpeech();
}

async function pumpSpeech() {
  if (speechPumpActive || !tts.ready) return;
  speechPumpActive = true;
  const epoch = speechEpoch;
  while (speechQueue.length > 0 && epoch === speechEpoch) {
    const text = speechQueue.shift()!;
    try {
      const { audio, sr } = await tts.speak(text, currentVoice(), settings.speed, ttsLang());
      if (epoch !== speechEpoch) break;
      player.enqueue(audio, sr);
    } catch (err) {
      console.error('TTS-Fehler:', err);
    }
  }
  speechPumpActive = false;
  refreshComposerLock();
  maybeFinishTurn();
}

function cancelSpeech() {
  speechEpoch++;
  speechQueue.length = 0;
  player.stop();
  refreshComposerLock();
}

player.onPlaybackChange = (playing) => {
  refreshComposerLock();
  if (playing) {
    if (orbState === 'thinking' || orbState === 'idle') setOrb('speaking');
  } else {
    maybeFinishTurn();
  }
};

// Ende eines Assistenten-Zugs: Stream fertig, TTS-Queue leer, nichts spielt.
function maybeFinishTurn() {
  if (generating || speechPumpActive || speechQueue.length > 0 || player.isPlaying) return;
  if (orbState !== 'speaking' && orbState !== 'thinking') return;
  setOrb('idle');
  if (settings.autoListen && document.visibilityState === 'visible') {
    // Kurzes Polster gegen das Nachklingen des letzten Tons — dank getrimmter
    // TTS-Stille reicht ein Bruchteil der frueheren Verzoegerung.
    setTimeout(() => {
      if (orbState === 'idle' && modelsReady) void startListening();
    }, 120);
  }
  // Faelliger Einmal-Hinweis wartet auf genau diesen Moment.
  flushEditHint();
}

// ------------------------------------------------------------ LLM-Gespraech

// Reserve neben dem Prompt: die Antwort selbst (max_tokens in llm.ts) plus
// Puffer fuer die Rollen-/Template-Tokens, die das Chat-Template um jede
// Nachricht legt und die unsere Zeichen-Schaetzung nicht sieht.
const REPLY_TOKENS = 220;
const CTX_SAFETY = 160;
// Mindestplatz, der einem angehaengten Dokument NICHT zusteht: die aktuelle
// Nutzernachricht und ein paar Zuege Verlauf muessen immer hineinpassen.
const DOC_MIN_RESERVE = 260;
// Kehrwert von estimateTokens (conversation.ts) — nur fuer die Rueckrechnung
// Token -> Zeichen beim Dokument-Budget.
const CHARS_PER_TOKEN = 3.5;

function buildMessages() {
  const system = {
    role: 'system' as const,
    content: buildSystemPrompt(settings),
  };
  const opt = settings.llmModel ? llmOptionForId(settings.llmModel) : null;

  // Der versteckte Kickoff ("(Begin now. Greet me ...)") hat seinen Zweck
  // erfuellt, sobald der Lerner selbst etwas gesagt hat. Danach ist er nur noch
  // eine Regieanweisung in der user-Rolle mitten im Kontext — genau die Art
  // Text, die kleine Modelle spiegeln. Also raus (nur aus der ans Modell
  // gesendeten Liste; der Verlauf selbst bleibt unangetastet).
  const spoke = history.some((m) => m.role === 'user' && !m.hidden);
  const usable = spoke ? history.filter((m) => !m.hidden) : history;

  // Angehaengtes Dokument und Rollen-Anker direkt an die juengste
  // Nutzernachricht koppeln, statt sie im System-Prompt zu vergraben: kleine
  // lokale Modelle gewichten das zuletzt Gelesene am staerksten. Der Anker
  // steht dabei zuletzt, also unmittelbar am Nutzertext. Wir veraendern nur die
  // ans Modell gesendete Kopie, nicht die angezeigte Blase.
  const anchor = buildTurnAnchor(settings);
  // Dem angehaengten Dokument nur den Platz geben, der neben System-Prompt,
  // Anker und einer Mindestreserve fuer Nutzernachricht + etwas Verlauf uebrig
  // bleibt. Auf 4096-Token-Modellen aendert das nichts (6000 Zeichen passen
  // bequem); auf dem 0.8B wird ehrlich gekuerzt, statt den System-Prompt an den
  // Context-Shift zu verlieren.
  const budget =
    (opt?.nCtx ?? 4096) - REPLY_TOKENS - CTX_SAFETY - estimateTokens(system.content);
  const docChars = Math.floor(
    Math.max(0, budget - estimateTokens(anchor) - DOC_MIN_RESERVE) * CHARS_PER_TOKEN,
  );
  const preamble = buildDocumentPreamble(settings, docChars);
  // Der Anker sagt "die Nachricht unten ist vom Lerner" — an der versteckten
  // Kickoff-Regieanweisung waere das schlicht falsch, also dort nur das
  // Dokument. Der Dokumenttext muss auch im ersten Zug schon dabei sein, sonst
  // kann die KI die Eroeffnungsfrage nicht darauf beziehen.
  const decorate = (content: string, hidden?: boolean) =>
    [preamble, hidden ? '' : anchor, content].filter(Boolean).join('\n\n');

  // History von hinten aufnehmen, bis das Token-Budget erschoepft ist. Frueher
  // stand hier eine reine Nachrichten-Anzahl (historyTurns) — ein schlechter
  // Proxy, denn ein Lerner mit langen Saetzen sprengt das Fenster trotz
  // korrekter Zaehlung. Passiert das, verwirft llama.cpps ctx_shift die
  // aeltesten Tokens: den System-Prompt. Das Modell verliert dann mitten im
  // Gespraech seine Rolle. historyTurns bleibt als zusaetzliche Obergrenze.
  const maxTurns = opt?.historyTurns ?? 16;
  const recent: { role: 'user' | 'assistant'; content: string }[] = [];
  let used = 0;
  let decorated = false; // Anker/Dokument nur an die JUENGSTE Nutzernachricht
  for (let i = usable.length - 1; i >= 0 && recent.length < maxTurns; i--) {
    const m = usable[i];
    const content =
      !decorated && m.role === 'user'
        ? ((decorated = true), decorate(m.content, m.hidden))
        : m.content;
    const cost = estimateTokens(content);
    // Die juengste Nachricht kommt immer mit, auch wenn sie allein das Budget
    // reisst — ohne sie gaebe es nichts zu antworten.
    if (used + cost > budget && recent.length > 0) break;
    recent.unshift({ role: m.role, content });
    used += cost;
  }
  return [system, ...recent];
}

// Alle LLM-Laeufe strikt nacheinander ausfuehren — zwei ueberlappende
// Anfragen bringen die Engine aus dem Tritt (keine Antwort mehr). Wer
// vorgelassen werden will, bricht den laufenden Lauf ueber dessen
// Abort-Flag ab und reiht sich dann ein.
function chained(task: () => Promise<void>): Promise<void> {
  const previous = activeTurn;
  const run = (async () => {
    if (previous) await previous.catch(() => {});
    await task();
  })();
  activeTurn = run;
  return run;
}

// Harte Sicherheitsgrenze zusaetzlich zur Prompt-Regel ("1-3 Saetze + Frage"):
// faengt nur echtes Abschweifen kleiner Modelle ab, schneidet aber bewusst
// grosszuegig oberhalb der Norm, um normkonforme Antworten nie abzuschneiden.
const HARD_SENTENCE_CAP = 5;
const SENTENCE_END = /[.!?…।]["')\]]?$/;
// Letzte Satzgrenze im Text (dieselben Endzeichen wie SENTENCE_END, inkl. des
// Devanagari-Danda) — fuer trimToSentence.
const LAST_SENTENCE_END = /[.!?…।]["')\]]?(?=\s|$)/g;

// Schneidet einen Text auf den letzten vollstaendigen Satz zurueck. Endet er
// bereits sauber (Normalfall), bleibt er unveraendert. Findet sich ueberhaupt
// keine Satzgrenze — eine einzige lange, abgeschnittene Aussage —, geben wir
// den Text unveraendert zurueck: ein leerer Verlaufseintrag waere schlimmer.
function trimToSentence(text: string): string {
  const t = text.trim();
  if (SENTENCE_END.test(t)) return t;
  let end = -1;
  for (const m of t.matchAll(LAST_SENTENCE_END)) end = m.index + m[0].length;
  return end > 0 ? t.slice(0, end) : t;
}

async function assistantTurn() {
  // Abbruch-Flag und Gespraechs-Epoche SYNCHRON beim Aufruf festhalten, nicht
  // erst im chained()-Rumpf. Zwischen Einreihen und Start des Zugs kann ein
  // weiterer Gespraechsstart liegen (zwei schnelle Klicks auf "neu starten",
  // Szenario- und Niveauwechsel kurz hintereinander, Persona -> Sprachwechsel).
  // Stand genAbort erst im Rumpf, zeigte es bis dahin noch auf den VORIGEN Zug:
  // der wartende Zug war schlicht nicht abbrechbar und lief danach mit voller
  // Antwort in das frisch geleerte Gespraech hinein.
  const abort = { aborted: false };
  genAbort = abort;
  const epoch = convEpoch;
  await chained(async () => {
    // Ueberholt? Dann gar nicht erst anfangen — keine Blase, kein Ton.
    if (abort.aborted || epoch !== convEpoch) return;
    // History-Referenz festhalten: Wird das Gespraech waehrend des Streams
    // ersetzt (neues Gespraech), landet der Resttext im alten Verlauf statt
    // im frischen.
    const hist = history;
    // Sprech-Epoche dieses Zugs: alles, was nach einem cancelSpeech() noch
    // nachtroepfelt, wird von enqueueSpeech verworfen.
    const voice = speechEpoch;
    setGenerating(true);
    setOrb('thinking');

    const typingEl = appendMessage('assistant');
    const textEl = typingEl?.querySelector<HTMLElement>('.msg-text') ?? null;
    if (typingEl && textEl) {
      typingEl.classList.add('msg-typing');
      textEl.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    }

    let full = '';
    let buffer = '';
    let firstToken = true;
    // Bis zum ersten gesprochenen Schnipsel aggressiv splitten (Komma oder
    // Wortgrenze reicht), damit die Stimme startet, waehrend der Text noch
    // geschrieben wird.
    let spokeFirstChunk = false;
    // Sicherheitsnetz (s. containsUnsafeContent in conversation.ts) hat
    // zugeschlagen: Generierung stoppen, Rest der Antwort verwerfen.
    let redirected = false;
    // Zaehlt nur echte Satzenden (s. HARD_SENTENCE_CAP oben).
    let sentenceCount = 0;
    const currentOpt = settings.llmModel ? llmOptionForId(settings.llmModel) : null;

    try {
      for await (const delta of llm.chat(buildMessages() as any, abort, currentOpt?.sampling)) {
        if (abort.aborted) break;
        if (firstToken) {
          typingEl?.classList.remove('msg-typing');
          if (textEl) textEl.textContent = '';
          firstToken = false;
        }
        buffer += delta;
        const { complete, rest } = splitIncremental(buffer, !spokeFirstChunk);
        buffer = rest;
        if (complete.length > 0) spokeFirstChunk = true;
        // Satzweise geprueft: das ist die fruehestmoegliche Einheit, an der
        // sich ein gefaehrlicher Vorschlag noch abfangen laesst, bevor er
        // gesprochen oder dauerhaft angezeigt wird (s. SAFETY_RULE-Kommentar).
        for (const sentence of complete) {
          if (containsUnsafeContent(sentence)) {
            const redirect = safeRedirectLine(settings.targetLang);
            full = (full + ' ' + redirect).trim();
            enqueueSpeech(redirect, voice);
            redirected = true;
            abort.aborted = true;
            break;
          }
          full = (full + ' ' + sentence).trim();
          enqueueSpeech(sentence, voice);
          if (SENTENCE_END.test(sentence)) sentenceCount++;
          if (sentenceCount >= HARD_SENTENCE_CAP) {
            abort.aborted = true;
            break;
          }
        }
        if (textEl) {
          textEl.textContent = redirected ? full : (full + (buffer ? (full ? ' ' : '') + buffer : ''));
          scrollChat();
        }
        if (redirected || abort.aborted) break;
      }
      if (!redirected && !abort.aborted && buffer.trim()) {
        if (containsUnsafeContent(buffer)) {
          const redirect = safeRedirectLine(settings.targetLang);
          full = (full + ' ' + redirect).trim();
          enqueueSpeech(redirect, voice);
        } else {
          full = (full + ' ' + buffer).trim();
          enqueueSpeech(buffer, voice);
        }
        if (textEl) textEl.textContent = full;
      }
    } catch (err: any) {
      console.error(err);
      // Absichtliches Unterbrechen (Barge-in) ist kein Fehler.
      if (!abort.aborted) toast(t('toast.answerFail', { err: err?.message ?? err }), true);
      typingEl?.remove();
    }

    if (full.trim()) {
      // In die History nur bis zur letzten Satzgrenze: greift HARD_SENTENCE_CAP
      // (oder ein Barge-in), endet `full` mitten im Satz. Als eigener Verlauf
      // gelesen bringt so ein Fragment dem Modell bei, dass Antworten abreissen
      // duerfen — und verwirrt es im naechsten Zug. Gesprochen und angezeigt
      // bleibt der volle Text; nur die Modell-Sicht wird sauber abgeschlossen.
      hist.push({ role: 'assistant', content: trimToSentence(full) });
      if (typingEl?.isConnected) addAssistantActions(typingEl, full);
    } else if (typingEl?.isConnected && firstToken) {
      typingEl.remove();
    }
    setGenerating(false);
    // Nur fuer den aktuellen Zug abschliessen: gehoert dieser hier schon zum
    // abgeloesten Gespraech, wuerde maybeFinishTurn() das Auto-Zuhoeren starten,
    // waehrend die Begruessung des neuen Gespraechs noch in der Warteschlange
    // steht — das Mikro liefe dann gegen die eigene Stimme.
    if (epoch === convEpoch) maybeFinishTurn();
  });
}

// -------------------------------------------------- Unterstuetzungs-Erinnerung
// LocalSpeech ist komplett kostenlos. Statt Paywall gibt es eine gelegentliche,
// freundliche Erinnerung ans Unterstuetzen — Foundation-Muster (Wikipedia & Co.):
// kein Druck, jederzeit wegklickbar; wer schon unterstuetzt, sieht sie nie wieder.
// Der CTA fuehrt zur On-Site-Zahlung (#unterstuetzen), nicht mehr zu einem
// externen Dienst.

// Frueh genug fuer echtes Engagement, spaet genug, dass niemand beim ersten
// Ausprobieren gefragt wird.
const DONATE_MIN_TURNS = 12;
// Mindestabstand zwischen zwei Erinnerungen, falls "Vielleicht später" gewaehlt wird.
const DONATE_COOLDOWN_MS = 6 * 24 * 60 * 60 * 1000;
let supportTurns = 0;

function shouldShowDonatePrompt(): boolean {
  // Globaler Not-Aus: keine Erinnerung, wenn es gar nichts zu unterstuetzen gibt.
  if (!SUPPORT_ENABLED) return false;
  if (settings.supporter) return false;
  if (supportTurns < DONATE_MIN_TURNS) return false;
  if (settings.donatePromptAt && Date.now() - settings.donatePromptAt < DONATE_COOLDOWN_MS) return false;
  return true;
}

function openDonateModal() {
  settings.donatePromptAt = Date.now();
  saveSettings(settings);
  $('#donate-modal').hidden = false;
}

function closeDonateModal() {
  $('#donate-modal').hidden = true;
}

// Nach etwas Nutzung (nie beim allerersten Zug) und mit Abstand zur letzten
// Erinnerung: kurz nach dem Zug einmal freundlich nachfragen.
function maybeShowDonatePrompt() {
  if (!shouldShowDonatePrompt()) return;
  setTimeout(() => {
    if (shouldShowDonatePrompt() && !isBusy()) openDonateModal();
  }, 4000);
}

// "Ich unterstuetze schon" oder Klick auf den Unterstuetzen-CTA: Erinnerung
// dauerhaft stumm schalten und kurz bedanken.
function markSupporter() {
  settings.supporter = true;
  saveSettings(settings);
  closeDonateModal();
  toast(t('donatePrompt.thanks'));
}

function userTurn(text: string, spoken = false) {
  if (!modelsReady || generating) return;
  // Steht eine Nachricht zur Korrektur offen, ist das hier der zweite Versuch —
  // er ersetzt sie, statt eine weitere Blase anzuhaengen. Gesprochenes geht
  // dabei NICHT von selbst raus: es landet erst im Feld, abgeschickt wird per
  // Knopf. Sonst wuerde ein zweiter Verhoerer direkt wieder durchrutschen.
  if (editingEl && editableMsg) {
    if (spoken) fillCorrection(text);
    else applyCorrection(text);
    return;
  }
  cancelSpeech();
  conversationStarted = true;
  // Nach dem Anhaengen einmalig den Datei-Chip an der Nachricht zeigen — das
  // Dokument bleibt danach als persistenter Kontext aktiv (Chip in der Leiste).
  const badge = pendingDocBadge;
  pendingDocBadge = null;
  const userEl = appendMessage('user', text, badge ?? undefined);
  const msg: ChatMessage = { role: 'user', content: text };
  history.push(msg);
  // Antippbar ist immer nur die neue, jetzt letzte eigene Nachricht.
  setEditable(userEl, msg);
  void assistantTurn();
  // Nutzung zaehlen, einmalig die Korrektur-Geste zeigen und ggf. freundlich
  // ans Unterstuetzen erinnern.
  supportTurns++;
  maybeShowEditHint();
  maybeShowDonatePrompt();
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// Gemeinsamer Kern: laufende Ausgabe abbrechen, Chat leeren, mit dem gegebenen
// (versteckten) Kickoff die erste KI-Antwort ausloesen.
function launchConversation(kickoff: string) {
  // Epoche zuerst hochzaehlen: ab hier gehoert alles, was noch aus dem alten
  // Gespraech nachlaeuft (Rest-Deltas, ein bereits eingereihter Zug), zur
  // Vergangenheit und wird von assistantTurn/enqueueSpeech verworfen.
  convEpoch++;
  cancelSpeech();
  genAbort.aborted = true;
  llm.interrupt();
  cancelEditMode(); // offener Editor gehoert zum alten Gespraech
  clearEditable();
  conversationStarted = true;
  // Mikro schon jetzt (waehrend die KI begruesst) vorwaermen, damit der erste
  // eigene Zug ohne Einschwing-Verzoegerung sofort scharf ist.
  if (settings.autoListen) void recorder.warm().catch(() => {});
  history = [{ role: 'user', content: kickoff, hidden: true }];
  $('#chat').innerHTML = '';
  setGenerating(false);
  void assistantTurn();
}

// Normales Tutor-/Legenden-Gespraech starten — bei Szenario-/Legendenwechsel,
// "neu starten" usw.
function startConversation() {
  // Neues Gespraech = neue Themen-/Fakten-Auswahl im Charakterblatt. Bewusst
  // nur HIER: innerhalb eines Gespraechs muss der System-Prompt Zeichen fuer
  // Zeichen gleich bleiben, sonst prefillt llama.cpp in jedem Zug neu.
  newConversationSeed();
  // buildKickoffPrompt zieht den Eroeffnungs-Aufhaenger zufaellig und merkt ihn
  // in settings.lastOpener — persistieren, damit der naechste Start (auch nach
  // einem Neuladen) einen anderen zieht.
  const kickoff = buildKickoffPrompt(settings);
  saveSettings(settings);
  launchConversation(kickoff);
}

// ---------------------------------------------------- Datei-/Kontext-Upload
// Der Nutzer haengt eine Textdatei an; ihr Inhalt wandert in den System-Prompt
// (siehe conversation.ts), damit die KI im Gespraech darueber sprechen kann.
const MAX_CONTEXT_CHARS = 6000;

// Name der zuletzt angehaengten Datei, der bei der naechsten Nutzernachricht als
// Chip in der Blase erscheint (siehe userTurn). Danach wieder null.
let pendingDocBadge: string | null = null;

function renderContextChip() {
  const doc = settings.contextDoc;
  $('#btn-attach').classList.toggle('has-file', !!doc);
  if (!doc) {
    $('#context-bar').hidden = true;
    return;
  }
  $('#context-name').textContent = doc.name;
  $('#context-bar').hidden = false;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function attachFile(file: File) {
  let text = '';

  if (isPdf(file)) {
    // PDFs: Text offline über pdfjs herausziehen. Kann bei vielen Seiten kurz
    // dauern — deshalb ein Hinweis-Toast, und pdfjs wird erst hier nachgeladen.
    toast(t('context.reading', { name: file.name }));
    try {
      const { extractPdfText } = await import('./lib/pdf');
      text = await extractPdfText(file, MAX_CONTEXT_CHARS);
    } catch {
      toast(t('context.pdfFailed'), true);
      return;
    }
    if (!text.trim()) {
      // Reine Scan-PDFs ohne Textebene liefern nichts — ehrlich melden.
      toast(t('context.pdfNoText'), true);
      return;
    }
    settings.contextDoc = { name: file.name, text };
    pendingDocBadge = file.name;
    saveSettings(settings);
    renderContextChip();
    toast(t('context.added', { name: file.name }));
    return;
  }

  try {
    // Nur den Anfang lesen — grosse Dateien nicht komplett in den Speicher laden.
    text = await file.slice(0, 400_000).text();
  } catch {
    toast(t('context.notText'), true);
    return;
  }
  // Binaerdateien (Bilder …) ergeben beim Text-Lesen unbrauchbaren Salat —
  // grob am Anteil an Steuer-/Ersatzzeichen erkennen und ablehnen.
  const sample = text.slice(0, 2000);
  const junk = (sample.match(/[\u0000-\u0008\u000E-\u001F\uFFFD]/g) ?? []).length;
  if (!text.trim() || junk > sample.length * 0.02) {
    toast(t('context.notText'), true);
    return;
  }
  if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS);
  settings.contextDoc = { name: file.name, text };
  pendingDocBadge = file.name;
  saveSettings(settings);
  renderContextChip();
  toast(t('context.added', { name: file.name }));
}

function removeContext() {
  settings.contextDoc = null;
  pendingDocBadge = null;
  saveSettings(settings);
  renderContextChip();
}

// --------------------------------------------------------------- Aufnahme

async function startListening() {
  if (!modelsReady || recorder.recording) return;
  // Ist die Kugel ausgeblendet (= stummgeschaltet), bleibt das Mikro zu.
  if ($('#orb-stage').hidden) return;
  cancelSpeech();
  try {
    await recorder.start({
      onLevel: (rms) => {
        const level = Math.min(1, rms * 7);
        orbEl().style.setProperty('--level', String(level));
        orbGl?.setLevel(level);
        avatar?.setMicLevel(level);
      },
      onAutoStop: () => void stopAndProcess(true),
    });
    setOrb('listening');
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      toast(t('toast.micDenied'), true);
    } else {
      toast(t('toast.micErr', { err: err?.message ?? err }), true);
    }
    setOrb('idle');
  }
}

// Das Mikro ist waehrend einer laufenden Aufnahme von aussen verschwunden
// (Geraet getrennt, OS-Berechtigung entzogen, ein anderer Prozess uebernimmt
// es exklusiv) — ohne diesen Haken bliebe die Kugel im "listening"-Zustand
// haengen, obwohl nichts mehr aufgenommen wird. Im Freihandmodus versuchen
// wir automatisch neu zu starten, statt den Nutzer stumm sitzen zu lassen.
recorder.onDeviceLost = () => {
  orbEl().style.setProperty('--level', '0');
  setOrb('idle');
  toast(t('toast.micLost'), true);
  const muted = $('#orb-stage').hidden;
  if (settings.autoListen && document.visibilityState === 'visible' && !muted && modelsReady) {
    setTimeout(() => {
      if (orbState === 'idle' && modelsReady) void startListening();
    }, 500);
  }
};
// DEV-Testhaken (in PROD entfernt): simuliert einen Mikrofon-Verlust waehrend
// der Aufnahme, ohne echtes Geraet abklemmen zu muessen — fuer die
// Browser-Verifikation der Freihand-Wiederanlauf-Logik.
if (import.meta.env.DEV) {
  (window as any).__loseMic = () => recorder.onDeviceLost?.();
  // Schiebt ein Transkript genau dort in den Zug, wo es stopAndProcess nach
  // dem Sprechen tut (Chromiums Fake-Mikro loest die Sprach-Erkennung im
  // Headless-Betrieb nicht zuverlaessig aus).
  (window as any).__spoken = (text: string) => userTurn(text, true);
}

// Wurde keine klare Stimme aufgenommen, wird NICHTS an die KI geschickt und
// keine Fehlermeldung gezeigt. Bei automatischem Stopp bleibt das Mikro offen
// (neu starten), sodass es einfach weiter zuhoert, bis wirklich gesprochen wird.
function quietNoSpeech(auto: boolean) {
  setOrb('idle');
  const muted = $('#orb-stage').hidden;
  if (auto && settings.autoListen && document.visibilityState === 'visible' && !muted) {
    setTimeout(() => {
      if (orbState === 'idle' && modelsReady) void startListening();
    }, 120);
  }
}

async function stopAndProcess(auto = false) {
  if (!recorder.recording) return;
  setOrb('transcribing');
  orbEl().style.setProperty('--level', '0');
  try {
    const hadSpeech = recorder.hasSpeech;
    const audio = await recorder.stop();
    if (!hadSpeech || audio.length < 8000) {
      quietNoSpeech(auto);
      return;
    }
    const text = await stt.transcribe(audio, target().whisper);
    // Zu wenig Buchstaben (Unicode-bewusst — auch Devanagari etc.) = Rauschen.
    if (!text || (text.match(/\p{L}/gu) ?? []).length < 2) {
      quietNoSpeech(auto);
      return;
    }
    userTurn(text, true);
  } catch (err: any) {
    console.error(err);
    toast(t('toast.sttFail', { err: err?.message ?? err }), true);
    setOrb('idle');
  }
}

function onOrbClick() {
  switch (orbState) {
    case 'idle':
      // Erster Klick nach dem Laden: Gespraech (mit hoerbarer Begruessung)
      // starten — der Klick liefert die noetige Nutzer-Geste fuers Audio.
      if (!conversationStarted) startConversation();
      else void startListening();
      break;
    case 'listening':
      void stopAndProcess();
      break;
    case 'speaking':
    case 'thinking':
      // Barge-in: KI unterbrechen und selbst sprechen.
      genAbort.aborted = true;
      llm.interrupt();
      cancelSpeech();
      setGenerating(false);
      void startListening();
      break;
    default:
      break;
  }
}

// -------------------------------------------------------- Modelle laden

interface ProgressSinks {
  llm: (pct: number, text?: string) => void;
  stt: (pct: number) => void;
  tts: (pct: number) => void;
}

async function loadAllModels(sinks: ProgressSinks): Promise<void> {
  if (!hw) throw new Error('Hardware unbekannt');
  const llmOpt = settings.llmModel ? llmOptionForId(settings.llmModel) : null;
  if (!llmOpt) throw new Error('Kein Modell gewaehlt');
  const sttDevice: 'webgpu' | 'wasm' = hw.webgpu ? 'webgpu' : 'wasm';

  await Promise.all([
    llm.load(llmOpt, (p) => sinks.llm(p.pct, p.text), hw.webgpu),
    stt.load(settings.sttModel, sttDevice, target().whisper, (p) => sinks.stt(p.pct)),
    tts.load(hw.webgpu, currentVoice(), ttsLang(), (p) => sinks.tts(p.pct)),
  ]);

  void requestPersistentStorage();
  modelsReady = true;
  const opt = settings.llmModel ? llmOptionForId(settings.llmModel) : null;
  const chip = $('#status-chip');
  chip.textContent = t('status.ready', { model: opt?.name ?? 'Modell' });
  chip.classList.add('ready');
  setOrb('idle');
}

// ------------------------------------------------ Nicht-blockierendes Laden
//
// Der Download blockiert die App nicht mehr: Fortschritt laeuft kompakt im
// Status-Chip und (beim Erst-Download) in der schwebenden Pille, waehrend die
// gefuehrte Tour die Wartezeit zum Kennenlernen der App nutzt.

let activeTour: TourHandle | null = null;
// Modelle wurden fertig, waehrend die Tour noch lief: Begruessung erst nach
// Tour-Ende starten, damit der Tutor nicht in die Erklaerung hineinredet.
let readyPending = false;

const TOUR_STEPS: TourStep[] = [
  { target: '#dl-pill', titleKey: 'tour.intro.title', bodyKey: 'tour.intro.body', placement: 'top' },
  { target: '#orb-wrap', titleKey: 'tour.orb.title', bodyKey: 'tour.orb.body' },
  { target: '#orb-hint', titleKey: 'tour.speech.title', bodyKey: 'tour.speech.body' },
  { target: '#btn-personas', titleKey: 'tour.personas.title', bodyKey: 'tour.personas.body' },
  { target: '#btn-settings', titleKey: 'tour.settings.title', bodyKey: 'tour.settings.body' },
];

// Uebergabe an das echte Erlebnis, sobald Modelle bereit UND die Tour vorbei ist.
// Vor dem allerersten echten Gespraech steht noch der KI-/Haftungshinweis —
// erst nach dessen Bestaetigung startet die Konversation wirklich.
function finishHandoff() {
  $('#dl-pill').hidden = true;
  toast(t('toast.allReady'));
  setOrb('idle', t('orb.ready', { tutor: tutorName() }));
  if (!settings.disclaimerSeen) {
    $('#disclaimer-modal').hidden = false;
    return;
  }
  onModelsReady();
}

function startFirstRunTour() {
  if (activeTour?.active()) return;
  activeTour = startTour(TOUR_STEPS, {
    onDone: () => {
      activeTour = null;
      settings.tourSeen = true;
      saveSettings(settings);
      if (readyPending) {
        readyPending = false;
        finishHandoff();
      }
    },
  });
}

async function loadModelsWithProgress(opts: { pill: boolean }): Promise<void> {
  const chip = $('#status-chip');
  chip.classList.remove('ready');
  const pill = $('#dl-pill');
  const pillText = $('#dl-pill-text');
  const retryBtn = $('#dl-pill-retry') as unknown as HTMLButtonElement;
  const ring = document.querySelector<SVGCircleElement>('#dl-pill .ring-val');
  if (opts.pill) {
    pill.classList.remove('ready', 'error');
    retryBtn.hidden = true;
    pill.hidden = false;
  }
  const pcts = { llm: 0, stt: 0, tts: 0 };
  let cached = false;
  const cachedOpt = settings.llmModel ? llmOptionForId(settings.llmModel) : null;
  if (cachedOpt) cached = await LLMEngine.isCached(cachedOpt.url);
  const update = () => {
    const avg = Math.round((pcts.llm + pcts.stt + pcts.tts) / 3);
    chip.textContent = t(cached ? 'status.loadingCached' : 'status.loading', { pct: avg });
    if (opts.pill) {
      pillText.textContent = t('pill.loading', { pct: avg });
      ring?.setAttribute('stroke-dashoffset', String(100 - avg));
    }
  };
  update();
  try {
    await loadAllModels({
      llm: (pct) => { pcts.llm = pct; update(); },
      stt: (pct) => { pcts.stt = pct; update(); },
      tts: (pct) => { pcts.tts = pct; update(); },
    });
    if (activeTour?.active()) {
      // Nicht in die Tour platzen: Pille signalisiert leise "bereit".
      pill.classList.add('ready');
      pillText.textContent = t('pill.ready');
      readyPending = true;
    } else {
      finishHandoff();
    }
  } catch (err: any) {
    console.error(err);
    chip.textContent = t('status.error');
    if (opts.pill) {
      pill.classList.add('error');
      pillText.textContent = t('pill.error');
      retryBtn.hidden = false;
    }
    toast(t('setup.errDl', { err: err?.message ?? err }), true);
  }
}

// Laden beim Wiederbesuch. Wurde die Tour noch nie zu Ende gesehen (Tab mitten
// im Erst-Download geschlossen), laeuft sie beim Resume erneut mit Pille.
async function loadModelsViaChip() {
  const firstRun = !settings.tourSeen;
  const loading = loadModelsWithProgress({ pill: firstRun });
  if (firstRun) startFirstRunTour();
  await loading;
}

// -------------------------------------------------------------- Setup-UI

let setupSelectedId: string | null = null;
let setupSelectedStt: string | null = null;

// Nach einem Sprachwechsel alle dynamisch gesetzten Texte nachziehen.
function refreshDynamicTexts() {
  fillHeaderSelects();
  updatePersonaHeader();
  setOrb(orbState);
  // CTA + Empfehlungs-Karte im Setup tragen dynamische Texte (Groesse etc.)
  if (!$('#setup').hidden && !$('#setup-step-choose').hidden) updateSetupTotal();
  if (modelsReady) {
    const opt = settings.llmModel ? llmOptionForId(settings.llmModel) : null;
    $('#status-chip').textContent = t('status.ready', { model: opt?.name ?? 'Modell' });
  }
}

// Schritt 1 der Einrichtung: Muttersprache + Lernsprache + Name des Partners.
function renderLangGrids() {
  if (!settings.nativeLang) settings.nativeLang = 'en';
  if (settings.targetLang === settings.nativeLang) {
    settings.targetLang = fallbackTarget(settings.nativeLang);
    settings.voice = target().defaultVoice;
  }

  // Namensfeld: Platzhalter zeigt die Standard-Persona der Lernsprache.
  const nameInput = $('#setup-tutor-name') as unknown as HTMLInputElement;
  nameInput.placeholder = target().tutor;
  nameInput.value = settings.tutorName ?? '';

  const nativeGrid = $('#native-grid');
  nativeGrid.innerHTML = '';
  for (const l of NATIVE_LANGS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `lang-chip${l.id === settings.nativeLang ? ' selected' : ''}`;
    btn.innerHTML = `<span class="lc-flag">${l.flag}</span><span>${l.name}</span>`;
    btn.addEventListener('click', () => {
      settings.nativeLang = l.id;
      if (settings.targetLang === l.id) {
        settings.targetLang = fallbackTarget(l.id);
        settings.voice = target().defaultVoice;
      }
      saveSettings(settings);
      applyUILang();
      refreshDynamicTexts();
      renderLangGrids();
    });
    nativeGrid.appendChild(btn);
  }

  const targetGrid = $('#target-grid');
  targetGrid.innerHTML = '';
  for (const l of TARGET_LANGS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `lang-chip${l.id === settings.targetLang ? ' selected' : ''}`;
    btn.disabled = l.id === settings.nativeLang;
    btn.innerHTML = `<span class="lc-flag">${l.flag}</span><span>${l.name}</span>`;
    btn.addEventListener('click', () => {
      settings.targetLang = l.id;
      settings.voice = l.defaultVoice;
      saveSettings(settings);
      applyUILang(); // im Immersions-Modus folgt die Oberflaeche der Lernsprache
      refreshDynamicTexts();
      renderLangGrids();
    });
    targetGrid.appendChild(btn);
  }
}

function renderSetup() {
  renderLangGrids();
  $('#setup-step-lang').hidden = false;
  $('#setup-step-choose').hidden = true;
  $('#setup').hidden = false;
}

// Schritt 2 der Einrichtung: Modellwahl passend zur Hardware.
// Farbe fuer die Qualitaets-Skala: Index 0 = rot (schwaechstes Modell),
// letzter Index = gruen (bestes). Dazwischen linear ueber den Farbton.
function qualityColor(index: number, total: number): string {
  const f = total > 1 ? index / (total - 1) : 1;
  const hue = 8 + f * 122; // ~8° rot -> ~130° gruen
  return `hsl(${Math.round(hue)}, 68%, 48%)`;
}

function renderModelStep() {
  if (!hw) return;
  $('#hw-summary').textContent = t('setup.hw', { desc: describeHardware(hw), tier: tierLabel(hw.tier) });
  $('#weak-device-warning').hidden = !isWeakDevice(hw);

  const cards = $('#tier-cards');
  cards.innerHTML = '';
  if (!setupSelectedId) setupSelectedId = hw.recommendedLLM;
  const llmOpts = llmOptionsForTier(hw);
  llmOpts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tier-card';
    // Qualitaets-Skala: rot (schwaechstes Modell) -> gruen (bestes). Nicht
    // machbare Modelle bleiben ausgegraut, damit der User die gruenste noch
    // passende Option fuer sein Geraet erkennt.
    btn.style.setProperty('--q-color', qualityColor(i, llmOpts.length));
    if (!opt.feasible) btn.classList.add('infeasible');
    if (opt.id === setupSelectedId) btn.classList.add('selected');
    btn.innerHTML = `
      <span class="tc-quality"></span>
      <div class="tc-info">
        <div class="tc-name">${opt.name}
          ${opt.recommended ? `<span class="badge">${t('badge.recommended')}</span>` : ''}
          ${!opt.feasible ? `<span class="badge badge-outline">${t('badge.tooBig')}</span>` : ''}
        </div>
        <div class="tc-desc">${t(opt.descKey)}</div>
      </div>
      <div class="tc-size">⬇ ${fmtGB(opt.dlSizeMB)}</div>`;
    btn.addEventListener('click', () => {
      setupSelectedId = opt.id;
      cards.querySelectorAll('.tier-card').forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      updateSetupTotal();
    });
    cards.appendChild(btn);
  });

  const sttWrap = $('#stt-options');
  sttWrap.innerHTML = '';
  if (!setupSelectedStt) setupSelectedStt = hw.recommendedStt;
  for (const opt of STT_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tier-card';
    if (opt.id === setupSelectedStt) btn.classList.add('selected');
    btn.innerHTML = `
      <div class="tc-info">
        <div class="tc-name">${opt.name}${opt.id === hw.recommendedStt ? ` <span class="badge">${t('badge.recommended')}</span>` : ''}</div>
        <div class="tc-desc">${t(opt.descKey)}</div>
      </div>
      <div class="tc-size">⬇ ${fmtGB(opt.dlSizeMB)}</div>`;
    btn.addEventListener('click', () => {
      setupSelectedStt = opt.id;
      sttWrap.querySelectorAll('.tier-card').forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      updateSetupTotal();
    });
    sttWrap.appendChild(btn);
  }

  updateSetupTotal();
  $('#setup-step-lang').hidden = true;
  $('#setup-step-choose').hidden = false;
}

function updateSetupTotal() {
  const llmOpt = LLM_OPTIONS.find((o) => o.id === setupSelectedId);
  const sttOpt = STT_OPTIONS.find((o) => o.id === setupSelectedStt);
  const ttsSize = hw?.webgpu ? TTS_SIZE_WEBGPU_MB : TTS_SIZE_MB;
  const total = (llmOpt?.dlSizeMB ?? 0) + (sttOpt?.dlSizeMB ?? 0) + ttsSize;
  $('#setup-total').innerHTML = t('setup.total', { size: fmtGB(total) });
  // Empfehlungs-Karte + CTA spiegeln die aktuelle Auswahl (Default: die
  // Hardware-Empfehlung; weicht der User unter "Erweitert" ab, seine Wahl).
  if (llmOpt) {
    $('#reco-name').textContent = llmOpt.name;
    $('#reco-desc').textContent = t(llmOpt.descKey);
    $('#reco-size').textContent = `⬇ ${fmtGB(llmOpt.dlSizeMB)}`;
  }
  $('#btn-download').textContent = t('setup.startDownload', { size: fmtGB(total) });
}

async function onSetupDownload() {
  if (!hw || !setupSelectedId || !setupSelectedStt) return;
  $('#setup-error').hidden = true;
  const btn = $('#btn-download') as unknown as HTMLButtonElement;
  btn.disabled = true;
  settings.llmModel = setupSelectedId;
  settings.sttModel = setupSelectedStt;
  settings.setupDone = true;
  saveSettings(settings);

  // Nicht mehr blockieren: Setup schliessen, die echte App zeigen und die
  // Tour starten — der Download laeuft sichtbar in der Pille weiter.
  $('#setup').hidden = true;
  btn.disabled = false;
  // Erst laden (blendet die Pille synchron ein), dann Tour starten — der
  // Intro-Schritt der Tour zeigt auf die Pille und braucht sie sichtbar.
  const loading = loadModelsWithProgress({ pill: true });
  startFirstRunTour();
  await loading;
}

// -------------------------------------------------------- Einstellungen

function renderVoiceSelect() {
  const voiceSel = $('#voice-select') as unknown as HTMLSelectElement;
  voiceSel.innerHTML = '';
  for (const v of target().voices) {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = v.name;
    voiceSel.appendChild(o);
  }
  if (!target().voices.some((v) => v.id === settings.voice)) {
    settings.voice = target().defaultVoice;
    saveSettings(settings);
  }
  voiceSel.value = settings.voice;
}

function renderLanguageSelects() {
  const nativeSel = $('#native-select') as unknown as HTMLSelectElement;
  nativeSel.innerHTML = '';
  for (const l of NATIVE_LANGS) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = `${l.flag} ${l.name}`;
    nativeSel.appendChild(o);
  }
  nativeSel.value = settings.nativeLang ?? detectNativeLang();

  const targetSel = $('#target-select') as unknown as HTMLSelectElement;
  targetSel.innerHTML = '';
  for (const l of TARGET_LANGS) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = `${l.flag} ${l.name}`;
    o.disabled = l.id === settings.nativeLang;
    targetSel.appendChild(o);
  }
  targetSel.value = settings.targetLang;
}

async function renderSettingsModal() {
  renderLanguageSelects();
  renderVoiceSelect();

  ($('#ui-in-target') as unknown as HTMLInputElement).checked = settings.uiInTarget;
  const nameInput = $('#tutor-name-input') as unknown as HTMLInputElement;
  nameInput.placeholder = target().tutor;
  nameInput.value = settings.tutorName ?? '';

  const speed = $('#speed-range') as unknown as HTMLInputElement;
  speed.value = String(settings.speed);
  $('#speed-value').textContent = `${settings.speed.toFixed(2)}×`;

  const sttSel = $('#stt-select') as unknown as HTMLSelectElement;
  sttSel.innerHTML = '';
  for (const o of STT_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = `${o.name} (${fmtGB(o.dlSizeMB)})`;
    sttSel.appendChild(opt);
  }
  sttSel.value = settings.sttModel;

  await renderModelList();

  const est = await storageEstimate();
  $('#storage-info').textContent = est
    ? t('settings.storage', { used: fmtGB(est.usedMB), quota: fmtGB(est.quotaMB) })
    : '';

  $('#settings-modal').hidden = false;
}

async function renderModelList() {
  if (!hw) return;
  const list = $('#model-list');
  list.innerHTML = '';
  for (const opt of LLM_OPTIONS) {
    const cached = await LLMEngine.isCached(opt.url);
    const active = opt.id === settings.llmModel;
    const row = document.createElement('div');
    row.className = `model-row${active ? ' active' : ''}`;
    row.innerHTML = `
      <span class="mr-name">${opt.name} ${active ? `<span class="badge">${t('model.active')}</span>` : ''}</span>
      <span class="mr-meta">${cached ? t('model.loaded') : fmtGB(opt.dlSizeMB)}</span>`;
    // Knoepfe in einer eigenen Gruppe: auf schmalen Displays rutscht sie als
    // Ganzes in die zweite Zeile, statt dass "Nutzen" und "Loeschen" einzeln
    // an verschiedenen Stellen umbrechen.
    const actions = document.createElement('div');
    actions.className = 'mr-actions';
    if (!active) {
      const useBtn = document.createElement('button');
      useBtn.className = 'btn btn-ghost btn-sm';
      useBtn.textContent = cached ? t('model.use') : t('model.loadUse');
      useBtn.addEventListener('click', async () => {
        settings.llmModel = opt.id;
        saveSettings(settings);
        $('#settings-modal').hidden = true;
        modelsReady = false;
        setOrb('loading');
        await loadModelsViaChip();
      });
      actions.appendChild(useBtn);
    }
    if (cached && !active) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = t('model.delete');
      delBtn.addEventListener('click', async () => {
        try {
          await LLMEngine.deleteFromCache(opt.url);
          toast(t('toast.deleted', { name: opt.name }));
          await renderModelList();
        } catch (err: any) {
          toast(t('toast.deleteFail', { err: err?.message ?? err }), true);
        }
      });
      actions.appendChild(delBtn);
    }
    if (actions.childElementCount > 0) row.appendChild(actions);
    list.appendChild(row);
  }
}

async function wipeEverything() {
  if (!confirm(t('confirm.wipe'))) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
    }
    // LLM-Gewichte (wllama) liegen in OPFS, nicht in der Cache Storage API.
    try {
      const root = await navigator.storage.getDirectory();
      for await (const name of (root as any).keys()) {
        await root.removeEntry(name, { recursive: true });
      }
    } catch { /* OPFS nicht verfuegbar -> nichts zu loeschen */ }
    localStorage.clear();
    location.reload();
  } catch (err: any) {
    toast(t('toast.wipeFail', { err: err?.message ?? err }), true);
  }
}

// ------------------------------------------------------------- App-Start

function fillHeaderSelects() {
  const scenarioSel = $('#scenario-select') as unknown as HTMLSelectElement;
  scenarioSel.innerHTML = '';
  for (const s of SCENARIOS) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.emoji} ${t(s.titleKey)}`;
    scenarioSel.appendChild(o);
  }
  scenarioSel.value = settings.scenario;

  const levelSel = $('#level-select') as unknown as HTMLSelectElement;
  levelSel.innerHTML = '';
  for (const l of LEVELS) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = t(l.labelKey);
    levelSel.appendChild(o);
  }
  levelSel.value = settings.level;

  const targetLangSel = $('#target-lang-select') as unknown as HTMLSelectElement;
  targetLangSel.innerHTML = '';
  for (const l of TARGET_LANGS) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = `${l.flag} ${l.name}`;
    o.disabled = l.id === settings.nativeLang;
    targetLangSel.appendChild(o);
  }
  targetLangSel.value = settings.targetLang;
}

// Wechsel der Lernsprache (Setup ist da schon durch): Stimme umstellen,
// Whisper-Sprache gilt ab der naechsten Aufnahme, Gespraech neu starten.
function changeTargetLang(id: string) {
  settings.targetLang = id;
  settings.voice = targetLangById(id).defaultVoice;
  // Spricht die aktive Legende die neue Sprache nicht, zurueck zum Tutor.
  const p = activePersona();
  if (p && !p.langs.includes(id)) {
    settings.persona = null;
    updatePersonaHeader();
    syncPersonaVisual();
  }
  saveSettings(settings);
  // Im Immersions-Modus zeigt die Oberflaeche jetzt die neue Lernsprache.
  if (settings.uiInTarget) {
    applyUILang();
    refreshDynamicTexts();
  }
  fillHeaderSelects();
  renderVoiceSelect();
  renderLanguageSelects();
  setOrb(orbState);
  if (modelsReady) {
    void tts.warmVoice(currentVoice(), ttsLang());
    toast(t('toast.langSwitched', { lang: target().name }));
    startConversation();
  }
}

// Einmalige Aufraeum-Migration alter Modell-IDs auf das aktuelle Qwen3.5-
// Lineup: sowohl vom WebLLM-Stack (…-MLC) als auch vom Qwen3-Zwischenstand
// (qwen3-*). Verwaiste WebLLM-Cache-Buckets werden freigegeben.
// Selbst-begrenzend: nach dem Umschreiben passt keine der Bedingungen mehr.
function migrateFromWebLLM() {
  const old = settings.llmModel;
  if (!old) return;
  const legacyQwen3: Record<string, string> = {
    'qwen3-0.6b': 'qwen35-0.8b',
    'qwen3-1.7b': 'qwen35-2b',
    'qwen3-4b-2507': 'qwen35-4b',
  };
  if (legacyQwen3[old]) {
    settings.llmModel = legacyQwen3[old];
    saveSettings(settings);
    return;
  }
  if (!old.endsWith('-MLC')) return;
  settings.llmModel =
    old.includes('Llama-3.2-3B') || old.includes('Phi-3.5') || old.includes('Llama-3.1-8B')
      ? 'qwen35-2b'
      : old.includes('Qwen2.5-1.5B')
        ? 'qwen35-2b'
        : 'qwen35-0.8b';
  saveSettings(settings);
  void (async () => {
    try {
      for (const k of await caches.keys()) {
        if (k.startsWith('webllm')) await caches.delete(k);
      }
    } catch { /* Cache API nicht verfuegbar */ }
  })();
}

let appInitialized = false;

async function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  hw = await detectHardware();
  // Ohne WebGPU rechnet llama.cpp auf Multithread-WASM weiter — nur langsamer.
  // Kein Blocker mehr, sondern ein Hinweis.
  if (!hw.webgpu) toast(t('hw.cpuModeToast'));

  migrateFromWebLLM();

  // Lernsprache validieren (z. B. Deutsch vorerst als Lernsprache entfernt,
  // s. languages.ts) — sonst zeigt die Sprachauswahl eine nicht mehr
  // vorhandene Option leer an.
  if (!TARGET_LANGS.some((l) => l.id === settings.targetLang)) {
    settings.targetLang = fallbackTarget(settings.nativeLang ?? 'en');
    saveSettings(settings);
  }

  // Gespeicherte Persona validieren (geloescht/umbenannt oder Lernsprache
  // inzwischen inkompatibel -> zurueck zum Tutor).
  if (settings.persona) {
    const p = activePersona();
    if (!p || !p.langs.includes(settings.targetLang)) settings.persona = null;
  }

  fillHeaderSelects();
  updatePersonaHeader();
  syncPersonaVisual();
  ($('#auto-listen') as unknown as HTMLInputElement).checked = settings.autoListen;
  setOrb('loading');
  showOrb(); // Kugel von Anfang an sichtbar (auch waehrend die Modelle laden)

  // Gewaehltes Modell validieren (z. B. nach Library-Update)
  if (settings.llmModel && !llmOptionForId(settings.llmModel)) settings.llmModel = null;

  if (settings.setupDone && settings.llmModel) {
    await loadModelsViaChip();
  } else {
    renderSetup();
  }
}

function wireEvents() {
  // Tipp auf die Kugel = sprechen; ein Klick, der zu einer Zieh-Geste gehoerte,
  // wird unterdrueckt (er soll nur Sprech-Modus ein/aus schalten).
  orbEl().addEventListener('click', () => {
    if (suppressNextClick) { suppressNextClick = false; return; }
    onOrbClick();
  });
  orbEl().addEventListener('pointerdown', onOrbPointerDown);
  orbEl().addEventListener('pointermove', onOrbPointerMove);
  orbEl().addEventListener('pointerup', onOrbPointerUp);
  orbEl().addEventListener('pointercancel', onOrbPointerUp);
  $('#btn-orb-mini').addEventListener('click', toggleOrb);

  // Esc verlaesst den Sprech-only-Modus; bei Groessenaenderung neu zentrieren.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && immersion) exitImmersion();
  });

  // Klick weit genug neben die Kugel beendet den Sprech-only-Modus ebenfalls.
  // Klicks auf oder direkt um die Kugel (inkl. Label) bleiben unberuehrt.
  document.addEventListener('click', (e) => {
    // Der Klick, der eine Zieh-Geste abschliesst, darf nicht sofort wieder
    // beenden — beim Hochziehen landet der Zeiger sonst weit neben der jetzt
    // zentrierten Kugel und wuerde als "daneben geklickt" gewertet.
    if (suppressNextClick) { suppressNextClick = false; return; }
    if (!immersion) return;
    const rect = orbEl().getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (dist > rect.width / 2 + 80) exitImmersion();
  });
  window.addEventListener('resize', () => {
    if (!immersion) return;
    immersionShift = computeImmersionShift();
    setWrapTransform(immersionShift, 1);
  });

  // Das Dock schwebt transparent ueber dem Chat (keine harte Grenze mehr) —
  // der Chat bekommt unten so viel Innenabstand, dass die letzte Nachricht
  // nie hinter Composer/Kugel verschwindet. Waechst das Dock (Kugel ploppt
  // auf), zieht der Abstand mit und der Chat bleibt unten angepinnt.
  const dock = $('.talk-dock');
  const chat = $('#chat');
  const syncDockPad = () => {
    const pinned = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 90;
    chat.style.paddingBottom = `${dock.offsetHeight + 14}px`;
    if (pinned) scrollChat();
  };
  new ResizeObserver(syncDockPad).observe(dock);
  syncDockPad();

  // Wort-Uebersetzung per Doppelklick. Das Popover schwebt frei ueber der Seite
  // (position:absolute), folgt dem Chat also nicht — darum bei Scrollen, Klick
  // daneben, Esc oder Groessenaenderung wieder schliessen.
  chat.addEventListener('dblclick', onChatDblClick);
  chat.addEventListener('pointerdown', onChatPointerDown, { passive: true });
  chat.addEventListener('pointerup', onChatPointerUp);
  // Antippen der letzten eigenen Nachricht = korrigieren (s. onChatClick).
  chat.addEventListener('click', onChatClick);
  chat.addEventListener('keydown', onChatKeydown);
  chat.addEventListener('scroll', () => { dismissWordPopover(); dismissGestureHint(); }, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    const node = e.target as Node;
    if (translatePop && !translatePop.contains(node)) dismissWordPopover();
    if (gestureHintEl && !gestureHintEl.contains(node)) dismissGestureHint();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    dismissWordPopover();
    dismissGestureHint();
    if (!$('#hint-modal').hidden) closeEditHint();
  });
  window.addEventListener('resize', () => { dismissWordPopover(); dismissGestureHint(); });

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    if ($('#app').hidden) return;
    e.preventDefault();
    onVoiceButton();
  });

  $('#btn-restart').addEventListener('click', () => {
    if (!modelsReady) return;
    startConversation();
    toast(t('toast.newConvo'));
  });

  $('#btn-settings').addEventListener('click', () => void renderSettingsModal());
  $('#btn-close-settings').addEventListener('click', () => ($('#settings-modal').hidden = true));

  // Unterstuetzungs-Erinnerung: schliessen (X, Hintergrund, "vielleicht später")
  // oder dauerhaft stumm schalten ("ich unterstütze schon" / Klick auf den CTA,
  // der zugleich zur On-Site-Zahlung #unterstuetzen fuehrt).
  $('#btn-close-donate').addEventListener('click', closeDonateModal);
  $('#btn-donate-later').addEventListener('click', closeDonateModal);
  $('#donate-modal').addEventListener('click', (e) => {
    if (e.target === $('#donate-modal')) closeDonateModal();
  });
  $('#btn-donate-already').addEventListener('click', markSupporter);

  // „Schon gewusst?“: schliesst ueber Knopf, X oder Klick daneben.
  $('#btn-hint-ok').addEventListener('click', closeEditHint);
  $('#btn-close-hint').addEventListener('click', closeEditHint);
  $('#hint-modal').addEventListener('click', (e) => {
    if (e.target === $('#hint-modal')) closeEditHint();
  });
  $('#donate-modal-buy').addEventListener('click', markSupporter);
  $('#settings-modal').addEventListener('click', (e) => {
    if (e.target === $('#settings-modal')) $('#settings-modal').hidden = true;
  });

  // Allgemeiner KI-/Haftungshinweis: kein X, kein Hintergrund-Klick — muss
  // aktiv bestaetigt werden, bevor das erste echte Gespraech startet.
  $('#btn-disclaimer-accept').addEventListener('click', () => {
    settings.disclaimerSeen = true;
    saveSettings(settings);
    $('#disclaimer-modal').hidden = true;
    onModelsReady();
  });

  // Legenden-Galerie: oeffnen, schliessen, Persona per Chip verlassen. Vor dem
  // allerersten Betreten kommt ein eigener rechtlicher Vorschalt-Hinweis.
  const openPersonaGallery = () => {
    // Auf den Tab der aktiven Persona springen — wer gerade mit einem Native
    // spricht, landet wieder bei den Natives.
    personaTab = activePersona()?.kind === 'native' ? 'natives' : 'legends';
    renderPersonaGrid();
    $('#persona-modal').hidden = false;
  };
  const switchPersonaTab = (tab: 'legends' | 'natives') => {
    if (personaTab === tab) return;
    personaTab = tab;
    renderPersonaGrid();
  };
  $('#pt-legends').addEventListener('click', () => switchPersonaTab('legends'));
  $('#pt-natives').addEventListener('click', () => switchPersonaTab('natives'));
  $('#btn-personas').addEventListener('click', () => {
    if (settings.legendsDisclaimerSeen) openPersonaGallery();
    else $('#persona-gate-modal').hidden = false;
  });
  $('#btn-persona-gate-accept').addEventListener('click', () => {
    settings.legendsDisclaimerSeen = true;
    saveSettings(settings);
    $('#persona-gate-modal').hidden = true;
    openPersonaGallery();
  });
  $('#btn-close-persona-gate').addEventListener('click', () => {
    $('#persona-gate-modal').hidden = true;
  });
  $('#persona-gate-modal').addEventListener('click', (e) => {
    if (e.target === $('#persona-gate-modal')) $('#persona-gate-modal').hidden = true;
  });
  $('#btn-close-personas').addEventListener('click', () => {
    $('#persona-modal').hidden = true;
    clearGridOrbs();
  });
  $('#persona-modal').addEventListener('click', (e) => {
    if (e.target === $('#persona-modal')) {
      $('#persona-modal').hidden = true;
      clearGridOrbs();
    }
  });
  $('#persona-chip').addEventListener('click', () => selectPersona(null));

  // Eigener Charakter (Builder): Live-Vorschau, Speichern, Schliessen.
  $('#cf-name').addEventListener('input', updateCustomPreview);
  $('#cf-role').addEventListener('input', updateCustomPreview);
  ($('#cf-voice') as unknown as HTMLSelectElement).addEventListener('change', (e) => {
    cfVoice = (e.target as HTMLSelectElement).value;
    if (tts.ready) void tts.warmVoice(cfVoice, ttsLang());
  });
  $('#btn-cf-voice-preview').addEventListener('click', async () => {
    if (!tts.ready) return;
    cancelSpeech();
    try {
      const cfName = ($('#cf-name') as unknown as HTMLInputElement).value.trim();
      const line = previewLine(target(), cfName);
      const { audio, sr } = await tts.speak(line, cfVoice, settings.speed, ttsLang());
      player.enqueue(audio, sr);
    } catch (err: any) {
      toast(t('toast.previewFail', { err: err?.message ?? err }), true);
    }
  });
  $('#cf-save').addEventListener('click', saveCustomPersona);
  $('#btn-close-custom').addEventListener('click', () => {
    clearPreviewOrb();
    $('#custom-modal').hidden = true;
    renderPersonaGrid(); // Raster (und seine Kugeln) neu aufbauen
    $('#persona-modal').hidden = false;
  });
  $('#custom-modal').addEventListener('click', (e) => {
    if (e.target === $('#custom-modal')) {
      $('#custom-modal').hidden = true;
      clearPreviewOrb();
    }
  });

  $('#btn-lang-continue').addEventListener('click', () => {
    saveSettings(settings);
    renderModelStep();
  });
  $('#btn-setup-back').addEventListener('click', () => {
    $('#setup-step-choose').hidden = true;
    renderLangGrids();
    $('#setup-step-lang').hidden = false;
  });

  ($('#native-select') as unknown as HTMLSelectElement).addEventListener('change', (e) => {
    const id = (e.target as HTMLSelectElement).value;
    settings.nativeLang = id;
    if (settings.targetLang === id) {
      settings.targetLang = fallbackTarget(id);
      settings.voice = target().defaultVoice;
    }
    saveSettings(settings);
    applyUILang();
    refreshDynamicTexts();
    renderLanguageSelects();
    renderVoiceSelect();
  });

  ($('#target-select') as unknown as HTMLSelectElement).addEventListener('change', (e) => {
    changeTargetLang((e.target as HTMLSelectElement).value);
  });

  ($('#target-lang-select') as unknown as HTMLSelectElement).addEventListener('change', (e) => {
    changeTargetLang((e.target as HTMLSelectElement).value);
  });

  ($('#scenario-select') as unknown as HTMLSelectElement).addEventListener('change', (e) => {
    settings.scenario = (e.target as HTMLSelectElement).value;
    saveSettings(settings);
    if (modelsReady) startConversation();
  });

  ($('#level-select') as unknown as HTMLSelectElement).addEventListener('change', (e) => {
    settings.level = (e.target as HTMLSelectElement).value as Settings['level'];
    saveSettings(settings);
    toast(t('toast.level', { level: settings.level }));
    // Wie bei Szenario-/Personawechsel: altes Gespraech passt sprachlich nicht
    // mehr zum neuen Niveau, deshalb Kontext zuruecksetzen statt ihn haengen
    // zu lassen (siehe startConversation()).
    if (modelsReady) startConversation();
  });

  ($('#auto-listen') as unknown as HTMLInputElement).addEventListener('change', (e) => {
    settings.autoListen = (e.target as HTMLInputElement).checked;
    saveSettings(settings);
  });

  // Oberflaeche in der Lernsprache (Immersion) an-/ausschalten.
  ($('#ui-in-target') as unknown as HTMLInputElement).addEventListener('change', (e) => {
    settings.uiInTarget = (e.target as HTMLInputElement).checked;
    saveSettings(settings);
    applyUILang();
    refreshDynamicTexts();
  });

  // Name des Gespraechspartners (Einstellungen). Leer = Sprach-Standard.
  ($('#tutor-name-input') as unknown as HTMLInputElement).addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value.trim();
    settings.tutorName = v || null;
    saveSettings(settings);
    setOrb(orbState);
    if (modelsReady) startConversation();
  });

  // Name des Gespraechspartners (Erst-Einrichtung). Leer = Sprach-Standard.
  ($('#setup-tutor-name') as unknown as HTMLInputElement).addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value.trim();
    settings.tutorName = v || null;
    saveSettings(settings);
  });

  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#text-input') as unknown as HTMLInputElement;
    const text = input.value.trim();
    if (!text || !modelsReady) return;
    // Solange die Antwort noch generiert ODER gesprochen wird, ist Senden
    // gesperrt — erst wenn Sam ausgesprochen hat, darf der naechste Prompt los.
    if (isBusy()) {
      toast(t('toast.generating', { tutor: tutorName() }));
      return;
    }
    recorder.cancel(); // gibt auch die warm gehaltene Mikro-Pipeline frei
    input.value = '';
    userTurn(text);
  });

  // Datei-/Kontext-Upload: Knopf oeffnet den Dateidialog, Auswahl haengt an.
  $('#btn-attach').addEventListener('click', () => {
    ($('#file-input') as unknown as HTMLInputElement).click();
  });
  ($('#file-input') as unknown as HTMLInputElement).addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void attachFile(file);
    input.value = ''; // gleiche Datei erneut waehlbar
  });
  $('#context-remove').addEventListener('click', removeContext);

  $('#btn-download').addEventListener('click', () => void onSetupDownload());
  // Abgebrochener Download: Retry aus der Pille heraus (HF-Cache resumt).
  $('#dl-pill-retry').addEventListener('click', () => void loadModelsWithProgress({ pill: true }));

  ($('#voice-select') as unknown as HTMLSelectElement).addEventListener('change', (e) => {
    settings.voice = (e.target as HTMLSelectElement).value;
    saveSettings(settings);
    // Stimm-Vektor sofort vorladen, damit die naechste Antwort ohne
    // Verzoegerung mit der neuen Stimme startet.
    void tts.warmVoice(settings.voice, ttsLang());
  });

  $('#btn-voice-preview').addEventListener('click', async () => {
    if (!tts.ready) return;
    cancelSpeech();
    try {
      const line = previewLine(target(), tutorName());
      const { audio, sr } = await tts.speak(line, settings.voice, settings.speed, ttsLang());
      player.enqueue(audio, sr);
    } catch (err: any) {
      toast(t('toast.previewFail', { err: err?.message ?? err }), true);
    }
  });

  ($('#speed-range') as unknown as HTMLInputElement).addEventListener('input', (e) => {
    settings.speed = parseFloat((e.target as HTMLInputElement).value);
    $('#speed-value').textContent = `${settings.speed.toFixed(2)}×`;
    saveSettings(settings);
  });

  ($('#stt-select') as unknown as HTMLSelectElement).addEventListener('change', async (e) => {
    settings.sttModel = (e.target as HTMLSelectElement).value;
    saveSettings(settings);
    if (!hw) return;
    toast(t('toast.sttSwitch'));
    try {
      await stt.load(settings.sttModel, hw.webgpu ? 'webgpu' : 'wasm', target().whisper, () => {});
      toast(t('toast.sttReady'));
    } catch (err: any) {
      toast(t('toast.sttSwitchFail', { err: err?.message ?? err }), true);
    }
  });

  $('#btn-wipe').addEventListener('click', () => void wipeEverything());

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Auch die warm gehaltene Mikro-Pipeline freigeben, wenn der Tab weg ist.
      const wasActive = recorder.recording;
      recorder.cancel();
      if (wasActive) setOrb('idle');
    } else if (
      settings.autoListen &&
      modelsReady &&
      orbState === 'idle' &&
      conversationStarted &&
      !isBusy() &&
      !$('#orb-stage').hidden
    ) {
      // Freihandmodus: der Tab war kurz weg (App-Wechsel, Bildschirm gesperrt)
      // und hat darum sein Mikro verloren (s. oben) — sonst bliebe das
      // Zuhoeren beim Zurueckkehren fuer immer aus, obwohl der Nutzer nie
      // aktiv abgeschaltet hat. Also von selbst neu anfangen zu lauschen.
      void startListening();
    }
  });
}

// ---------------------------------------------------------- Oeffentliche API

let eventsWired = false;

// Wird bei jedem Wechsel auf #/app aufgerufen.
export function mountApp() {
  if (!eventsWired) {
    wireEvents();
    eventsWired = true;
  }
  // Not-Aus: Spenden-Dialog und alle Unterstuetzen-Verweise aus der App
  // entfernen (idempotent, greift nur wenn VITE_SUPPORT_ENABLED=false).
  hideSupportUI();
  if (!orbGl) {
    try {
      orbGl = new OrbGL($('.sphere'));
      orbGl.setState(orbState);
    } catch {
      orbGl = null; // Fallback: CSS-Kugel bleibt sichtbar
    }
  }
  if (!dots) {
    try {
      dots = new DotGrid($('#dots') as unknown as HTMLCanvasElement);
    } catch {
      dots = null; // App funktioniert auch ohne Deko-Raster
    }
  }
  orbGl?.start();
  dots?.start();
  // Legenden-Modus: Portraet statt Kugel anzeigen (pausiert die WebGL-Kugel).
  syncPersonaVisual();
  renderContextChip(); // ggf. gespeicherte Kontext-Datei wieder anzeigen
  void initApp();
}

// Beim Verlassen der App: Aufnahme, Sprachausgabe und Animationen anhalten.
export function leaveApp() {
  // Tour still abraeumen (ohne tourSeen zu setzen) — sie kommt beim
  // naechsten Besuch erneut, statt als haengendes Overlay zu bleiben.
  activeTour?.end(true);
  activeTour = null;
  recorder.cancel(); // gibt auch die warm gehaltene Mikro-Pipeline frei
  cancelSpeech();
  orbGl?.stop();
  dots?.stop();
  avatar?.stop();
}
