import mongoose, { FilterQuery } from 'mongoose';
import { Organization } from '../models/Organization.model';
import { ISurveyTemplate } from '../models/SurveyTemplate.model';

/**
 * Build the access filter clause that decides which SurveyTemplates an
 * organisation can see. Always include per-org templates (their own
 * `organizationId`); for global templates, gate by the org's
 * `enabledGlobalTemplateIds` allowlist when present.
 *
 * Semantics:
 *   - `enabledGlobalTemplateIds` undefined  ⇒ implicit-allow (legacy).
 *     The org sees every global template — backwards compatible with
 *     pre-gating data.
 *   - `enabledGlobalTemplateIds` set (even []) ⇒ allowlist applies.
 *     Only listed global templates are visible; the empty array means "no
 *     global templates for this org".
 *
 * Returned shape is a `$or` clause — merge it into your query with
 * `Object.assign({}, baseFilter, { $or: clauses })`. If the existing query
 * already has its own `$or`, prefer `$and: [{ $or: existing }, { $or: ours }]`
 * to avoid stomping the caller's intent.
 */
export async function buildTemplateAccessOr(
  organizationId: string | mongoose.Types.ObjectId,
): Promise<FilterQuery<ISurveyTemplate>['$or']> {
  const orgIdAsObj = typeof organizationId === 'string'
    ? new mongoose.Types.ObjectId(organizationId)
    : organizationId;

  const org = await Organization.findById(orgIdAsObj)
    .select('enabledGlobalTemplateIds')
    .lean()
    .setOptions({ bypassTenantCheck: true });

  // Org missing or no allowlist field at all — implicit-allow legacy semantics.
  if (!org || org.enabledGlobalTemplateIds === undefined) {
    return [
      { organizationId: orgIdAsObj },
      { isGlobal: true },
    ];
  }

  // Allowlist set (possibly empty). Restrict global templates to listed ids.
  return [
    { organizationId: orgIdAsObj },
    { isGlobal: true, _id: { $in: org.enabledGlobalTemplateIds } },
  ];
}
