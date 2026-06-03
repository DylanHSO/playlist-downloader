import { describe, expect, it } from 'vitest';
import { batchRanges } from '../client/src/batch';

describe('batchRanges (SEL1)', () => {
  it('verdeelt in opeenvolgende, 1-based, inclusieve bereiken', () => {
    expect(batchRanges(120, 50)).toEqual([
      { start: 1, end: 50 },
      { start: 51, end: 100 },
      { start: 101, end: 120 },
    ]);
  });

  it('geeft één bereik als alles in één batch past', () => {
    expect(batchRanges(40, 50)).toEqual([{ start: 1, end: 40 }]);
  });

  it('kapt het laatste bereik af op foundCount', () => {
    expect(batchRanges(100, 50)).toEqual([
      { start: 1, end: 50 },
      { start: 51, end: 100 },
    ]);
  });

  it('geeft een lege lijst bij niets gevonden of ongeldige batchgrootte', () => {
    expect(batchRanges(0, 50)).toEqual([]);
    expect(batchRanges(10, 0)).toEqual([]);
    expect(batchRanges(-5, 50)).toEqual([]);
  });
});
