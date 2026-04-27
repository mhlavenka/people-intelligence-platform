/**
 * Backfill itemMetrics[].histogram on existing ConflictAnalyses so the
 * per-item bar chart renders for analyses created before the histogram
 * field existed.
 *
 * Strategy: re-fetch the response cohort that existed at analysis time
 * (templateId + departmentId + createdAt <= analysis.createdAt + accepted
 * filter), compute per-question histograms, and patch them onto the
 * stored itemMetrics in place. Headline stats (mean, sd, rwg, etc.) are
 * left untouched.
 *
 * Idempotent — analyses whose itemMetrics already carry histograms are
 * skipped. Dry-run by default; pass --apply to write.
 *
 *   npx ts-node src/scripts/backfill-item-histograms.ts          # report
 *   npx ts-node src/scripts/backfill-item-histograms.ts --apply  # write
 *
 * Sanity check: when the recomputed mean from the cohort differs from
 * the stored mean by more than 0.10, we skip that item with a warning
 * (responses likely changed since the analysis was generated).
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { ConflictAnalysis, IItemMetric } from '../models/ConflictAnalysis.model';
import { SurveyResponse } from '../models/SurveyResponse.model';
import { SurveyTemplate, IQuestion } from '../models/SurveyTemplate.model';

const apply = process.argv.includes('--apply');
const bypass = { bypassTenantCheck: true };

interface Stats {
  scanned: number;
  patched: number;
  itemsPatched: number;
  itemsSkippedMeanMismatch: number;
  itemsSkippedNoCohort: number;
  itemsSkippedAlready: number;
  analysesSkippedNoTemplate: number;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);

  const stats: Stats = {
    scanned: 0,
    patched: 0,
    itemsPatched: 0,
    itemsSkippedMeanMismatch: 0,
    itemsSkippedNoCohort: 0,
    itemsSkippedAlready: 0,
    analysesSkippedNoTemplate: 0,
  };

  const cursor = ConflictAnalysis.find({
    'itemMetrics.0': { $exists: true },
  })
    .setOptions(bypass)
    .cursor();

  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    stats.scanned++;
    const items: IItemMetric[] = (doc.itemMetrics ?? []) as IItemMetric[];

    // Skip if every item already has a histogram.
    if (items.every((m) => Array.isArray(m.histogram) && m.histogram.length > 0)) {
      stats.itemsSkippedAlready += items.length;
      continue;
    }

    // Need the template to look up scaleMin/scaleMax per question.
    if (!doc.intakeTemplateId) {
      stats.analysesSkippedNoTemplate++;
      continue;
    }
    const template = await SurveyTemplate.findById(doc.intakeTemplateId).setOptions(bypass);
    if (!template) {
      stats.analysesSkippedNoTemplate++;
      continue;
    }
    const questionsById = new Map<string, IQuestion>();
    for (const q of template.questions) questionsById.set(q.id, q);

    // Re-fetch the cohort that existed at analysis time. Use createdAt as
    // the snapshot boundary — responses created after the analysis can't
    // have informed it. Filter to acceptedInAnalysis !== false to match
    // the analyzer's metric pipeline.
    const cohortFilter: Record<string, unknown> = {
      organizationId: doc.organizationId,
      templateId: doc.intakeTemplateId,
      createdAt: { $lte: doc.createdAt },
      acceptedInAnalysis: { $ne: false },
    };
    if (doc.departmentId) cohortFilter['departmentId'] = doc.departmentId;
    const cohort = await SurveyResponse.find(cohortFilter).setOptions(bypass);

    if (cohort.length === 0) {
      stats.itemsSkippedNoCohort += items.length;
      continue;
    }

    let patchedHere = 0;
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      if (Array.isArray(m.histogram) && m.histogram.length > 0) continue;

      const q = questionsById.get(m.questionId);
      if (!q) {
        // Question removed from the template — skip; we have no scale.
        continue;
      }

      // Pull this item's values from the cohort.
      const values: number[] = [];
      for (const r of cohort) {
        const ans = r.responses.find((x) => x.questionId === m.questionId);
        if (!ans) continue;
        if (typeof ans.value === 'number') values.push(ans.value);
        else if (typeof ans.value === 'boolean') values.push(ans.value ? 1 : 0);
      }
      if (values.length < 2) continue;

      // Sanity check: cohort mean should match the stored mean. If the
      // response set has drifted (delete / mutation since analysis), skip.
      const cohortMean = values.reduce((s, v) => s + v, 0) / values.length;
      if (Math.abs(cohortMean - m.mean) > 0.10) {
        stats.itemsSkippedMeanMismatch++;
        continue;
      }

      // Reuse the stored scale boundaries so the histogram length matches
      // the live computeItemMetrics output. Fall back to question.scale_range
      // if absent on the legacy itemMetric, then to the empirical range.
      const lo = m.scaleMin ?? q.scale_range?.min ?? Math.min(...values);
      const hi = m.scaleMax ?? q.scale_range?.max ?? Math.max(...values);
      const histogram = buildHistogram(values, Math.round(lo), Math.round(hi));

      items[i] = { ...m, scaleMin: lo, scaleMax: hi, histogram };
      patchedHere++;
    }

    if (patchedHere === 0) continue;

    if (apply) {
      doc.itemMetrics = items;
      doc.markModified('itemMetrics');
      await doc.save();
    }
    stats.patched++;
    stats.itemsPatched += patchedHere;

    process.stdout.write(
      `${apply ? 'APPLIED' : 'WOULD APPLY'}  ${doc._id}  "${doc.name}"  +${patchedHere} histograms\n`,
    );
  }

  console.log('\n=== Backfill summary ===');
  console.log(JSON.stringify(stats, null, 2));
  console.log(apply ? '✓ Apply mode' : '(dry-run — pass --apply to write)');

  await mongoose.disconnect();
}

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
