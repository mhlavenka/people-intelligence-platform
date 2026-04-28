// One-off: dump the case-01-healthy ConflictAnalysis for review.
// Not committed.
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Organization } from '../models/Organization.model';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';

async function main(): Promise<void> {
  await mongoose.connect(process.env['MONGODB_URI']!);
  const org = await Organization.findOne({ slug: 'onkwe' })
    .setOptions({ bypassTenantCheck: true } as any);
  if (!org) throw new Error('Org not found');

  const analyses = await ConflictAnalysis.find({
    organizationId: org._id,
    departmentId: 'case-01-healthy',
  }).sort({ createdAt: -1 })
    .setOptions({ bypassTenantCheck: true } as any)
    .lean();

  console.log(`Found ${analyses.length} analysis/analyses for case-01-healthy\n`);
  for (const a of analyses as any[]) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Name:          ${a.name}`);
    console.log(`ID:            ${a._id}`);
    console.log(`Created:       ${a.createdAt}`);
    console.log(`riskScore:     ${a.riskScore}`);
    console.log(`riskLevel:     ${a.riskLevel}`);
    console.log(`conflictTypes: ${JSON.stringify(a.conflictTypes)}`);
    console.log(`parentId:      ${a.parentId ?? 'null (top-level)'}`);
    console.log(`focusConflict: ${a.focusConflictType ?? 'n/a'}`);
    console.log('---');
    console.log('aiNarrative (first 1500 chars):');
    console.log((a.aiNarrative ?? '').substring(0, 1500));
    console.log('---');
    console.log('managerScript (first 800 chars):');
    console.log((a.managerScript ?? '').substring(0, 800));
    if (a.metrics) {
      const m = a.metrics;
      console.log('---');
      console.log('metrics summary:');
      console.log(`  responseQuality: kept=${m.responseQuality?.keptRespondents}/${m.responseQuality?.totalRespondents}, dropped=${m.responseQuality?.droppedRespondents}`);
      console.log(`  teamAlignmentScore: ${JSON.stringify(m.teamAlignmentScore)}`);
      if (m.dimensionMetrics) {
        console.log('  dimensionMetrics:');
        for (const [k, v] of Object.entries(m.dimensionMetrics)) {
          console.log(`    ${k}: ${JSON.stringify(v)}`);
        }
      }
      if (m.itemMetrics) {
        const items = (Array.isArray(m.itemMetrics) ? m.itemMetrics : Object.values(m.itemMetrics)) as any[];
        console.log(`  itemMetrics: ${items.length} items`);
        const withRwg = items.filter((it) => typeof it.rwg === 'number');
        const sortedHigh = [...withRwg].sort((x, y) => (y.rwg ?? 0) - (x.rwg ?? 0));
        console.log('  top-3 highest rWG (most aligned):');
        for (const it of sortedHigh.slice(0, 3)) {
          console.log(`    ${it.itemId}: rWG=${it.rwg?.toFixed(3)} mean=${it.mean?.toFixed?.(2)}`);
        }
        const sortedLow = [...withRwg].sort((x, y) => (x.rwg ?? 1) - (y.rwg ?? 1));
        console.log('  top-3 lowest rWG (most divergent):');
        for (const it of sortedLow.slice(0, 3)) {
          console.log(`    ${it.itemId}: rWG=${it.rwg?.toFixed(3)} mean=${it.mean?.toFixed?.(2)}`);
        }
      }
      if (m.subgroupAnalysis) {
        console.log(`  subgroupAnalysis: ${JSON.stringify(m.subgroupAnalysis).substring(0, 400)}`);
      }
    }
    console.log('');
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
