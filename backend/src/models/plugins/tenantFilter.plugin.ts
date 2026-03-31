import { Schema } from 'mongoose';

/**
 * Warns when a query runs without organizationId — multi-tenancy safety net.
 * Apply this plugin to every schema that stores tenant data.
 *
 * To legitimately bypass (e.g. auth lookups by email):
 *   User.findOne({ email }).setOptions({ bypassTenantCheck: true })
 */
export function tenantFilterPlugin(schema: Schema): void {
  const warnIfMissingOrg = function (
    this: { getFilter(): Record<string, unknown>; getOptions(): Record<string, unknown> },
    next: () => void
  ): void {
    const options = this.getOptions();
    if (options['bypassTenantCheck']) {
      next();
      return;
    }
    const filter = this.getFilter();
    if (!filter['organizationId']) {
      console.warn('[TenantFilter] Query without organizationId detected:', filter);
    }
    next();
  };

  schema.pre('find', warnIfMissingOrg);
  schema.pre('findOne', warnIfMissingOrg);
  schema.pre('findOneAndUpdate', warnIfMissingOrg);
  schema.pre('countDocuments', warnIfMissingOrg);

  schema.pre('aggregate', function (next) {
    const pipeline = this.pipeline();
    const hasOrgFilter = pipeline.some((stage) => {
      const s = stage as unknown as Record<string, Record<string, unknown>>;
      return s['$match'] && s['$match']['organizationId'];
    });
    if (!hasOrgFilter) {
      console.warn('[TenantFilter] Aggregation without organizationId detected');
    }
    next();
  });
}
