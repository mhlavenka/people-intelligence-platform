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
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }

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
    if (existing) { res.status(409).json({ error: 'Slug already taken' }); return; }

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

    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
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
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
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
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (e) { next(e); }
}
