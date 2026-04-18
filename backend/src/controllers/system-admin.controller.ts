import i18next from 'i18next';
function t(req: import('express').Request, key: string, opts?: Record<string, unknown>): string { if (typeof req.t === 'function') return String(req.t(key, opts ?? {})); return String(i18next.t(key, opts ?? {})); }
import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';

const bypass = { bypassTenantCheck: true };

// GET /api/system-admin/stats
export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [totalOrgs, activeOrgs, totalUsers, planCounts] = await Promise.all([
      Organization.countDocuments().setOptions(bypass),
      Organization.countDocuments({ isActive: true }).setOptions(bypass),
      User.countDocuments({ role: { $ne: 'system_admin' } }).setOptions(bypass),
      Organization.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
    ]);

    const now = new Date();
    const trialOrgs = await Organization.countDocuments({
      isActive: true,
      trialEndsAt: { $gte: now },
    }).setOptions(bypass);

    const plans: Record<string, number> = {};
    for (const p of planCounts) plans[p._id as string] = p.count as number;

    res.json({ totalOrgs, activeOrgs, trialOrgs, totalUsers, plans });
  } catch (e) { next(e); }
}

// GET /api/system-admin/organizations
export async function listOrganizations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgs = await Organization.find({ slug: { $ne: 'headsoft-internal' } })
      .sort({ createdAt: -1 })
      .lean()
      .setOptions(bypass);

    // Attach user counts
    const orgIds = orgs.map((o) => o._id);
    const userCounts = await User.aggregate([
      { $match: { organizationId: { $in: orgIds }, role: { $ne: 'system_admin' }, isActive: true } },
      { $group: { _id: '$organizationId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(userCounts.map((u) => [u._id.toString(), u.count as number]));

    const result = orgs.map((o) => ({
      ...o,
      userCount: countMap.get(o._id.toString()) ?? 0,
    }));

    res.json(result);
  } catch (e) { next(e); }
}

// GET /api/system-admin/organizations/:id
export async function getOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const org = await Organization.findById(req.params['id']).lean().setOptions(bypass);
    if (!org) { res.status(404).json({ error: t(req, 'errors.organizationNotFound') }); return; }

    const users = await User.find({ organizationId: org._id, role: { $ne: 'system_admin' } })
      .select('-passwordHash -twoFactorSecret')
      .sort({ createdAt: -1 })
      .lean()
      .setOptions(bypass);

    res.json({ ...org, users });
  } catch (e) { next(e); }
}

// POST /api/system-admin/organizations
export async function createOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await Organization.findOne({ slug: req.body.slug }).setOptions(bypass);
    if (existing) { res.status(409).json({ error: t(req, 'errors.slugTaken') }); return; }

    const org = await Organization.create(req.body);
    res.status(201).json(org);
  } catch (e) { next(e); }
}

// PUT /api/system-admin/organizations/:id
export async function updateOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Slug and stripeCustomerId are immutable via this endpoint
    const { slug: _s, stripeCustomerId: _st, ...body } = req.body;
    void _s; void _st;

    const org = await Organization.findByIdAndUpdate(
      req.params['id'],
      body,
      { new: true, runValidators: true }
    ).setOptions(bypass);

    if (!org) { res.status(404).json({ error: t(req, 'errors.organizationNotFound') }); return; }
    res.json(org);
  } catch (e) { next(e); }
}

// POST /api/system-admin/organizations/:id/trial
// Start (or restart) a plan trial. Snapshots the current plan/modules/maxUsers
// into previousPlan/previousModules/previousMaxUsers so the nightly cron
// (or an explicit revert) can restore them.
// Body: { plan?: string, modules?: string[], addModules?: string[],
//         maxUsers?: number, endsAt: string (ISO date) }
export async function startOrgTrial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { plan, modules, addModules, maxUsers, endsAt } = req.body as {
      plan?: string;
      modules?: string[];
      addModules?: string[];
      maxUsers?: number;
      endsAt?: string;
    };
    if (!endsAt) { res.status(400).json({ error: t(req, 'errors.endsAtRequired') }); return; }
    const end = new Date(endsAt);
    if (isNaN(end.getTime()) || end.getTime() <= Date.now()) {
      res.status(400).json({ error: t(req, 'errors.endsAtMustBeFuture') }); return;
    }

    const org = await Organization.findById(req.params['id']).setOptions(bypass);
    if (!org) { res.status(404).json({ error: t(req, 'errors.organizationNotFound') }); return; }

    // If a trial is already active, keep the existing snapshot — we don't
    // want to overwrite pre-trial state with the current trial's values.
    if (!org.previousPlan) {
      org.previousPlan     = org.plan;
      org.previousModules  = [...(org.modules || [])];
      org.previousMaxUsers = org.maxUsers;
    }

    if (plan !== undefined)    org.plan = plan;
    if (maxUsers !== undefined) org.maxUsers = maxUsers;
    if (modules !== undefined) {
      org.modules = modules;
    } else if (addModules?.length) {
      const set = new Set([...(org.modules || []), ...addModules]);
      org.modules = Array.from(set);
    }
    org.trialEndsAt = end;

    await org.save();
    res.json(org);
  } catch (e) { next(e); }
}

// DELETE /api/system-admin/organizations/:id/trial
// End the trial immediately and revert to the snapshotted pre-trial state.
export async function endOrgTrial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const org = await Organization.findById(req.params['id']).setOptions(bypass);
    if (!org) { res.status(404).json({ error: t(req, 'errors.organizationNotFound') }); return; }
    if (!org.trialEndsAt && !org.previousPlan) {
      res.status(400).json({ error: t(req, 'errors.noActiveTrialToRevert') }); return;
    }
    if (org.previousPlan !== undefined)    org.plan = org.previousPlan;
    if (org.previousModules !== undefined) org.modules = [...org.previousModules];
    if (org.previousMaxUsers !== undefined) org.maxUsers = org.previousMaxUsers;
    org.previousPlan = undefined;
    org.previousModules = undefined;
    org.previousMaxUsers = undefined;
    org.trialEndsAt = undefined;
    await org.save();
    res.json(org);
  } catch (e) { next(e); }
}

// DELETE /api/system-admin/organizations/:id  (soft-delete — sets isActive: false)
export async function suspendOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.params['id'],
      { isActive: false },
      { new: true }
    ).setOptions(bypass);
    if (!org) { res.status(404).json({ error: t(req, 'errors.organizationNotFound') }); return; }
    res.json(org);
  } catch (e) { next(e); }
}

// GET /api/system-admin/organizations/:id/users
export async function listOrgUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await User.find({
      organizationId: new mongoose.Types.ObjectId(req.params['id']),
      role: { $ne: 'system_admin' },
    })
      .select('-passwordHash -twoFactorSecret')
      .sort({ createdAt: -1 })
      .lean()
      .setOptions(bypass);
    res.json(users);
  } catch (e) { next(e); }
}

// PATCH /api/system-admin/organizations/:id/users/:userId  (activate / deactivate)
export async function updateOrgUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params['userId'], organizationId: new mongoose.Types.ObjectId(req.params['id']) },
      { isActive: req.body.isActive },
      { new: true }
    ).setOptions(bypass);
    if (!user) { res.status(404).json({ error: t(req, 'errors.userNotFound') }); return; }
    res.json(user);
  } catch (e) { next(e); }
}
