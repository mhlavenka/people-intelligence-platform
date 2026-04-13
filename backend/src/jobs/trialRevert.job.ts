import cron from 'node-cron';
import { Organization } from '../models/Organization.model';

/**
 * Daily sweep: revert organizations whose trial has expired back to their
 * snapshotted pre-trial plan/modules/maxUsers. Runs at 02:15 server time.
 */
export function startTrialRevertJob(): void {
  cron.schedule('15 2 * * *', async () => {
    try {
      const now = new Date();
      const expired = await Organization.find({
        trialEndsAt: { $lte: now },
        previousPlan: { $exists: true, $ne: null },
      }).setOptions({ bypassTenantCheck: true });

      for (const org of expired) {
        if (org.previousPlan !== undefined)    org.plan = org.previousPlan;
        if (org.previousModules !== undefined) org.modules = [...org.previousModules];
        if (org.previousMaxUsers !== undefined) org.maxUsers = org.previousMaxUsers;
        org.previousPlan = undefined;
        org.previousModules = undefined;
        org.previousMaxUsers = undefined;
        org.trialEndsAt = undefined;
        await org.save();
        console.log(`[Trial] Reverted org ${org.slug} to ${org.plan}`);
      }
    } catch (err) {
      console.error('[Trial] Revert sweep failed:', err);
    }
  });

  console.log('[Trial] Daily trial-revert job started (02:15)');
}
