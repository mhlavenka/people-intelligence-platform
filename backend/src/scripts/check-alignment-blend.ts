/**
 * Sanity-check the blended teamAlignmentScore against canonical case-study
 * patterns. Read-only — uses synthetic per-respondent data to verify the
 * formula produces the expected band for each pattern.
 *
 *   npx ts-node src/scripts/check-alignment-blend.ts
 *
 * Expected output:
 *   CASE01 aligned-high      → 70+   (Aligned)
 *   CASE02 aligned-mediocre  → 70+   (Aligned)
 *   CASE03 4+4 fracture      → ≤39   (Fractured)
 *   CASE04 6+6 by-shift      → ≤39   (Fractured)
 *   CASE05 9+1 outlier       → 55-70 (Mixed — minority voice)
 *   CASE09 aligned-low       → 70+   (Aligned, but low means)
 */
import { computeItemMetrics, teamAlignmentScore } from '../services/surveyMetrics.service';
import type { IItemMetric } from '../models/ConflictAnalysis.model';

interface SyntheticResponse { responses: Array<{ questionId: string; value: number | boolean }> }

function makeResponses(perRespondentValues: number[][]): SyntheticResponse[] {
  // Each row is one respondent; each column is one item. We synthesise 5 scale
  // items (cp01..cp05) on a 1-10 scale to keep it minimal but representative.
  return perRespondentValues.map((values) => ({
    responses: values.map((v, i) => ({ questionId: `cp0${i + 1}`, value: v })),
  }));
}

function makeQuestion(id: string) {
  return {
    id, text: `Question ${id}`, dimension: 'Test', type: 'scale' as const,
    scaleMin: 1, scaleMax: 10,
  } as any;
}

interface Case {
  label: string;
  expected: string;
  rows: number[][];
}

const CASES: Case[] = [
  {
    label: 'CASE01 aligned-high       ',
    expected: '70+   Aligned',
    rows: [
      [9, 9, 8, 9, 9],
      [8, 9, 9, 9, 8],
      [9, 8, 9, 8, 9],
      [9, 9, 8, 9, 9],
      [8, 9, 9, 8, 9],
      [9, 9, 9, 9, 8],
      [8, 9, 8, 9, 9],
      [9, 8, 9, 9, 8],
    ],
  },
  {
    label: 'CASE02 aligned-mediocre   ',
    expected: '70+   Aligned',
    rows: [
      [5, 6, 5, 6, 5],
      [6, 5, 6, 5, 6],
      [5, 5, 6, 6, 5],
      [6, 6, 5, 5, 6],
      [5, 6, 6, 5, 5],
      [6, 5, 5, 6, 6],
      [5, 6, 5, 6, 5],
      [6, 5, 6, 5, 6],
      [5, 6, 5, 5, 6],
      [6, 5, 6, 6, 5],
    ],
  },
  {
    label: 'CASE03 4+4 fracture       ',
    expected: '≤39   Fractured',
    rows: [
      [2, 2, 3, 2, 2],
      [2, 3, 2, 2, 3],
      [3, 2, 2, 3, 2],
      [2, 2, 3, 2, 2],
      [8, 9, 8, 8, 9],
      [9, 8, 9, 8, 8],
      [8, 8, 9, 9, 8],
      [8, 9, 8, 9, 8],
    ],
  },
  {
    label: 'CASE04 6+6 by-shift       ',
    expected: '≤39   Fractured',
    rows: [
      [3, 3, 2, 3, 2], [3, 2, 3, 2, 3], [2, 3, 3, 3, 2],
      [3, 2, 2, 3, 3], [2, 3, 3, 2, 3], [3, 3, 2, 3, 2],
      [8, 9, 8, 9, 8], [9, 8, 9, 8, 9], [8, 8, 9, 9, 8],
      [9, 9, 8, 8, 9], [8, 9, 9, 8, 8], [9, 8, 8, 9, 9],
    ],
  },
  {
    label: 'CASE05 9+1 outlier        ',
    expected: '55-70 Mixed',
    rows: [
      [8, 8, 8, 8, 8], [9, 8, 8, 9, 8], [8, 9, 9, 8, 8],
      [8, 8, 8, 8, 8], [9, 8, 9, 8, 9], [8, 9, 8, 8, 8],
      [8, 8, 8, 8, 8], [9, 9, 8, 9, 9], [8, 8, 8, 8, 8],
      [1, 2, 1, 2, 1],
    ],
  },
  {
    label: 'CASE09 aligned-low        ',
    expected: '70+   Aligned',
    rows: [
      [2, 2, 1, 2, 2], [1, 2, 2, 2, 1], [2, 1, 2, 1, 2],
      [2, 2, 2, 2, 1], [1, 2, 2, 1, 2], [2, 2, 1, 2, 2],
      [2, 1, 2, 2, 2], [1, 2, 2, 2, 2],
    ],
  },
];

function bandFor(score: number): string {
  if (score >= 70) return 'Aligned';
  if (score >= 40) return 'Mixed';
  return 'Fractured';
}

function main() {
  const questions = ['cp01', 'cp02', 'cp03', 'cp04', 'cp05'].map(makeQuestion);
  console.log('LABEL                       SCORE  BAND        EXPECTED');
  console.log('─'.repeat(72));
  for (const c of CASES) {
    const responses = makeResponses(c.rows);
    const itemMetrics: IItemMetric[] = [];
    for (const q of questions) {
      const m = computeItemMetrics(responses, q);
      if (m) itemMetrics.push(m);
    }
    const score = teamAlignmentScore(itemMetrics);
    const band = bandFor(score);
    console.log(`${c.label}  ${String(score).padStart(3)}    ${band.padEnd(10)}  ${c.expected}`);
  }
}

main();
