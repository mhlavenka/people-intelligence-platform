// One-off review of selected case-study analyses. Not committed.
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Organization } from '../models/Organization.model';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';

const TARGETS = ['case-06-suppression', 'case-09-codered'];

async function main(): Promise<void> {
  await mongoose.connect(process.env['MONGODB_URI']!);
  const org = await Organization.findOne({ slug: 'onkwe' })
    .setOptions({ bypassTenantCheck: true } as any);
  if (!org) throw new Error('org not found');

  for (const dept of TARGETS) {
    console.log(`\n████████████████ ${dept} ████████████████\n`);
    const analyses = await ConflictAnalysis.find({
      organizationId: org._id,
      departmentId: dept,
    }).sort({ createdAt: -1 })
      .setOptions({ bypassTenantCheck: true } as any)
      .lean();
    if (!analyses.length) { console.log('(no analyses)'); continue; }

    for (const a of analyses as any[]) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Name:          ${a.name}`);
      console.log(`Created:       ${a.createdAt}`);
      console.log(`riskScore:     ${a.riskScore}    riskLevel: ${a.riskLevel}`);
      console.log(`conflictTypes: ${JSON.stringify(a.conflictTypes)}`);
      console.log(`parentId:      ${a.parentId ?? 'null (top-level)'}`);
      console.log(`focus:         ${a.focusConflictType ?? 'n/a'}`);
      console.log(`teamAlignmentScore: ${a.teamAlignmentScore}`);
      if (a.dimensionMetrics) {
        console.log('dimensionMetrics:');
        for (const d of a.dimensionMetrics) {
          console.log(`  ${d.dimension}: mean=${d.mean?.toFixed?.(2) ?? d.mean} rWG=${d.rwg?.toFixed?.(3)} disagreement=${d.disagreementScore}`);
        }
      }
      if (a.itemMetrics) {
        const items = (Array.isArray(a.itemMetrics) ? a.itemMetrics : Object.values(a.itemMetrics)) as any[];
        const sortedLow = [...items].filter((it) => typeof it.rwg === 'number')
          .sort((x, y) => (x.rwg ?? 1) - (y.rwg ?? 1));
        console.log('top-3 most divergent items:');
        for (const it of sortedLow.slice(0, 3)) {
          console.log(`  ${it.questionId}: rWG=${it.rwg?.toFixed(3)} mean=${it.mean?.toFixed?.(2)} bimodal=${it.bimodalityCoef?.toFixed?.(3)}`);
        }
      }
      if (a.subgroupAnalysis) {
        const sa = a.subgroupAnalysis;
        console.log(`subgroups: k=${sa.k}, silhouette=${sa.silhouette?.toFixed?.(3)}`);
        if (sa.clusters) {
          for (const c of sa.clusters) {
            console.log(`  cluster ${c.label}: size=${c.size}, distinguishingItems=${JSON.stringify(c.distinguishingItemIds)}`);
          }
        }
      }
      console.log('---');
      console.log('aiNarrative (first 1200):');
      console.log((a.aiNarrative ?? '').substring(0, 1200));
      console.log('---');
      console.log('managerScript (first 600):');
      console.log((a.managerScript ?? '').substring(0, 600));
    }
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
