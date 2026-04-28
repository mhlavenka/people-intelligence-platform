/**
 * Read-only inspector for the 10 divergence case-study analyses seeded
 * under the Onkwe organisation. Dumps the structure of each analysis —
 * risk + conflict types + dimension metrics + most-divergent items +
 * narrative excerpt + manager-script excerpt — so we can review whether
 * the AI's interpretation matches the seeded scenario.
 *
 * Usage:
 *   # Dump all 10 cases
 *   npx ts-node src/scripts/inspect-divergence-case.ts
 *
 *   # Filter to one case (slug fragment, e.g. 06, suppression, codered)
 *   npx ts-node src/scripts/inspect-divergence-case.ts --case 06
 *   npx ts-node src/scripts/inspect-divergence-case.ts --case suppression
 *
 *   # Limit excerpt length (default 1200 / 600)
 *   npx ts-node src/scripts/inspect-divergence-case.ts --narrative 2000 --script 1000
 *
 * Read-only — never writes or deletes anything. Safe to run against
 * production. Add a --case filter when iterating to keep output short.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Organization } from '../models/Organization.model';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';

const ALL_CASE_SLUGS = [
  'case-01-healthy',
  'case-02-mediocre',
  'case-03-merger',
  'case-04-shifts',
  'case-05-whistleblower',
  'case-06-suppression',
  'case-07-manager',
  'case-08-trust',
  'case-09-codered',
  'case-10-straightliner',
] as const;

interface Args {
  caseFilter?: string;
  narrativeChars: number;
  scriptChars: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { narrativeChars: 1200, scriptChars: 600 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--case' && argv[i + 1]) { out.caseFilter = argv[++i]; }
    else if (argv[i] === '--narrative' && argv[i + 1]) { out.narrativeChars = Number(argv[++i]) || 1200; }
    else if (argv[i] === '--script' && argv[i + 1]) { out.scriptChars = Number(argv[++i]) || 600; }
  }
  return out;
}

function pickCases(filter?: string): string[] {
  if (!filter) return [...ALL_CASE_SLUGS];
  const needle = filter.toLowerCase();
  return ALL_CASE_SLUGS.filter((s) => s.toLowerCase().includes(needle));
}

function dumpAnalysis(a: any, narrativeChars: number, scriptChars: number): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Name:               ${a.name}`);
  console.log(`ID:                 ${a._id}`);
  console.log(`Created:            ${a.createdAt}`);
  console.log(`riskScore:          ${a.riskScore}`);
  console.log(`riskLevel:          ${a.riskLevel}`);
  console.log(`conflictTypes:      ${JSON.stringify(a.conflictTypes)}`);
  console.log(`parentId:           ${a.parentId ?? 'null (top-level)'}`);
  console.log(`focusConflictType:  ${a.focusConflictType ?? 'n/a'}`);
  console.log(`teamAlignmentScore: ${a.teamAlignmentScore ?? 'n/a'}`);

  if (a.responseQuality) {
    const rq = a.responseQuality;
    console.log(`responseQuality:    submitted=${rq.totalSubmitted ?? rq.totalRespondents ?? '?'}, accepted=${rq.acceptedCount ?? rq.keptRespondents ?? '?'}, dropped=${rq.droppedCount ?? rq.droppedRespondents ?? '?'}`);
  }

  if (a.dimensionMetrics?.length) {
    console.log('dimensionMetrics:');
    for (const d of a.dimensionMetrics as any[]) {
      const meanLabel = (d.mean === null || d.mean === undefined) ? 'n/a' : d.mean.toFixed?.(2) ?? d.mean;
      console.log(`  ${d.dimension}: mean=${meanLabel}, rWG=${d.rwg?.toFixed?.(3) ?? d.rwg}, disagreement=${d.disagreementScore}`);
    }
  }

  if (a.itemMetrics) {
    const items = (Array.isArray(a.itemMetrics) ? a.itemMetrics : Object.values(a.itemMetrics)) as any[];
    const withRwg = items.filter((it) => typeof it.rwg === 'number');
    const sortedLow = [...withRwg].sort((x, y) => (x.rwg ?? 1) - (y.rwg ?? 1));
    if (sortedLow.length) {
      console.log('top-3 most divergent items (lowest rWG):');
      for (const it of sortedLow.slice(0, 3)) {
        console.log(`  ${it.questionId}: rWG=${it.rwg?.toFixed(3)}, mean=${it.mean?.toFixed?.(2)}, sd=${it.sd?.toFixed?.(2)}, bimodal=${it.bimodalityCoef?.toFixed?.(3)}`);
      }
    }
  }

  if (a.subgroupAnalysis) {
    const sa = a.subgroupAnalysis;
    console.log(`subgroupAnalysis:   k=${sa.k}, silhouette=${sa.silhouette?.toFixed?.(3)}`);
    if (Array.isArray(sa.clusters)) {
      for (const c of sa.clusters as any[]) {
        console.log(`  cluster ${c.label}: size=${c.size}, distinguishingItems=${JSON.stringify(c.distinguishingItemIds ?? [])}`);
      }
    }
  }

  console.log('---');
  console.log(`aiNarrative (first ${narrativeChars} chars):`);
  console.log((a.aiNarrative ?? '').substring(0, narrativeChars));
  console.log('---');
  console.log(`managerScript (first ${scriptChars} chars):`);
  console.log((a.managerScript ?? '').substring(0, scriptChars));
}

async function main(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set');

  const args = parseArgs();
  const slugs = pickCases(args.caseFilter);
  if (slugs.length === 0) {
    console.error(`No case matched filter: ${args.caseFilter}`);
    process.exit(1);
  }

  await mongoose.connect(uri);

  const org = await Organization.findOne({ slug: 'onkwe' })
    .setOptions({ bypassTenantCheck: true } as any);
  if (!org) throw new Error('Organization "onkwe" not found');

  for (const slug of slugs) {
    console.log(`\n████████████████ ${slug} ████████████████\n`);
    const analyses = await ConflictAnalysis.find({
      organizationId: org._id,
      departmentId: slug,
    })
      .sort({ createdAt: -1 })
      .setOptions({ bypassTenantCheck: true } as any)
      .lean();

    if (!analyses.length) {
      console.log('(no analyses run yet for this case)');
      continue;
    }

    for (const a of analyses) dumpAnalysis(a, args.narrativeChars, args.scriptChars);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
