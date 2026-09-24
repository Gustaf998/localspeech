// Aussprache-Bewertung auf Phonem-Ebene (Goodness-of-Pronunciation, schlank).
//
// Vergleicht die ERWARTETEN Phoneme (espeak-IPA je Wort, aus dem TTS-Worker)
// mit den TATSAECHLICH produzierten Phonemen (wav2vec2-espeak-Modell). Beide
// stammen aus dem espeak-IPA-Alphabet, sind also direkt vergleichbar. Da das
// Akustikmodell keinen Sprachprior hat, faellt — anders als bei Whisper — eine
// falsch gesprochene Lautfolge wirklich auf.
//
// Rein funktional, kein DOM: die App rendert das Ergebnis.

export interface WordScore {
  word: string; // Anzeigeform (mit Interpunktion)
  score: number | null; // 0..1 Anteil korrekt getroffener Laute; null = nicht bewertbar
  ok: boolean; // score ueber der Nachsicht-Schwelle?
}

export interface PronunciationResult {
  overall: number; // 0..1 ueber alle bewertbaren Laute
  words: WordScore[];
  expectedIpa: string; // zusammengefuegt, fuer eine optionale Detailzeile
  producedIpa: string;
}

// Ab diesem Laut-Trefferanteil gilt ein Wort als gut ausgesprochen. Bewusst
// nachsichtig — ein Lerner soll nicht an feinen Diakritika scheitern.
const WORD_OK_THRESHOLD = 0.6;

// IPA fuer den Vergleich vereinheitlichen: Betonungs-, Laengen- und
// Tie-Zeichen sowie kombinierende Diakritika entfernen (nachsichtig), dann in
// einzelne Code-Points als Vergleichseinheiten zerlegen. NFD spaltet
// kombinierende Marken vom Grundbuchstaben ab, sodass z. B. Nasalierung
// wegfaellt, der Vokal aber bleibt.
export function ipaUnits(s: string): string[] {
  const norm = s
    .normalize('NFD')
    .replace(/[ˈˌ]/g, '') // Betonung (primaer/sekundaer)
    .replace(/[ːˑ]/g, '') // Laenge
    .replace(/[̀-ͯ]/g, '') // kombinierende Diakritika (Nasal, Aspiration …)
    .replace(/[͜͡‿]/g, '') // Ties: t͡ʃ -> tʃ
    .replace(/[.\s|‖/\[\]]/g, '') // Silbenpunkte, Leerraum, Grenzmarker
    .toLowerCase();
  return [...norm].filter((c) => c.trim().length > 0);
}

// Globales Alignment (Needleman-Wunsch, Einheitskosten) zwischen erwarteter
// und produzierter Lauteinheit-Folge. Liefert fuer jede ERWARTETE Position, ob
// sie exakt getroffen wurde (matched), damit sich Fehler dem jeweiligen Wort
// zuordnen lassen.
function matchedFlags(expected: string[], produced: string[]): boolean[] {
  const m = expected.length;
  const n = produced.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) dp[i][0] = i;
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = expected[i - 1] === produced[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + cost, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  const matched = new Array(m).fill(false);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const diag = dp[i - 1][j - 1];
    const same = expected[i - 1] === produced[j - 1];
    if (same && diag === dp[i][j]) {
      matched[i - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j - 1] + (same ? 0 : 1) === dp[i][j]) {
      i--; // Substitution
      j--;
    } else if (dp[i - 1][j] + 1 === dp[i][j]) {
      i--; // Auslassung (erwarteter Laut fehlt)
    } else {
      j--; // Einfuegung (zusaetzlicher Laut)
    }
  }
  return matched;
}

// Satz in Anzeige-Woerter + fuer die Phonemisierung bereinigte Woerter zerlegen.
// „Wort" bleibt mit Interpunktion (Anzeige), clean ohne fuehrende/abschliessende
// Interpunktion. Rein interpunktierte Tokens (clean leer) sind nicht bewertbar.
export function splitWords(text: string): { display: string; clean: string }[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => ({
      display: tok,
      clean: tok.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, ''),
    }));
}

// Kernbewertung. expectedIpaPerWord und words.clean sind index-gleich.
export function scorePronunciation(
  words: { display: string; clean: string }[],
  expectedIpaPerWord: string[],
  producedIpa: string,
): PronunciationResult {
  // Flache erwartete Lautfolge mit Wort-Zuordnung.
  const expUnits: string[] = [];
  const expWordIdx: number[] = [];
  const perWordTotals = words.map(() => 0);
  words.forEach((_, wi) => {
    const units = ipaUnits(expectedIpaPerWord[wi] ?? '');
    perWordTotals[wi] = units.length;
    for (const u of units) {
      expUnits.push(u);
      expWordIdx.push(wi);
    }
  });

  const prodUnits = ipaUnits(producedIpa);
  const matched = matchedFlags(expUnits, prodUnits);

  const perWordMatched = words.map(() => 0);
  matched.forEach((ok, k) => {
    if (ok) perWordMatched[expWordIdx[k]]++;
  });

  let totalExp = 0;
  let totalMatched = 0;
  const wordScores: WordScore[] = words.map((w, wi) => {
    const total = perWordTotals[wi];
    if (total === 0) return { word: w.display, score: null, ok: true };
    const score = perWordMatched[wi] / total;
    totalExp += total;
    totalMatched += perWordMatched[wi];
    return { word: w.display, score, ok: score >= WORD_OK_THRESHOLD };
  });

  return {
    overall: totalExp > 0 ? totalMatched / totalExp : 0,
    words: wordScores,
    expectedIpa: expUnits.join(''),
    producedIpa: prodUnits.join(''),
  };
}
