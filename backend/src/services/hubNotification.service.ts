import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model';
import { User, INotificationPreferences } from '../models/User.model';

export type NotificationCategory = keyof INotificationPreferences;

interface HubNotifyParams {
  userId: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  type: 'idp_generated' | 'survey_response' | 'conflict_alert' | 'message' | 'system';
  title: string;
  body: string;
  link?: string;
  category?: NotificationCategory;
}

export async function isNotificationEnabled(
  userId: string | mongoose.Types.ObjectId,
  category: NotificationCategory,
): Promise<boolean> {
  try {
    const user = await User.findById(userId).select('notificationPreferences').lean();
    if (!user?.notificationPreferences) return true;
    const val = user.notificationPreferences[category];
    return val !== false;
  } catch {
    return true;
  }
}

export async function createHubNotification(params: HubNotifyParams): Promise<void> {
  try {
    if (params.category) {
      const enabled = await isNotificationEnabled(params.userId, params.category);
      if (!enabled) return;
    }
    await Notification.create({
      organizationId: params.organizationId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    });
  } catch (err) {
    console.error('[HubNotification] Failed to create notification:', err);
  }
}

export async function notifyBookingConfirmed(p: {
  coachId: string | mongoose.Types.ObjectId;
  coacheeId?: string | mongoose.Types.ObjectId;
  engagementId?: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  clientName: string;
  coachName: string;
  startTime: Date;
}): Promise<void> {
  const when = fmtDate(p.startTime);

  await createHubNotification({
    userId: p.coachId,
    organizationId: p.organizationId,
    type: 'system',
    title: 'New Booking Confirmed',
    body: `${p.clientName} booked a session on ${when}.`,
    link: '/booking',
    category: 'bookingConfirmed',
  });

  if (p.coacheeId) {
    await createHubNotification({
      userId: p.coacheeId,
      organizationId: p.organizationId,
      type: 'system',
      title: 'Session Confirmed',
      body: `Your session with ${p.coachName} on ${when} is confirmed.`,
      link: coacheeLink(p.engagementId),
      category: 'bookingConfirmed',
    });
  }
}

export async function notifyBookingCancelled(p: {
  coachId: string | mongoose.Types.ObjectId;
  coacheeId?: string | mongoose.Types.ObjectId;
  engagementId?: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  clientName: string;
  coachName: string;
  cancelledBy: string;
  startTime: Date;
}): Promise<void> {
  const when = fmtDate(p.startTime);

  await createHubNotification({
    userId: p.coachId,
    organizationId: p.organizationId,
    type: 'system',
    title: 'Booking Cancelled',
    body: `Session with ${p.clientName} on ${when} was cancelled by ${p.cancelledBy}.`,
    link: '/booking',
    category: 'bookingCancelled',
  });

  if (p.coacheeId) {
    await createHubNotification({
      userId: p.coacheeId,
      organizationId: p.organizationId,
      type: 'system',
      title: 'Session Cancelled',
      body: `Your session with ${p.coachName} on ${when} has been cancelled.`,
      link: coacheeLink(p.engagementId),
      category: 'bookingCancelled',
    });
  }
}

export async function notifyBookingRescheduled(p: {
  coachId: string | mongoose.Types.ObjectId;
  coacheeId?: string | mongoose.Types.ObjectId;
  engagementId?: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  clientName: string;
  coachName: string;
  oldTime: Date;
  newTime: Date;
  triggeredBy: string;
}): Promise<void> {
  const from = fmtDate(p.oldTime);
  const to = fmtDate(p.newTime);

  if (p.triggeredBy !== 'coach_gcal') {
    await createHubNotification({
      userId: p.coachId,
      organizationId: p.organizationId,
      type: 'system',
      title: 'Booking Rescheduled',
      body: `Session with ${p.clientName} moved from ${from} to ${to}.`,
      link: '/booking',
      category: 'bookingRescheduled',
    });
  }

  if (p.coacheeId) {
    await createHubNotification({
      userId: p.coacheeId,
      organizationId: p.organizationId,
      type: 'system',
      title: 'Session Rescheduled',
      body: `Your session with ${p.coachName} has been moved from ${from} to ${to}.`,
      link: coacheeLink(p.engagementId),
      category: 'bookingRescheduled',
    });
  }
}

export async function notifyBookingReminder(p: {
  coacheeId?: string | mongoose.Types.ObjectId;
  engagementId?: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  coachName: string;
  startTime: Date;
  type: '24h' | '1h';
}): Promise<void> {
  if (!p.coacheeId) return;
  const when = fmtDate(p.startTime);
  const label = p.type === '24h' ? 'tomorrow' : 'in 1 hour';

  await createHubNotification({
    userId: p.coacheeId,
    organizationId: p.organizationId,
    type: 'system',
    title: 'Session Reminder',
    body: `Your session with ${p.coachName} is ${label} (${when}).`,
    link: coacheeLink(p.engagementId),
    category: 'sessionReminders',
  });
}

export async function notifyPreSessionForm(p: {
  coacheeId: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  coachName: string;
  sessionDate: string;
  templateTitle: string;
  intakeUrl: string;
}): Promise<void> {
  await createHubNotification({
    userId: p.coacheeId,
    organizationId: p.organizationId,
    type: 'survey_response',
    title: 'Pre-Session Form Ready',
    body: `${p.coachName} has a pre-session form for your session on ${p.sessionDate}: ${p.templateTitle}`,
    link: p.intakeUrl,
    category: 'sessionForms',
  });
}

export async function notifyPostSessionForm(p: {
  coacheeId: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  coachName: string;
  sessionDate: string;
  intakeUrl: string;
}): Promise<void> {
  await createHubNotification({
    userId: p.coacheeId,
    organizationId: p.organizationId,
    type: 'survey_response',
    title: 'Post-Session Reflection',
    body: `Please complete your reflection for the session on ${p.sessionDate} with ${p.coachName}.`,
    link: p.intakeUrl,
    category: 'sessionForms',
  });
}

function coacheeLink(engagementId?: string | mongoose.Types.ObjectId): string {
  return engagementId ? `/coaching/${engagementId}` : '/coaching';
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
