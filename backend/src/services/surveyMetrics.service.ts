/**
 * Survey divergence metrics — Layer 1 (response quality), Layer 2 (per-item),
 * Layer 3 (dimensional roll-up), and the team-alignment headline score.
 *
 * All math runs on the raw SurveyResponse list passed in by the caller. No DB
 * I/O. The conflict controller is the single intended caller; the AI prompt
 * builder consumes the returned shapes verbatim.
 *
 * References (see docs/design/survey_divergence_and_truth_signals.md §3):
 * - Modified Z-score (Iglewicz & Hoaglin, 1993)
 * - Bimodality coefficient (SAS, Pfister et al. 2013)
 * - James-Demaree-Wolf rwg (1984)
 * - Shannon entropy (base e)
 */
import { ISurveyResponse } from '../models/SurveyResponse.model';
import {
  ISurveyTemplate,
  IQuestion,
  IScaleRange,
} from '../models/SurveyTemplate.model';
import {
  IItemMetric,
  IDimensionMetric,
  IResponseQuality,
} from '../models/ConflictAnalysis.model';

// ── Quality policy ──────────────────────────────────────────────────────────

export interface QualityPolicy {
  qualityThreshold: number;       // 0..1
  longStringMaxFraction: number;  // 0..1 — fraction of items at the same value
  speedingMsPerItemFloor?: number; // optional, only used when timing exists
}

export const DEFAULT_QUALITY_POLICY: QualityPolicy = {
  qualityThreshold: 0.35,
  longStringMaxFraction: 0.80,
  speedingMsPerItemFloor: 2_000,
};

// ── Layer 1: per-response quality ───────────────────────────────────────────

export interface QualityResult {
  qualityScore: number;          // 0..1
  qualityFlags: string[];
  acceptedInAnalysis: boolean;
}

/**
 * Score a single response on careless-responding indicators.
 * Returns a permissive default (1.0, accepted) when there's nothing scoreable.
 */
export function computeQuality(
  response: Pick<ISurveyResponse, 'responses' | 'timingMsPerItem'>,
  policy: QualityPolicy = DEFAULT_QUALITY_POLICY,
): QualityResult {
  const numerics = response.responses
    .map((r) => r.value)
    .filter((v): v is number => typeof v === 'number');

  // No scoreable items (all text / boolean): flag-free, accepted.
  if (numerics.length < 3) {
    return { qualityScore: 1, qualityFlags: [], acceptedInAnalysis: true };
  }

  const flags: string[] = [];
  let penalty = 0;

  // Variance-within: very low variance ⇒ straightlining. Normalize against
  // the empirical mid-range so scales of different widths are comparable.
  const variance = sampleVariance(numerics);
  const range = Math.max(...numerics) - Math.min(...numerics);
  const expectedMinVariance = Math.max(0.5, (range / 4) ** 2 / 8);
  if (variance < expectedMinVariance * 0.25) {
    flags.push('straightlining');
    penalty += 0.40;
  }

  // Longest-run of identical answers across items.
  const longestRun = longestIdenticalRun(numerics);
  const runFraction = longestRun / numerics.length;
  if (runFraction >= policy.longStringMaxFraction) {
    flags.push('longString');
    penalty += 0.40;
  }

  // Speeding (only if timing was captured).
  if (response.timingMsPerItem && response.timingMsPerItem.length >= 3 && policy.speedingMsPerItemFloor) {
    const med = median(response.timingMsPerItem);
    if (med < policy.speedingMsPerItemFloor) {
      flags.push('speeding');
      penalty += 0.25;
    }
  }

  const qualityScore = clamp(1 - penalty, 0, 1);
  const acceptedInAnalysis = qualityScore >= policy.qualityThreshold;
  return { qualityScore, qualityFlags: flags, acceptedInAnalysis };
}

/** Aggregate per-response quality flags into the IResponseQuality summary. */
export function summarizeQuality(
  responses: Array<Pick<ISurveyResponse, 'qualityFlags' | 'acceptedInAnalysis'>>,
): IResponseQuality {
  const totalSubmitted = responses.length;
  const acceptedCount = responses.filter((r) => r.acceptedInAnalysis !== false).length;
  const droppedCount = totalSubmitted - acceptedCount;
  const droppedReasons: IResponseQuality['droppedReasons'] = {};
  for (const r of responses) {
    if (r.acceptedInAnalysis !== false) continue;
    for (const f of r.qualityFlags ?? []) {
      const k = f as keyof IResponseQuality['droppedReasons'];
      droppedReasons[k] = (droppedReasons[k] ?? 0) + 1;
    }
  }
  return { totalSubmitted, acceptedCount, droppedCount, droppedReasons };
}

// ── Layer 2: per-item metrics ───────────────────────────────────────────────

/** Compute divergence metrics for a single question across a response set. */
export function computeItemMetrics(
  responses: Array<Pick<ISurveyResponse, 'responses'>>,
  question: IQuestion,
): IItemMetric | null {
  const values: number[] = [];
  for (const r of responses) {
    const item = r.responses.find((x) => x.questionId === question.id);
    if (!item) continue;
    if (typeof item.value === 'number') values.push(item.value);
    else if (typeof item.value === 'boolean') values.push(item.value ? 1 : 0);
  }
  if (values.length < 2) return null;

  const range = effectiveScaleRange(question, values);

  return {
    questionId: question.id,
    text: question.text,
    dimension: question.dimension,
    mean: round(mean(values), 2),
    median: round(median(values), 2),
    sd: round(Math.sqrt(sampleVariance(values)), 2),
    iqr: round(iqr(values), 2),
    bimodalityCoef: round(bimodalityCoefficient(values), 3),
    entropy: round(shannonEntropy(values), 3),
    rwg: round(rwg(values, range.min, range.max), 3),
    outlierCount: countOutliersModifiedZ(values),
    scaleMin: range.min,
    scaleMax: range.max,
  };
}

// ── Layer 3: dimensional roll-up ────────────────────────────────────────────

/** Group item metrics by the question's dimension; emits 'Ungrouped' when none. */
export function rollupByDimension(itemMetrics: IItemMetric[]): IDimensionMetric[] {
  const groups = new Map<string, IItemMetric[]>();
  for (const m of itemMetrics) {
    const key = m.dimension?.trim() || 'Ungrouped';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const out: IDimensionMetric[] = [];
  for (const [dimension, items] of groups) {
    const meanVal = mean(items.map((i) => i.mean));
    const rwgVal = mean(items.map((i) => i.rwg));
    // Disagreement score: invert mean rwg, scale to 0-100.
    const disagreementScore = round(clamp((1 - rwgVal) * 100, 0, 100), 0);
    // Surface up to 3 most divergent items in this dimension (lowest rwg).
    const mostDivergent = [...items]
      .sort((a, b) => a.rwg - b.rwg)
      .slice(0, 3)
      .map((i) => i.questionId);
    out.push({
      dimension,
      itemCount: items.length,
      mean: round(meanVal, 2),
      rwg: round(rwgVal, 3),
      disagreementScore,
      mostDivergentItemIds: mostDivergent,
    });
  }
  // Stable sort: Ungrouped last, then by descending disagreement.
  out.sort((a, b) => {
    if (a.dimension === 'Ungrouped') return 1;
    if (b.dimension === 'Ungrouped') return -1;
    return b.disagreementScore - a.disagreementScore;
  });
  return out;
}

// ── Layer 5: team-alignment headline (0-100) ────────────────────────────────

/**
 * Headline alignment score: average rwg across items, scaled to 0-100.
 * Bands (used by the dashboard tile):
 *   70-100 = aligned, 40-69 = mixed, 0-39 = fractured.
 */
export function teamAlignmentScore(itemMetrics: IItemMetric[]): number {
  if (itemMetrics.length === 0) return 0;
  const r = mean(itemMetrics.map((i) => i.rwg));
  return round(clamp(r * 100, 0, 100), 0);
}

// ── Top-level convenience ───────────────────────────────────────────────────

export interface FullSurveyMetrics {
  responseQuality: IResponseQuality;
  itemMetrics: IItemMetric[];
  dimensionMetrics: IDimensionMetric[];
  teamAlignmentScore: number;
}

/**
 * Compute everything Phase 1 needs from a freshly-fetched response set.
 * Caller is expected to have already persisted per-response qualityScore
 * (via computeQuality at submit time); we only summarize them here.
 */
export function computeAllMetrics(
  responses: ISurveyResponse[],
  template: ISurveyTemplate,
): FullSurveyMetrics {
  const accepted = responses.filter((r) => r.acceptedInAnalysis !== false);
  const itemMetrics = template.questions
    .map((q) => computeItemMetrics(accepted, q))
    .filter((m): m is IItemMetric => m !== null);

  return {
    responseQuality: summarizeQuality(responses),
    itemMetrics,
    dimensionMetrics: rollupByDimension(itemMetrics),
    teamAlignmentScore: teamAlignmentScore(itemMetrics),
  };
}

// ── Math primitives ─────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function sampleVariance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1);
}

function iqr(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => {
    const i = (s.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  return q(0.75) - q(0.25);
}

/** Pearson skewness/kurtosis-based bimodality coefficient (SAS macro). */
function bimodalityCoefficient(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return 0;
  const m = mean(xs);
  const sd = Math.sqrt(sampleVariance(xs));
  if (sd === 0) return 0;
  const m3 = xs.reduce((s, v) => s + ((v - m) / sd) ** 3, 0) / n;
  const m4 = xs.reduce((s, v) => s + ((v - m) / sd) ** 4, 0) / n;
  const skew = m3;
  const kurt = m4 - 3; // excess
  const denom = kurt + (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  if (denom <= 0) return 0;
  return (skew * skew + 1) / denom;
}

/** Shannon entropy (base e) of the value distribution. */
function shannonEntropy(xs: number[]): number {
  const counts = new Map<number, number>();
  for (const v of xs) counts.set(v, (counts.get(v) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / xs.length;
    h -= p * Math.log(p);
  }
  return h;
}

/**
 * James-Demaree-Wolf rwg(1) — within-group agreement for a Likert-style scale.
 * Compares observed variance to the variance expected from uniform random
 * responding on the scale: σ²_eu = (A² − 1) / 12 where A = number of scale points.
 */
function rwg(xs: number[], scaleMin: number, scaleMax: number): number {
  const A = Math.max(2, Math.round(scaleMax - scaleMin + 1));
  const expected = (A * A - 1) / 12;
  const observed = sampleVariance(xs);
  if (expected <= 0) return 1;
  const r = 1 - observed / expected;
  return clamp(r, 0, 1);
}

/** Modified Z-score outlier count (|0.6745 * (x - median) / MAD| > 3.5). */
function countOutliersModifiedZ(xs: number[]): number {
  const med = median(xs);
  const deviations = xs.map((v) => Math.abs(v - med));
  const mad = median(deviations);
  if (mad === 0) return 0;
  let count = 0;
  for (const v of xs) {
    const z = Math.abs(0.6745 * (v - med) / mad);
    if (z > 3.5) count++;
  }
  return count;
}

function longestIdenticalRun(xs: number[]): number {
  if (xs.length === 0) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] === xs[i - 1]) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

function effectiveScaleRange(q: IQuestion, observed: number[]): { min: number; max: number } {
  const sr: IScaleRange | undefined = q.scale_range;
  if (sr && typeof sr.min === 'number' && typeof sr.max === 'number') {
    return { min: sr.min, max: sr.max };
  }
  // Boolean-coerced or unspecified scale: derive from data.
  return { min: Math.min(...observed), max: Math.max(...observed) };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}
