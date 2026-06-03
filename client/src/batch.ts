// SEL1: batch-selectie voor grote lijsten (Songs / Kanaal / Playlist).
// Pure helpers — apart gehouden zodat ze los te testen zijn.

/** Instelbare batchgroottes; 50 is de default. */
export const BATCH_SIZES = [25, 50, 100] as const;
export const DEFAULT_BATCH_SIZE = 50;

/**
 * Drempel waarboven de batch-UI verschijnt. Kleine lijsten (o.a. de Album-tab,
 * die in de Songs-tab landt) blijven zo zonder ruis: pas bij meer gevonden
 * rijen dan de kleinste batch heeft batchen zin.
 */
export const BATCH_UI_THRESHOLD = BATCH_SIZES[0]; // 25

/** Eén bereik, 1-based en inclusief — bedoeld voor het label "start–end". */
export interface BatchRange {
  start: number;
  end: number;
}

/**
 * Verdeelt `foundCount` gevonden rijen in opeenvolgende bereiken van
 * `batchSize`. Het laatste bereik is korter als het niet precies opgaat.
 */
export function batchRanges(foundCount: number, batchSize: number): BatchRange[] {
  if (foundCount <= 0 || batchSize <= 0) return [];
  const ranges: BatchRange[] = [];
  for (let s = 0; s < foundCount; s += batchSize) {
    ranges.push({ start: s + 1, end: Math.min(s + batchSize, foundCount) });
  }
  return ranges;
}
