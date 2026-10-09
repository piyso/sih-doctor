/**
 * Words the speech engine was not sure of.
 *
 * The hospital speech server decodes Hindi audio again at 0.9× and 1.1× speed (edge-ai ASR_TTA_SPEEDS).
 * The re-decodes make different mistakes, so a word that they do not reproduce is one the engine could
 * easily have got wrong. Those words are marked for the clinician to check. With no re-decodes (e.g.
 * English), nothing is marked: absence of a mark means "not checked", never "certain".
 */

export interface MarkedWord { text: string; uncertain: boolean }

// Spelling variants that are not recognition differences: nukta (मरीज़/मरीज), chandrabindu/anusvara (हाँ/हां), punctuation.
const norm = (w: string) => w.normalize('NFD').toLowerCase().replace(/[.,!?।॥;:"'()[\]{}“”‘’…-]/g, '').replace(/\u093C/g, '').replace(/\u0901/g, '\u0902').normalize('NFC');

/** Indices of `a` that belong to a longest common subsequence with `b` (compared after normalising). */
function matchedIndices(a: string[], b: string[]): Set<number> {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = new Set<number>();
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.add(i); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return out;
}

/** Splits the transcript into words, marking those that at least one re-decode did not reproduce. */
export function markUncertainWords(primary: string, alternatives: string[] = []): MarkedWord[] {
  const words = (primary || '').split(/\s+/).filter(Boolean);
  const alts = alternatives.map(a => (a || '').split(/\s+/).filter(Boolean).map(norm)).filter(a => a.length);
  if (!alts.length || words.length > 400) return words.map(text => ({ text, uncertain: false }));
  const keys = words.map(norm);
  const matched = alts.map(a => matchedIndices(keys, a));
  return words.map((text, i) => ({ text, uncertain: keys[i] !== '' && matched.some(set => !set.has(i)) }));
}

export const uncertainCount = (words: MarkedWord[]) => words.filter(w => w.uncertain).length;

/**
 * A clip whose text is not worth showing as a transcript line: almost no letters, or a few words that every
 * re-decode disagrees on. On a fan hum or a beep the Hindi model emits fragments such as "म" or "हम पी पी पी"
 * while its re-decodes say "ह" — that is noise, not speech. Such clips are held back and counted, never silently
 * dropped (the clinician can still show them).
 */
export function isUnclearClip(primary: string, words: MarkedWord[], alternatives: string[] = []): boolean {
  const letters = (primary || '').replace(/[\s\p{P}\p{S}\d]/gu, '');
  if ([...letters].length < 2) return true;
  return alternatives.length >= 2 && words.length > 0 && words.length <= 4 && words.every(w => w.uncertain);
}
