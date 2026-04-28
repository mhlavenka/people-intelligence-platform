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
  ISubgroupAnalysis,
  IClusterStat,
} from '../models/ConflictAnalysis.model';

// ── Quality policy ──────────────────────────────────────────────────────────

export interface QualityPolicy {
  qualityThreshold: number;       // 0..1
  longStringMaxFraction: number;  // 0..1 — fraction of items at the same value
  speedingMsPerItemFloor?: number;       // hard implausibility floor (per-response)
  speedingGroupZThreshold?: number;      // cohort modified-Z (more negative = slower than cohort).
                                         // Responses with z < threshold are cohort speeders.
  speedingMinCohortN?: number;           // gate cohort-Z check below this N (MAD unstable on small N)
}

export const DEFAULT_QUALITY_POLICY: QualityPolicy = {
  qualityThreshold: 0.35,
  longStringMaxFraction: 0.80,
  speedingMsPerItemFloor: 2_000,
  speedingGroupZThreshold: -3.5,
  speedingMinCohortN: 10,
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

/**
 * Cohort-relative speeding detection. Operates over a set of responses (the
 * caller is expected to pass the post-per-response-quality cohort, so we don't
 * double-flag anyone already dropped). Returns indices into the input array
 * for responses whose per-respondent median ms/item is more than |threshold|
 * MAD-units below the cohort median — i.e. they finished items markedly
 * faster than the rest of the team.
 *
 * Returns an empty Set when the cohort is too small for MAD to be stable
 * (< speedingMinCohortN), when fewer than 3 responses carry timing data, or
 * when the cohort's MAD is zero (no spread to compare against).
 */
export function detectCohortSpeeders(
  responses: Array<Pick<ISurveyResponse, 'timingMsPerItem'>>,
  policy: QualityPolicy = DEFAULT_QUALITY_POLICY,
): Set<number> {
  const flags = new Set<number>();
  const minN = policy.speedingMinCohortN ?? 10;
  const threshold = policy.speedingGroupZThreshold ?? -3.5;
  if (responses.length < minN) return flags;

  const medians: Array<{ idx: number; med: number }> = [];
  for (let i = 0; i < responses.length; i++) {
    const t = responses[i].timingMsPerItem;
    if (!t || t.length < 3) continue;
    medians.push({ idx: i, med: median(t) });
  }
  if (medians.length < 3) return flags;

  const cohortMed = median(medians.map((m) => m.med));
  const mad = median(medians.map((m) => Math.abs(m.med - cohortMed)));
  if (mad === 0) return flags;

  for (const { idx, med } of medians) {
    const z = (0.6745 * (med - cohortMed)) / mad;
    if (z < threshold) flags.add(idx);
  }
  return flags;
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
  const histogram = buildHistogram(values, range.min, range.max);

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
    histogram,
  };
}

/** Bin integer-valued responses into a dense per-scale-point count array.
 *  Length = scaleMax - scaleMin + 1, values rounded to nearest integer for
 *  binning (Likert + boolean responses are integer; defensive otherwise). */
function buildHistogram(values: number[], scaleMin: number, scaleMax: number): number[] {
  const lo = Math.round(scaleMin);
  const hi = Math.round(scaleMax);
  const len = Math.max(1, hi - lo + 1);
  const bins = new Array<number>(len).fill(0);
  for (const v of values) {
    const idx = Math.round(v) - lo;
    if (idx >= 0 && idx < len) bins[idx]++;
  }
  return bins;
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
    // Dimension mean is computed only over continuous-scale items. Boolean
    // items (scaleMax - scaleMin <= 1) live on a 0/1 scale and would otherwise
    // drag the average down — e.g. Psychological Safety on HNP-PULSE was
    // landing at 5.71 because cp03's "no incident" 0 averaged with cp01/cp02's
    // 8.5/9 on a 0-10 scale. rWG aggregation still includes booleans since
    // each item's rwg is normalised against its own scale.
    const continuousItems = items.filter((i) => {
      if (typeof i.scaleMin !== 'number' || typeof i.scaleMax !== 'number') return true;
      return (i.scaleMax - i.scaleMin) > 1;
    });
    const meanVal = continuousItems.length > 0
      ? round(mean(continuousItems.map((i) => i.mean)), 2)
      : null;
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
      mean: meanVal,
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

// ── Layer 4: subgroup detection (Phase 2) ───────────────────────────────────

export interface SubgroupPolicy {
  minTotalN: number;        // global gate: don't even attempt clustering below this
  minSubgroupN: number;     // anonymity guard: drop analysis if any cluster smaller
  minSilhouette: number;    // quality gate: drop analysis if best k below this
  kCandidates: number[];    // typically [2, 3]
  restarts: number;         // k-means random restarts; best inertia wins
  maxIterations: number;
  seed: number;             // RNG seed so re-running an analysis is deterministic
}

export const DEFAULT_SUBGROUP_POLICY: SubgroupPolicy = {
  minTotalN: 10,
  minSubgroupN: 3,
  minSilhouette: 0.5,
  kCandidates: [2, 3],
  restarts: 10,
  maxIterations: 100,
  seed: 42,
};

/**
 * Cluster respondents on their full response vector using k-means with
 * k-means++ init and silhouette-driven k selection. Returns null when:
 * - total N < minTotalN, or
 * - no k yields silhouette ≥ minSilhouette, or
 * - any cluster at the chosen k is smaller than minSubgroupN
 *   (anonymity floor — never publish a 1- or 2-person cluster).
 *
 * The output never carries respondent identifiers — only cluster sizes
 * and aggregated per-dimension means.
 */
export function computeSubgroupAnalysis(
  responses: Array<Pick<ISurveyResponse, 'responses' | 'acceptedInAnalysis'>>,
  template: ISurveyTemplate,
  policy: SubgroupPolicy = DEFAULT_SUBGROUP_POLICY,
): ISubgroupAnalysis | null {
  const accepted = responses.filter((r) => r.acceptedInAnalysis !== false);
  if (accepted.length < policy.minTotalN) return null;

  // Build numeric feature vectors from scoreable questions only.
  const scoreable = template.questions.filter(
    (q) => q.type === 'scale' || q.type === 'boolean',
  );
  if (scoreable.length < 2) return null;

  const vectors: number[][] = [];
  for (const r of accepted) {
    const vec = scoreable.map((q) => {
      const ans = r.responses.find((x) => x.questionId === q.id);
      if (!ans) return NaN;
      if (typeof ans.value === 'number') return ans.value;
      if (typeof ans.value === 'boolean') return ans.value ? 1 : 0;
      return NaN;
    });
    // Skip respondents with too many missing scoreable answers.
    const present = vec.filter((v) => !Number.isNaN(v)).length;
    if (present / vec.length < 0.5) continue;
    // Mean-impute missing entries within the respondent.
    const respMean = mean(vec.filter((v) => !Number.isNaN(v)));
    vectors.push(vec.map((v) => (Number.isNaN(v) ? respMean : v)));
  }
  if (vectors.length < policy.minTotalN) return null;

  // Try each candidate k; keep the one with the best silhouette.
  let best: { k: number; labels: number[]; silhouette: number } | null = null;
  for (const k of policy.kCandidates) {
    if (k > vectors.length) continue;
    const labels = bestKMeansRun(vectors, k, policy);
    if (!labels) continue;
    const sil = silhouetteScore(vectors, labels);
    if (!best || sil > best.silhouette) {
      best = { k, labels, silhouette: sil };
    }
  }

  if (!best || best.silhouette < policy.minSilhouette) return null;

  // Anonymity floor — every cluster must have at least minSubgroupN members.
  const sizes = new Map<number, number>();
  for (const l of best.labels) sizes.set(l, (sizes.get(l) ?? 0) + 1);
  for (const size of sizes.values()) {
    if (size < policy.minSubgroupN) return null;
  }

  // Build per-cluster stats. Computed against the original respondent set
  // (matched by index — vectors[i] came from accepted[matched[i]]) so we can
  // compute per-dimension means using the existing item metrics machinery.
  const clusters: IClusterStat[] = [];
  const labelSet = [...new Set(best.labels)].sort((a, b) => a - b);
  for (const lbl of labelSet) {
    const inCluster = accepted.filter((_, i) => best!.labels[i] === lbl);
    const itemMetrics = template.questions
      .map((q) => computeItemMetrics(inCluster, q))
      .filter((m): m is IItemMetric => m !== null);
    const dimRows = rollupByDimension(itemMetrics);
    const meanByDimension: Record<string, number> = {};
    for (const d of dimRows) {
      if (typeof d.mean === 'number') meanByDimension[d.dimension] = d.mean;
    }

    // Distinguishing items: items where THIS cluster's mean differs most
    // (absolute) from the global accepted-set mean. Top 3.
    const globalMetricsMap = new Map<string, IItemMetric>();
    for (const q of template.questions) {
      const m = computeItemMetrics(accepted, q);
      if (m) globalMetricsMap.set(q.id, m);
    }
    const distinguishing = itemMetrics
      .map((m) => ({
        id: m.questionId,
        delta: Math.abs(m.mean - (globalMetricsMap.get(m.questionId)?.mean ?? m.mean)),
      }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3)
      .map((x) => x.id);

    clusters.push({
      label: String.fromCharCode(65 + lbl),  // 0 → 'A', 1 → 'B', 2 → 'C'
      size: sizes.get(lbl) ?? 0,
      meanByDimension,
      distinguishingItemIds: distinguishing,
    });
  }

  return {
    k: best.k,
    silhouette: round(best.silhouette, 3),
    clusters,
  };
}

// ── Top-level convenience ───────────────────────────────────────────────────

export interface FullSurveyMetrics {
  responseQuality: IResponseQuality;
  itemMetrics: IItemMetric[];
  dimensionMetrics: IDimensionMetric[];
  teamAlignmentScore: number;
  subgroupAnalysis: ISubgroupAnalysis | null;
}

/**
 * Compute everything Phase 1 + Phase 2 needs from a freshly-fetched response
 * set. Caller is expected to have already persisted per-response qualityScore
 * (via computeQuality at submit time); we only summarize them here. Subgroup
 * analysis is gated on policy (callable can pass null to disable).
 *
 * Cohort-relative speeding: responses passing per-response quality but whose
 * timing is far below the rest of the cohort are dropped from THIS analysis
 * only (we never mutate the SurveyResponse documents). They are counted in
 * responseQuality.droppedReasons.speeding so the response-quality card stays
 * truthful.
 */
export function computeAllMetrics(
  responses: ISurveyResponse[],
  template: ISurveyTemplate,
  subgroupPolicy: SubgroupPolicy | null = DEFAULT_SUBGROUP_POLICY,
  qualityPolicy: QualityPolicy = DEFAULT_QUALITY_POLICY,
): FullSurveyMetrics {
  const preAccepted = responses.filter((r) => r.acceptedInAnalysis !== false);
  const cohortSpeeders = detectCohortSpeeders(preAccepted, qualityPolicy);
  const accepted = preAccepted.filter((_, i) => !cohortSpeeders.has(i));

  // Fold cohort-flagged speeders into the responseQuality summary so the UI
  // attributes them correctly. Per-response drops are still counted by their
  // own flags (straightlining / longString / per-response speeding floor).
  const baseQuality = summarizeQuality(responses);
  const responseQuality: IResponseQuality = {
    ...baseQuality,
    acceptedCount: baseQuality.acceptedCount - cohortSpeeders.size,
    droppedCount: baseQuality.droppedCount + cohortSpeeders.size,
    droppedReasons: {
      ...baseQuality.droppedReasons,
      speeding: (baseQuality.droppedReasons.speeding ?? 0) + cohortSpeeders.size,
    },
  };

  const itemMetrics = template.questions
    .map((q) => computeItemMetrics(accepted, q))
    .filter((m): m is IItemMetric => m !== null);

  return {
    responseQuality,
    itemMetrics,
    dimensionMetrics: rollupByDimension(itemMetrics),
    teamAlignmentScore: teamAlignmentScore(itemMetrics),
    subgroupAnalysis: subgroupPolicy
      ? computeSubgroupAnalysis(accepted, template, subgroupPolicy)
      : null,
  };
}

/**
 * Audit-mode counterpart to computeAllMetrics: ignores per-response quality
 * flags AND cohort speeders, computing the metric blocks against every
 * submitted response. Intended for the admin "show without quality filter"
 * toggle on the divergence panel — never feeds the AI narrative.
 *
 * The responseQuality summary on this view reports totalSubmitted == accepted
 * and droppedCount == 0, since no filtering was applied. Audit context (how
 * many WOULD have been dropped, and why) lives on the filtered metrics
 * persisted alongside.
 */
export function computeAllMetricsUnfiltered(
  responses: ISurveyResponse[],
  template: ISurveyTemplate,
  subgroupPolicy: SubgroupPolicy | null = DEFAULT_SUBGROUP_POLICY,
): FullSurveyMetrics {
  const itemMetrics = template.questions
    .map((q) => computeItemMetrics(responses, q))
    .filter((m): m is IItemMetric => m !== null);

  // Subgroup detection still honours its own anonymity floor; we just bypass
  // the acceptedInAnalysis filter by mapping every response to an accepted
  // shape before passing it in.
  const allAccepted = responses.map((r) => ({ ...r, acceptedInAnalysis: true }));

  return {
    responseQuality: {
      totalSubmitted: responses.length,
      acceptedCount: responses.length,
      droppedCount: 0,
      droppedReasons: {},
    },
    itemMetrics,
    dimensionMetrics: rollupByDimension(itemMetrics),
    teamAlignmentScore: teamAlignmentScore(itemMetrics),
    subgroupAnalysis: subgroupPolicy
      ? computeSubgroupAnalysis(allAccepted as ISurveyResponse[], template, subgroupPolicy)
      : null,
  };
}

// ── k-means + silhouette ────────────────────────────────────────────────────

/** mulberry32 PRNG — deterministic seed → reproducible cluster assignments. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function squaredDistance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return s;
}

/** k-means++ seeding: spread initial centroids by squared-distance probability. */
function kMeansPlusPlus(vectors: number[][], k: number, rng: () => number): number[][] {
  const centroids: number[][] = [];
  centroids.push([...vectors[Math.floor(rng() * vectors.length)]]);
  for (let i = 1; i < k; i++) {
    const distances = vectors.map((v) =>
      Math.min(...centroids.map((c) => squaredDistance(v, c))),
    );
    const total = distances.reduce((s, d) => s + d, 0);
    if (total === 0) { centroids.push([...vectors[Math.floor(rng() * vectors.length)]]); continue; }
    let r = rng() * total;
    let pick = 0;
    for (let j = 0; j < distances.length; j++) {
      r -= distances[j];
      if (r <= 0) { pick = j; break; }
    }
    centroids.push([...vectors[pick]]);
  }
  return centroids;
}

/** One k-means restart. Returns labels + total inertia (sum sq-distance to centroid). */
function lloydsAlgorithm(
  vectors: number[][],
  initial: number[][],
  maxIter: number,
): { labels: number[]; inertia: number } {
  const k = initial.length;
  let centroids = initial.map((c) => [...c]);
  let labels = new Array<number>(vectors.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < vectors.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = squaredDistance(vectors[i], centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
    }
    if (!changed) break;

    // Recompute centroids as mean of assigned points.
    const dim = vectors[0].length;
    const sums = Array.from({ length: k }, () => new Array<number>(dim).fill(0));
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < vectors.length; i++) {
      const c = labels[i];
      counts[c]++;
      for (let d = 0; d < dim; d++) sums[c][d] += vectors[i][d];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      for (let d = 0; d < dim; d++) centroids[c][d] = sums[c][d] / counts[c];
    }
  }

  let inertia = 0;
  for (let i = 0; i < vectors.length; i++) inertia += squaredDistance(vectors[i], centroids[labels[i]]);
  return { labels, inertia };
}

/** Run k-means for `policy.restarts` times; keep the labelling with lowest inertia. */
function bestKMeansRun(
  vectors: number[][],
  k: number,
  policy: SubgroupPolicy,
): number[] | null {
  let best: { labels: number[]; inertia: number } | null = null;
  for (let r = 0; r < policy.restarts; r++) {
    const rng = makeRng(policy.seed + r);
    const initial = kMeansPlusPlus(vectors, k, rng);
    const result = lloydsAlgorithm(vectors, initial, policy.maxIterations);
    if (!best || result.inertia < best.inertia) best = result;
  }
  return best?.labels ?? null;
}

/** Mean silhouette score across all points. s_i ∈ [-1, 1]; >0.5 ⇒ strong structure. */
function silhouetteScore(vectors: number[][], labels: number[]): number {
  if (vectors.length < 2) return 0;
  const labelSet = [...new Set(labels)];
  if (labelSet.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < vectors.length; i++) {
    const ownLabel = labels[i];
    let aSum = 0, aCount = 0;
    const bSums = new Map<number, { sum: number; count: number }>();
    for (let j = 0; j < vectors.length; j++) {
      if (i === j) continue;
      const dist = Math.sqrt(squaredDistance(vectors[i], vectors[j]));
      if (labels[j] === ownLabel) { aSum += dist; aCount++; }
      else {
        const cur = bSums.get(labels[j]) ?? { sum: 0, count: 0 };
        cur.sum += dist; cur.count++;
        bSums.set(labels[j], cur);
      }
    }
    const a = aCount > 0 ? aSum / aCount : 0;
    let b = Infinity;
    for (const { sum, count } of bSums.values()) {
      if (count === 0) continue;
      const mean = sum / count;
      if (mean < b) b = mean;
    }
    if (!Number.isFinite(b)) continue;
    const s = b === 0 && a === 0 ? 0 : (b - a) / Math.max(a, b);
    total += s;
  }
  return total / vectors.length;
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

/**
 * Resolve the scale range used by rwg() for a question's expected variance
 * (σ²eu = (A² − 1) / 12, where A = scaleMax − scaleMin + 1).
 *
 * Order of preference:
 *   1. q.scale_range (explicit, always wins)
 *   2. q.type-based defaults — boolean → {0, 1}; scale → {0, 10}
 *   3. observed min/max (LAST resort, unsafe — collapses range to actual
 *      spread which makes σ²eu tiny and produces false rWG=0 readings on
 *      uniformly positive data)
 *
 * Without #2, the previous fallback to observed min/max made any team with
 * compressed positive responses (means 8-9, σ ≈ 0.5) get rWG=0 across
 * supposedly aligned dimensions — see todo.md "rWG = 0 on uniformly
 * positive distributions" for the original report.
 */
function effectiveScaleRange(q: IQuestion, observed: number[]): { min: number; max: number } {
  const sr: IScaleRange | undefined = q.scale_range;
  if (sr && typeof sr.min === 'number' && typeof sr.max === 'number') {
    return { min: sr.min, max: sr.max };
  }
  if (q.type === 'boolean')      return { min: 0, max: 1 };
  if (q.type === 'scale')        return { min: 0, max: 10 };
  // Final fallback only for unrecognised types.
  return { min: Math.min(...observed), max: Math.max(...observed) };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}
