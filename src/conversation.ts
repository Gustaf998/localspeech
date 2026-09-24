// Gespraechslogik: Szenarien, Sprachniveaus, System-Prompt und
// inkrementelles Satz-Splitting fuer fruehe TTS-Ausgabe.
// Szenario-Titel und Level-Labels kommen aus i18n; die Prompts selbst sind
// englisch (beste Instruktions-Befolgung der kleinen Modelle) und
// sprachneutral formuliert — die Zielsprache setzt der System-Prompt.

import type { Level, Settings } from './store';
import { nativeLangById, targetLangById } from './languages';
import { personaById, type Persona } from './personas';
import { llmOptionForId } from './catalog';
import type { ChatMsg } from './engines/llm';

export interface Scenario {
  id: string;
  emoji: string;
  titleKey: string;
  prompt: string;
  // Eroeffnungs-Aufhaenger fuer den Tutor-Modus (ohne Persona) — dasselbe
  // Prinzip wie Persona.openers in personas.ts: englische Regie-Anweisung,
  // pro Sitzung wird genau eine zufaellig gezogen.
  openers: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'free',
    emoji: '💬',
    titleKey: 'scn.free',
    prompt: 'Have an open, friendly conversation about whatever comes up — daily life, plans, opinions, stories.',
    openers: [
      'Ask what they have been up to today.',
      'Ask what they are looking forward to this week.',
      'Ask what they would do with an unexpected free day.',
      'Ask what they last watched, read or listened to.',
      'Ask what the weather is doing where they are, and where they would rather be.',
      'Ask what they are learning at the moment besides this language.',
      'Ask what the best part of their week has been so far.',
    ],
  },
  {
    id: 'smalltalk',
    emoji: '🥂',
    titleKey: 'scn.smalltalk',
    prompt: 'You just met the learner at a friend\'s party. Make light, casual small talk — weekend plans, food, music, travel.',
    openers: [
      'Ask how they know the host of this party.',
      'Ask whether they came far to get here tonight.',
      'Ask what they do, and be genuinely interested in the answer.',
      'Comment on the music and ask what they would put on instead.',
      'Ask whether they are a stay-late or a slip-out-early kind of guest.',
      'Ask what they have been up to this weekend.',
    ],
  },
  {
    id: 'travel',
    emoji: '✈️',
    titleKey: 'scn.travel',
    prompt: 'Play typical travel situations: airport check-in, hotel reception, asking for directions, chatting with a fellow traveler. Start as an airport check-in agent.',
    openers: [
      'As the check-in agent: greet them and ask where they are flying today.',
      'As the check-in agent: ask whether they are checking any bags in.',
      'As the check-in agent: ask whether they would prefer a window or an aisle seat.',
      'As the check-in agent: ask whether they are travelling alone today.',
      'As the check-in agent: ask for their passport and where their trip ends.',
    ],
  },
  {
    id: 'restaurant',
    emoji: '🍝',
    titleKey: 'scn.restaurant',
    prompt: 'You are a friendly waiter in a nice restaurant. Take the order, make recommendations, handle small requests and small talk.',
    openers: [
      'Welcome them and ask whether they have a reservation.',
      'Hand them the menu and ask whether they would like something to drink first.',
      'Ask whether they have eaten here before, and offer to recommend something.',
      'Ask whether there is anything they do not eat, before they order.',
      'Recommend today\'s special and ask what they think of it.',
    ],
  },
  {
    id: 'job',
    emoji: '💼',
    titleKey: 'scn.job',
    prompt: 'You are a friendly hiring manager doing a relaxed job interview. Ask about experience, strengths, and motivation — one question at a time.',
    openers: [
      'Welcome them warmly and ask them to tell you a little about themselves.',
      'Ask what made them apply for this position.',
      'Ask what they are doing at the moment, work-wise.',
      'Ask how their journey here was, then move on to why they applied.',
      'Ask what kind of work they enjoy most.',
    ],
  },
  {
    id: 'business',
    emoji: '📊',
    titleKey: 'scn.business',
    prompt: 'You are a colleague in an international team meeting. Discuss a project: status, problems, next steps. Professional but relaxed tone.',
    openers: [
      'Open the meeting and ask them for a short status update.',
      'Ask whether the deadline still looks realistic from their side.',
      'Ask what is blocking them right now.',
      'Ask what they need from the rest of the team this week.',
      'Ask how the last release went from their point of view.',
    ],
  },
  {
    id: 'debate',
    emoji: '⚖️',
    titleKey: 'scn.debate',
    prompt: 'Pick a light, interesting topic (remote work, social media, cars vs. trains ...) and have a friendly debate. Challenge the learner\'s arguments politely.',
    openers: [
      'Claim that working from home makes people lonelier, and ask whether they agree.',
      'Claim that cars should be banned from city centres, and ask what they think.',
      'Claim that social media has made people worse at talking, and invite them to disagree.',
      'Claim that trains beat planes for any trip under a thousand kilometres.',
      'Claim that everyone should have to learn a second language at school.',
      'Claim that people read far less now and are none the poorer for it.',
    ],
  },
];

export function scenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

// Eroeffnungs-Pool fuer den eigenen Charakter: fuer ihn gibt es naturgemaess
// keine autorisierten Aufhaenger, also bewusst inhaltsleere Regie-Anweisungen,
// die der Nutzer-definierte Charakter selbst fuellt.
const CUSTOM_OPENERS = [
  'Ask what they have been up to today.',
  'Ask what brought them here today.',
  'Ask what they are looking forward to this week.',
  'Ask something you are genuinely curious about, fully in character.',
  'Ask what they would like to talk about.',
];

// ---------------------------------------------------------------------------
// Zufall. Das Projekt hatte bisher keinen einzigen Math.random-Aufruf: jede
// Sitzung startete identisch, und ob ein tragfaehiges Thema entstand, entschied
// allein das Sampling. Genau deshalb war gefuehlt jedes zweite Gespraech leer.

// Zieht zufaellig aus dem Pool und vermeidet dabei `avoid` (den zuletzt
// genutzten Eintrag), solange es eine Alternative gibt.
function pickRandom<T>(pool: readonly T[], avoid?: T | null): T {
  if (pool.length === 0) throw new Error('pickRandom: leerer Pool');
  const choices = pool.length > 1 && avoid != null ? pool.filter((x) => x !== avoid) : pool;
  const from = choices.length > 0 ? choices : pool;
  return from[Math.floor(Math.random() * from.length)];
}

// Ein Seed pro Gespraech. Wichtig, weil buildSystemPrompt in JEDEM Zug neu
// aufgerufen wird (buildMessages in app.ts): wuerde die Auswahl dort jedes Mal
// frisch gewuerfelt, aenderte sich der System-Prompt von Antwort zu Antwort.
// Das haette zwei haessliche Folgen — der Prompt-Praefix waere nie derselbe,
// llama.cpp muesste also pro Zug den kompletten Kontext neu prefillen (auf dem
// CPU-Pfad richtig teuer), und die Persona wuerde innerhalb einer Sitzung
// unruhig. Also: einmal pro Gespraech ziehen, danach deterministisch.
let sessionSeed = (Math.random() * 2 ** 31) | 0;

// Vom Gespraechsstart aufgerufen (app.ts startConversation) — ab hier zieht die
// Persona eine neue Themen-/Fakten-Auswahl.
export function newConversationSeed(): void {
  sessionSeed = (Math.random() * 2 ** 31) | 0;
}

// mulberry32, aus sessionSeed und einem Salt abgeleitet, damit Fakten und
// Themen unabhaengig voneinander ziehen.
function seededRng(salt: number): () => number {
  let a = (sessionSeed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Zufaellige Teilmenge in Original-Reihenfolge, stabil innerhalb eines
// Gespraechs (s. sessionSeed). Fisher-Yates auf Indizes; n ist einstellig.
function pickSome<T>(pool: readonly T[], n: number, salt: number): T[] {
  if (pool.length <= n) return [...pool];
  const rnd = seededRng(salt);
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).sort((a, b) => a - b).map((i) => pool[i]);
}

// Grobe Token-Schaetzung fuer das Kontext-Budget in buildMessages (app.ts).
// wllama exportiert in dieser Version keine tokenize()-API, also bleibt nur
// eine Schaetzung.
//
// Divisor 3.5 liegt bewusst unter der echten BPE-Rate (~4–4,2 Zeichen/Token
// fuer Englisch und die romanischen Lernsprachen) und ueberschaetzt damit die
// Tokenzahl — lieber etwas History zu wenig mitschicken als den Context-Shift
// ausloesen, der den System-Prompt frisst. Noch paranoider zu schaetzen waere
// aber kontraproduktiv: beim 0.8B bliebe dann rechnerisch gar keine History
// mehr uebrig, und ohne Verlauf kann das Modell erst recht nicht wissen, was es
// schon gefragt hat.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export const LEVELS: { id: Level; labelKey: string; instruction: string }[] = [
  {
    id: 'A1',
    labelKey: 'level.A1',
    instruction: 'True beginner. Only the most common words: numbers, colors, family, food, greetings, simple verbs like be, have, go, want, like. Three to six words per sentence, present tense only, one simple idea per sentence. No idioms, no abstract words, no subordinate clauses ("that", "because", "if"). If a harder word cannot be avoided, use the simplest synonym instead.',
  },
  {
    id: 'A2',
    labelKey: 'level.A2',
    instruction: 'Only simple everyday words a learner knows after a few months — nothing rare, technical or literary. Short sentences, mostly present and simple past, at most one subordinate clause, one idea per sentence.',
  },
  {
    id: 'B1',
    labelKey: 'level.B1',
    instruction: 'Use everyday vocabulary and clear sentences. Avoid rare idioms.',
  },
  {
    id: 'B2',
    labelKey: 'level.B2',
    instruction: 'Speak naturally with normal native vocabulary. Occasionally use common idioms and explain them briefly if asked.',
  },
  {
    id: 'C1',
    labelKey: 'level.C1',
    instruction: 'Speak like you would with another native speaker: idioms, nuance, humor, cultural references.',
  },
];

// Default level when a stored setting is missing or invalid — B1, not the
// first array entry (LEVELS[0] is now the A1 true-beginner tier).
const DEFAULT_LEVEL = LEVELS.find((l) => l.id === 'B1')!;

// ---------------------------------------------------------------------------
// Gemeinsame Regelbausteine. Alle vier Prompt-Varianten (Tutor, Legende,
// Native, eigener Charakter) teilen denselben Kern — frueher stand er vierfach
// als Fliesstext da und ist zwangslaeufig auseinandergedriftet.
//
// Bewusst kurze Imperativ-Zeilen: 0,8–4B-Modelle befolgen von einer langen
// Regelliste zuverlaessig nur Anfang und Ende. Je knapper jede einzelne Regel,
// desto mehr davon liegen ueberhaupt im Bereich, den das Modell noch gewichtet
// — und desto mehr Kontextfenster bleibt fuer den Gespraechsverlauf (beim
// 0.8B sind es nur 2048 Token fuer System-Prompt UND History).

// Die zwei in freier Wildbahn haeufigsten Fehler: mehrere Fragen in einer
// Antwort und dieselbe Frage zweimal hintereinander. Beide brauchen eine
// harte Zahl ("genau EINE") und einen expliziten Blick zurueck in den
// Verlauf — das vorherige "then usually a natural question back" liess dem
// Modell zu viel Spielraum.
const TURN_RULES = [
  '- React to what the learner just said, then ask exactly ONE question. Never two questions in one reply.',
  '- Check the conversation above first: never ask something you already asked, and never ask what they have already told you. If your question is used up, ask about a different part of their last answer.',
  '- One to three short spoken sentences. One idea at a time.',
];

// Gegen Halluzination: kleine Modelle fuellen Luecken lieber auf, als sie
// zuzugeben — besonders ueber den Lernenden selbst ("und wie geht es deiner
// Schwester?", die nie erwaehnt wurde). Das liest sich fuer den Nutzer wie
// Verwirrtheit und zerstoert das Vertrauen ins Gespraech.
const GROUNDING_RULE =
  '- Use only what is written above and what the learner actually said. Never invent details about them or about earlier parts of this conversation. If you do not know or cannot remember, say so in one short sentence.';

// Die Antwort geht unveraendert in die TTS (sanitizeForSpeech ist nur das Netz).
const SPEECH_RULES = [
  '- Your reply is read aloud: no emojis, no markdown, no asterisks, no bullet points, no stage directions.',
  '- Write numbers and abbreviations as spoken words: "twenty five", not "25".',
];

// Der Lerner spricht meist per STT statt zu tippen — kleine Whisper-Modelle
// verhoeren sich gelegentlich bei einzelnen Woertern. Ohne diesen Hinweis
// nimmt das Gespraechsmodell unsinnige Transkripte einfach wortwoertlich hin
// ("Ich habe einen Bahnhof gegessen" -> spielt brav mit), statt wie ein echter
// Mensch am Telefon nachzufragen oder sinnvoll zu raten.
const STT_ERROR_RULE =
  '- The learner speaks through speech-to-text, so single words can arrive wrong. If part of what they said makes no sense, do not play along: ask what they meant, or guess and check ("wait, did you mean ...?").';

// Charakterblatt = Vorrat, nicht Abarbeitungsliste. Ohne diese Regel leiert
// die Persona ihre Anker in den ersten drei Zuegen herunter und hat danach
// nichts mehr — genau dort beginnen die Wiederholungen.
const CHARACTER_POOL_RULES = [
  '- The facts, habits and phrases above are background to reach for now and then, not a list to work through. At most one per reply, and only when it fits what the learner just said.',
  '- Never repeat the same fact, story or catchphrase twice in one conversation.',
  '- The fallback ideas are spare parts, not a plan. Stay with whatever the learner brought up; only when a subject runs dry, take ONE idea and open it with a question. You may just as well follow them somewhere else entirely.',
];

// Kleine lokale Modelle rutschen im Rollenspiel gelegentlich in gefaehrliche
// Scherze ab (Waffen als Spielzeug verharmlosen, zum Turmsprung "für den
// Windversuch" oder zum Klettern auf einen fahrenden Zug "für die
// Wissenschaft" anstiften) — meist als vermeintlich charakterpassende
// Uebertreibung, nicht als eigentliche Absicht des Modells. Ganz am Ende
// jedes Prompts platziert: kleine Modelle gewichten die zuletzt gelesene
// Regel am staerksten (Rezenz-Effekt, s. Sprachregel weiter unten), und
// Sicherheit soll hier hoeher wiegen als Charaktertreue oder Sprachregel.
const SAFETY_RULE =
  '- SAFETY RULE, above your character and every rule above: never encourage, glamorize, joke about or play down anything dangerous, illegal or self-endangering — weapons as toys, jumping from a height, climbing on or in front of trains or cars — however well it would fit the moment. If it comes up, drop the joke at once, say plainly and kindly that it is not safe, and change the subject, even at the cost of one sentence out of character.';

// Zweitletzte Regel (nur die Sicherheitsregel steht noch dahinter) = sehr
// hohes Gewicht durch den Rezenz-Effekt. Bewusst OHNE Negativbeispiel: ein
// woertlich zitierter falscher Gruss ("Hallo, mein Freund!") steht als
// Tokenfolge im Kontext und macht genau ihn wahrscheinlicher, statt ihn zu
// verhindern.
function languageRule(targetEnglish: string, extra: string): string {
  return `- MOST IMPORTANT RULE, above everything above: every single word you write is ${targetEnglish} — your first greeting, "yes", "no", every name, everything. ${extra}`;
}

// Charakterblatt der Persona als beschrifteter Block. Die Ueberschriften sind
// keine Deko: sie sagen dem Modell, WOFUER die jeweiligen Zeilen da sind —
// Fakten = Erdung, Ticks = Wiedererkennbarkeit, Ideen = Notausgang. Genau
// diese Zuordnung fehlte im alten Ein-Absatz-Format.
// Modelle mit sehr kleinem Kontextfenster (0.8B: 2048 Token fuer System-Prompt
// UND Verlauf) bekommen ein schlankeres Charakterblatt. Sonst frisst die
// Persona das gesamte Fenster und es bleibt keine History — und ohne Verlauf
// kann das Modell nicht wissen, was es schon gefragt hat, was ausgerechnet die
// Wiederholungen verstaerkt, die wir bekaempfen.
const TIGHT_CTX = 2048;

function isTightContext(s: Settings): boolean {
  const opt = s.llmModel ? llmOptionForId(s.llmModel) : null;
  return (opt?.nCtx ?? 4096) <= TIGHT_CTX;
}

function characterSheet(p: Persona, tight: boolean): string[] {
  const bullets = (lines: string[]) => lines.map((l) => `- ${l}`);
  return [
    'Who you are:',
    p.prompt,
    '',
    'True about you — never contradict these, never invent more:',
    // Fakten sind die Erdung gegen Halluzination, also wird hier zuletzt
    // gekuerzt — beim engen Fenster aber eben doch, und zufaellig, damit ueber
    // mehrere Sitzungen trotzdem die ganze Biografie vorkommt.
    ...bullets(tight ? pickSome(p.facts, 4, 1) : p.facts),
    '',
    'How you talk:',
    ...bullets(p.quirks),
    '',
    'Spare ideas, only for when a subject runs out:',
    // Bewusst nur eine zufaellige Teilmenge: das erzeugt Abwechslung zwischen
    // Sitzungen (mit allen fuenf griff das Modell reproduzierbar zur selben
    // ersten Idee) und spart Kontext.
    ...bullets(pickSome(p.topics, tight ? 2 : 3, 2)),
  ];
}

// Kurzer Rollen-Anker, den buildMessages (app.ts) unmittelbar VOR die juengste
// Nutzernachricht setzt — dieselbe Mechanik wie buildDocumentPreamble weiter
// unten und aus demselben Grund: kleine Modelle gewichten das zuletzt Gelesene
// am staerksten. Ein System-Prompt am Anfang des Kontexts hilft nichts mehr,
// wenn das Modell die Rollen bereits vertauscht hat (oder der System-Prompt
// beim Context-Shift verloren ging) — dieser Anker steht in jedem Zug frisch
// direkt an der Frage.
//
// Adressiert beide beobachteten Fehler auf einmal: die Charakteruebertragung
// ("die KI haelt den Nutzer fuer Einstein") und die wiederholte Frage.
export function buildTurnAnchor(s: Settings): string {
  const target = targetLangById(s.targetLang);
  const name = tutorNameFor(s);
  return `[You are ${name}. The message below is from the learner, not from you — never speak as if they were ${name}. React to it first, then ask one question you have not asked yet. Every word in ${target.english}.]`;
}

// Frei gewaehlter Name des Gespraechspartners: aktive Legenden-Persona
// gewinnt, sonst Wunschname, sonst Sprach-Standard ("Sam" etc.).
export function tutorNameFor(s: Settings): string {
  if (s.persona === 'custom' && s.customPersona?.name.trim()) return s.customPersona.name.trim();
  const persona = personaById(s.persona);
  if (persona) return persona.short;
  return s.tutorName?.trim() || targetLangById(s.targetLang).tutor;
}

// System-Prompt fuer den selbst gebauten Charakter: der Nutzer definiert
// Verhalten und Wissen frei; dieselben Sprech-/Niveau-/Korrektur-Regeln wie
// sonst sorgen dafuer, dass es ein Sprachlern-Gespraech bleibt.
function buildCustomPrompt(s: Settings): string {
  const c = s.customPersona!;
  const target = targetLangById(s.targetLang);
  const level = LEVELS.find((l) => l.id === s.level) ?? DEFAULT_LEVEL;
  const name = c.name.trim() || 'your character';
  const role = c.role.trim();
  return [
    `You are ${name}${role ? `, ${role}` : ''}, talking with someone who is practising ${target.english} with you. This is a real spoken conversation: write exactly the way people talk.`,
    '',
    'Who you are and how you behave:',
    c.personality.trim() || 'Warm, curious and encouraging.',
    ...(c.knowledge.trim() ? ['', 'What you know and your background:', c.knowledge.trim()] : []),
    '',
    'Rules:',
    `- You are ${name}. First person, the personality above, consistent opinions and humour. Never break character on your own.`,
    '- Your personality and background are a pool to draw from now and then, not a script. Do not steer the conversation back to the same one or two subjects, and never repeat the same fact or story twice.',
    GROUNDING_RULE,
    ...SPEECH_RULES,
    STT_ERROR_RULE,
    '- However strict or playful your character is, never insult or demean the learner — you want them to keep talking.',
    '- If they seriously ask whether you are real, say briefly that you are an AI character for language practice, then go back to character.',
    `- The learner is at level ${level.id}. ${level.instruction}`,
    '- Never correct or grade their language — a separate tutor does that. Just react to what they mean.',
    ...TURN_RULES,
    languageRule(target.english, 'Never switch to any other language.'),
    SAFETY_RULE,
  ].join('\n');
}

// System-Prompt fuer den Legenden-Modus: Charakterblatt der Persona plus
// dieselben Sprech-/Niveau-/Korrektur-Regeln wie im Tutor-Modus. Die Persona
// bleibt in ihrer Zeit verankert (Wissens-Grenze = Todesjahr) — genau das
// macht die Gespraeche magisch ("Was ist ein Smartphone?").
function buildPersonaPrompt(s: Settings, persona: Persona): string {
  const target = targetLangById(s.targetLang);
  const level = LEVELS.find((l) => l.id === s.level) ?? DEFAULT_LEVEL;
  // Natives ("Talk with Natives") sind fiktive Alltags-Charaktere der Gegen-
  // wart und zugleich Kulturbotschafter ihres Landes — Legenden dagegen sind
  // (meist) in ihrer Zeit verankerte historische Persoenlichkeiten.
  if (persona.kind === 'native') return buildNativePrompt(s, persona);
  const lifespan = persona.living
    ? `born ${persona.years}`
    : `${persona.years}${persona.bc ? ' BC' : ''}`;
  // Verstorbene bleiben in ihrer Zeit verankert (Wissens-Grenze = Todesjahr);
  // Lebende kennen die Gegenwart und duerfen frei ueber Aktuelles sprechen.
  const eraRule = persona.living
    ? '- You live in the present day and know current technology and events. Speak from your real perspective and your current work.'
    : '- You only know the world of your own lifetime. If the learner mentions something later — a device, an event, a word — never pretend to know it: react with curiosity or confusion and ask them to explain. That surprise is the best part of talking to you.';
  return [
    `You are ${persona.name} (${lifespan}), talking with someone who is practising ${target.english} with you. This is a real spoken conversation: write exactly the way people talk.`,
    '',
    ...characterSheet(persona, isTightContext(s)),
    '',
    'Rules:',
    `- You are ${persona.short}. First person, your temperament, your opinions, your humour. Never break character on your own.`,
    ...CHARACTER_POOL_RULES,
    '- Do not steer the conversation back to your own biography. The learner is the more interesting person in this room.',
    eraRule,
    GROUNDING_RULE,
    ...SPEECH_RULES,
    STT_ERROR_RULE,
    '- Be warm and encouraging toward the learner, whatever your temperament. Never demean them.',
    '- If they seriously ask whether you are real, say briefly that you are an AI portrayal for language practice, then go back to character.',
    `- The learner is at level ${level.id}. ${level.instruction}`,
    '- Never correct or grade their language — a separate tutor does that. Stay in character and keep the conversation going.',
    ...TURN_RULES,
    // Personas mit realer nicht-englischer Muttersprache (Einstein: Deutsch)
    // starten sonst aus dem Trainingsmaterial heraus gern mit einem Gruss in
    // dieser Sprache — deshalb hier namentlich adressiert.
    languageRule(
      target.english,
      `${persona.short} may have spoken other languages in real life; you never do, not one word.`,
    ),
    SAFETY_RULE,
  ].join('\n');
}

// System-Prompt fuer den Natives-Modus: fiktiver Einheimischer als lebendiges
// Fenster in Land, Leute und Kultur. Gleiche Sprech-/Niveau-/Korrektur-Regeln
// wie sonst — dazu die Kultur-Regel, die den eigentlichen Zweck des Modus
// traegt: Alltag, Braeuche und Redewendungen ganz nebenbei vermitteln.
function buildNativePrompt(s: Settings, persona: Persona): string {
  const target = targetLangById(s.targetLang);
  const level = LEVELS.find((l) => l.id === s.level) ?? DEFAULT_LEVEL;
  return [
    `You are ${persona.name}, a native ${target.english} speaker from ${persona.home}, talking with someone who is practising ${target.english} and wants to get to know your country through you. This is a real spoken conversation: write exactly the way people talk.`,
    '',
    ...characterSheet(persona, isTightContext(s)),
    '',
    'Rules:',
    `- You are ${persona.short}. First person, your temperament, your local pride, your humour. Never break character on your own.`,
    ...CHARACTER_POOL_RULES,
    '- You live in the present day and know current everyday life in your country.',
    '- You are a living window into your culture: let one custom, dish, festival or typical expression slip in naturally at a time — never a lecture or a list. You love comparing it with how things work where the learner is from.',
    GROUNDING_RULE,
    ...SPEECH_RULES,
    STT_ERROR_RULE,
    '- Be warm and encouraging toward the learner, whatever your temperament. Tease affectionately at most — never demean them.',
    '- If they seriously ask whether you are real, say briefly that you are a fictional AI character for language practice, then go back to character.',
    `- The learner is at level ${level.id}. ${level.instruction}`,
    '- Never correct or grade their language — a separate tutor does that. Stay in character and keep the conversation going.',
    ...TURN_RULES,
    // Gerade der Native wuerde sonst gern "authentische" Brocken der
    // Muttersprache des Lernenden einstreuen.
    languageRule(target.english, "Never slip into the learner's language, not for a single word."),
    SAFETY_RULE,
  ].join('\n');
}

// Vom Nutzer hochgeladener Datei-Kontext, als Vorspann direkt VOR der aktuellen
// Nutzernachricht (siehe buildMessages in app.ts). Kleine lokale Modelle achten
// am staerksten auf das zuletzt Gelesene — deshalb reisst der Dokumenttext hier
// unmittelbar an der Frage an und nicht am Ende eines langen System-Prompts, wo
// er sonst untergeht. Leerstring, wenn keine Datei angehaengt ist.
// maxChars: Platz, der dem Dokumenttext neben System-Prompt, Anker und etwas
// Verlauf noch bleibt (berechnet in buildMessages, app.ts). Ohne dieses Limit
// sprengt ein 6000-Zeichen-Dokument auf dem 0.8B (2048 Token) das Fenster —
// und dann verwirft llama.cpps Context-Shift als Erstes den System-Prompt, also
// genau die Persona. Lieber ein ehrlich gekuerzter Auszug als ein Modell, das
// mitten im Gespraech vergisst, wer es ist.
export function buildDocumentPreamble(s: Settings, maxChars = Infinity): string {
  const doc = s.contextDoc;
  if (!doc || !doc.text.trim()) return '';
  const target = targetLangById(s.targetLang);
  const full = doc.text.trim();
  const cut = full.length > maxChars;
  const text = cut ? full.slice(0, Math.max(0, maxChars)).trimEnd() : full;
  if (!text) return '';
  return [
    `[The learner has attached a document titled "${doc.name}" to talk about with you. Keep speaking ${target.english} only. Use its content to answer their questions and reference it naturally when relevant. Do not read it out word for word or dump long quotes — talk about it like a person would.`,
    '--- DOCUMENT START ---',
    text,
    cut
      ? '--- DOCUMENT CUT OFF HERE (only the beginning fits) — if they ask about a later part, say plainly that you can only see the beginning. ---]'
      : '--- DOCUMENT END ---]',
  ].join('\n');
}

export function buildSystemPrompt(s: Settings): string {
  return buildBasePrompt(s);
}

function buildBasePrompt(s: Settings): string {
  if (s.persona === 'custom' && s.customPersona) return buildCustomPrompt(s);
  const persona = personaById(s.persona);
  if (persona) return buildPersonaPrompt(s, persona);
  const target = targetLangById(s.targetLang);
  const native = nativeLangById(s.nativeLang ?? 'en');
  const scenario = scenarioById(s.scenario);
  const level = LEVELS.find((l) => l.id === s.level) ?? DEFAULT_LEVEL;
  return [
    `You are ${tutorNameFor(s)}, a warm, curious native ${target.english} speaker, talking with a ${native.english} native speaker who wants to become and stay fluent in ${target.english}. This is a real spoken conversation: write exactly the way people talk.`,
    '',
    // Szenario direkt unter der Rolle statt ganz am Schluss: die letzte Zeile
    // im Prompt gehoert der Sicherheitsregel (Rezenz-Effekt, s. SAFETY_RULE).
    `Scenario: ${scenario.prompt}`,
    '',
    'Rules:',
    '- Sound like a real person: contractions, casual phrasing, genuine reactions.',
    GROUNDING_RULE,
    ...SPEECH_RULES,
    STT_ERROR_RULE,
    `- The learner is at level ${level.id}. ${level.instruction}`,
    '- Never correct or grade their language — a separate tutor does that. Just react to what they mean.',
    ...TURN_RULES,
    languageRule(target.english, `Never switch to ${native.english} or any other language.`),
    SAFETY_RULE,
  ].join('\n');
}

// Versteckte erste Nachricht, die die Begruessung der KI ausloest (app.ts:
// launchConversation). WICHTIG: sie liegt in der USER-Rolle. Deshalb darf hier
// kein Personenname mehr stehen — vorher hiess es "fully in character as
// Albert", also eine Regieanweisung mit Namen im Nutzerzug, und kleine Modelle
// spiegeln so etwas ("die KI haelt den Nutzer fuer Einstein"). Wer die Rolle
// ist, steht im System-Prompt und im Turn-Anker; hier steht nur noch, WAS zu
// tun ist.
//
// Seiteneffekt: setzt s.lastOpener auf den gezogenen Aufhaenger, damit beim
// naechsten Start ein anderer kommt. Der Aufrufer (app.ts startConversation)
// persistiert die Settings.
export function buildKickoffPrompt(s: Settings): string {
  const target = targetLangById(s.targetLang);
  const doc = s.contextDoc;
  const persona = s.persona === 'custom' ? null : personaById(s.persona);
  const custom = s.persona === 'custom' && s.customPersona;
  const pool = persona ? persona.openers : custom ? CUSTOM_OPENERS : scenarioById(s.scenario).openers;
  const opener = pickRandom(pool, s.lastOpener);
  s.lastOpener = opener;

  // Angehaengtes Dokument schlaegt den Zufalls-Aufhaenger: wer eine Datei
  // hochlaedt, will ueber sie sprechen und nicht ueber Lieblingsmusik.
  const task = doc
    ? `The learner has shared a document titled "${doc.name}" — warmly invite them to talk about it and ask exactly one question about it.`
    : `${opener} Ask exactly one question, and make it something only you would ask — never "how are you".`;

  return `(Begin now. Greet me briefly in ${target.english}, unmistakably in your own voice, then: ${task} Two sentences maximum.)`;
}

// ---------------------------------------------------------------------------
// Inkrementelles Satz-Splitting: waehrend das LLM streamt, werden fertige
// Saetze sofort an die TTS uebergeben (niedrige Latenz bis zum ersten Ton).

// "।" ist der Devanagari-Satzpunkt (Hindi).
const BOUNDARY = /([.!?…।]+["')\]]?)(\s|$)/;
// Schwächere Grenzen (Komma etc.) fuer den allerersten Schnipsel eines Zugs.
const EAGER_BOUNDARY = /([,;:—–]["')\]]?)(\s)/;
// Notbremse fuer den ersten Schnipsel: Ist bis hierhin weder Satz- noch
// Komma-Grenze aufgetaucht (langer erster Satz + langsames Modell = lange
// Stille), wird an der letzten Wortgrenze geschnitten.
const EAGER_MIN = 20;
const EAGER_HARD_CUT = 44;

export function splitIncremental(
  buffer: string,
  eager = false,
): { complete: string[]; rest: string } {
  const complete: string[] = [];
  let rest = buffer;
  for (;;) {
    const m = BOUNDARY.exec(rest);
    if (!m) break;
    const end = m.index + m[1].length;
    const sentence = rest.slice(0, end).trim();
    const after = rest.slice(end).replace(/^\s+/, '');
    // Sehr kurze Fragmente ("Mr." / "Dr.") nicht abtrennen, ausser danach
    // beginnt klar ein neuer Satz.
    if (sentence.length < 12 && after.length === 0) break;
    complete.push(sentence);
    rest = after;
    if (!rest) break;
  }
  // Latenz-Trick: Solange noch kein einziger Satz gesprochen wurde, schon an
  // der ersten Komma-Grenze (ab ~20 Zeichen) abtrennen — die Stimme startet
  // dann, waehrend das Modell den Rest des Satzes noch schreibt.
  if (eager && complete.length === 0) {
    const m = EAGER_BOUNDARY.exec(rest);
    if (m && m.index + m[1].length >= EAGER_MIN) {
      const end = m.index + m[1].length;
      complete.push(rest.slice(0, end).trim());
      rest = rest.slice(end).replace(/^\s+/, '');
    } else if (rest.length >= EAGER_HARD_CUT) {
      // Gar keine Interpunktion in Sicht: an der letzten Wortgrenze schneiden,
      // damit auch ein langer erster Satz sofort zu hoeren ist.
      const cut = rest.lastIndexOf(' ');
      if (cut >= EAGER_MIN) {
        complete.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut + 1);
      }
    }
  }
  return { complete, rest };
}

// Text fuer die Sprachausgabe saeubern (falls das Modell doch Symbole nutzt).
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/[*_#`~<>|]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Sicherheitsnetz UNTER der SAFETY_RULE im Prompt: kleine lokale Modelle
// halten Regeln nicht zu 100% ein, und fuer rein lokal laufende Modelle gibt
// es keine Moderation-API, die man nachschalten koennte. Dieses Stichwort-
// Backstop erkennt NUR die konkret in freier Wildbahn beobachteten Muster
// (Waffe als Spielzeug verharmlost, Sprung aus der Hoehe "um zu sehen, wohin
// einen der Wind traegt", Klettern auf/vor ein fahrendes Fahrzeug "fuer die
// Wissenschaft") — keine allgemeine Gefahrenerkennung. Je Kategorie muessen
// ein Wort aus beiden Seiten des Paares im selben Satz vorkommen; die Woerter
// decken alle sechs Lernsprachen ab, weil die Zielsprache pro Nutzer wechselt.
// Bewusst satzweise geprueft (nicht auf dem kompletten Text): der Aufrufer
// (app.ts) bekommt so die fruehestmoegliche Sprech-/Anzeige-Einheit zum
// Abbrechen, ohne auf das Ende der ganzen Antwort warten zu muessen.
const UNSAFE_PATTERN_PAIRS: [RegExp, RegExp][] = [
  // Waffe <-> Spielzeug
  [
    /\b(guns?|pistols?|rifles?|weapons?|pistolas?|armas?|pistolen?|waffen?|gewehr\w*|pistolets?|armes?|fusils?)\b/i,
    /\b(toys?|spielzeugs?|juguetes?|jouets?|giocattol\w*|brinquedos?)\b/i,
  ],
  // Sprung aus der Hoehe
  [
    /\b(jump\w*|leap\w*|spring\w*|salt[ao]\w*|saut\w*)\b/i,
    /\b(tower|roof|bridge|balcony|height|turm|dach|br[uü]cke|balkon|h[oö]he|torre|tejado|puente|balc[oó]n|altura|tour|toit|pont|hauteur|tetto|ponte|altezza|telhado|varanda|altura)\b/i,
  ],
  // Klettern auf/vor ein Fahrzeug/Zug
  [
    /\b(climb\w*|clamber\w*|kletter\w*|steig\w*|sub(?:ir|a|e|amos)?|trepar?\w*|grimp\w*|arrampic\w*|escalar?\w*)\b/i,
    /\b(trains?|tracks?|rails?|z[uü]ge?|gleis\w*|schienen?|trenes?|tren|v[ií]as|voies?|treno|treni|binari|trem|trens?|trilhos?)\b/i,
  ],
];

export function containsUnsafeContent(text: string): boolean {
  return UNSAFE_PATTERN_PAIRS.some(([a, b]) => a.test(text) && b.test(text));
}

// Kurzer, neutraler Themenwechsel in der jeweiligen Lernsprache (die Antwort
// soll ja weiterhin ausschliesslich in ihr erfolgen, s. Sprachregeln oben).
const SAFE_REDIRECT: Record<string, string> = {
  en: "Let's not go there — how about we talk about something else?",
  es: 'Mejor no sigamos por ahí — ¿hablamos de otra cosa?',
  fr: "Évitons ce sujet — et si on parlait d'autre chose ?",
  it: "Meglio lasciar perdere — parliamo d'altro?",
  pt: 'Melhor não seguirmos por aí — que tal falarmos de outra coisa?',
  de: 'Lass uns lieber über etwas anderes sprechen.',
};

export function safeRedirectLine(targetId: string): string {
  return SAFE_REDIRECT[targetId] ?? SAFE_REDIRECT.en;
}
