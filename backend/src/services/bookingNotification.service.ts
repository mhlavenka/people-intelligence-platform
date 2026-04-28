import { DateTime } from 'luxon';
import i18next from 'i18next';
import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../config/env';
import { IBooking } from '../models/Booking.model';
import { User } from '../models/User.model';
import { getFromHeader } from './email.service';

export async function shouldSuppressBookingEmail(booking: IBooking): Promise<boolean> {
  if (!booking.coacheeId) return false;
  const user = await User.findById(booking.coacheeId).select('notificationPreferences').lean();
  return user?.notificationPreferences?.calendarInvites === true;
}

// ─── SES client ─────────────────────────────────────────────────────────────

const ses = new SESClient({
  region: config.aws.region,
  ...(config.aws.accessKeyId && config.aws.secretAccessKey
    ? {
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
      }
    : {}),
});

const isDev = config.nodeEnv !== 'production';

// ─── i18n helper ───────────────────────────────────────────────────────────

function getT(language: string) {
  return i18next.getFixedT(language, 'emails');
}

// ─── ICS generation ─────────────────────────────────────────────────────────

function bookingUid(booking: IBooking): string {
  return `booking-${booking._id}@artes`;
}

function generateICS(
  booking: IBooking,
  coachName: string,
  coachEmail: string,
  method: ICalCalendarMethod = ICalCalendarMethod.REQUEST,
  sequence = 0,
): string {
  const cal = ical({ name: 'Coaching Session' });
  cal.method(method);
  cal.createEvent({
    id: bookingUid(booking),
    sequence,
    start: booking.startTime,
    end: booking.endTime,
    summary: `Coaching Session — ${coachName}`,
    description: booking.topic || 'Coaching session',
    location: booking.meetingLink || booking.googleMeetLink || undefined,
    status: method === ICalCalendarMethod.CANCEL ? ICalEventStatus.CANCELLED : undefined,
    organizer: { name: coachName, email: coachEmail },
    attendees: [
      { name: booking.clientName, email: booking.clientEmail, rsvp: true },
    ],
  });
  return cal.toString();
}

// ─── Email HTML wrapper ─────────────────────────────────────────────────────

function bookingHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#EBF5FB;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EBF5FB;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1B2A47;padding:28px 36px;text-align:left;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ARTES</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 28px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="background:#f7f9fc;padding:20px 36px;border-top:1px solid #e8eef4;text-align:center;">
            <p style="margin:0;color:#9aa5b4;font-size:12px;line-height:1.5;">
              &copy; ${new Date().getFullYear()} HeadSoft Tech &times; Helena Coaching.<br/>
              Powered by ARTES.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Raw email with ICS attachment ──────────────────────────────────────────

async function sendRawEmailWithICS(params: {
  to: string;
  subject: string;
  html: string;
  icsContent: string;
  icsMethod?: 'REQUEST' | 'CANCEL';
  icsFilename?: string;
}): Promise<void> {
  if (isDev && !config.aws.sesFromEmail) {
    console.log(`[BookingEmail] DEV — would send "${params.subject}" to ${params.to}`);
    return;
  }

  const method = params.icsMethod || 'REQUEST';
  const filename = params.icsFilename || 'invite.ics';
  const fromHeader = await getFromHeader();
  const boundary = `----=_Part_${Date.now()}`;
  const rawMessage = [
    `From: ${fromHeader}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.html,
    '',
    `--${boundary}`,
    `Content-Type: text/calendar; charset=UTF-8; method=${method}`,
    'Content-Transfer-Encoding: 7bit',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    params.icsContent,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const command = new SendRawEmailCommand({
    RawMessage: { Data: Buffer.from(rawMessage) },
  });
  await ses.send(command);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function sendBookingConfirmation(
  booking: IBooking,
  coachName: string,
  coachEmail: string,
  cancelUrl: string,
  language = 'en',
): Promise<void> {
  const t = getT(language);
  const clientDt = DateTime.fromJSDate(booking.startTime).setZone(booking.clientTimezone).setLocale(language);
  const coachDt = DateTime.fromJSDate(booking.startTime).setZone(booking.coachTimezone).setLocale(language);
  const duration = Math.round(
    (booking.endTime.getTime() - booking.startTime.getTime()) / 60_000,
  );

  const icsContent = generateICS(booking, coachName, coachEmail);

  const link = booking.meetingLink || booking.googleMeetLink;
  const linkLabel = booking.calendarProvider === 'microsoft'
    ? t('booking.teamsMeeting')
    : t('booking.googleMeet');
  const meetSection = link
    ? `<p style="margin:0 0 8px;">
         <strong>${linkLabel}:</strong>
         <a href="${link}" style="color:#3A9FD6;">${link}</a>
       </p>`
    : '';

  // ── Client email
  const clientHtml = bookingHtml(t('booking.sessionConfirmedTitle'), `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      ${t('booking.sessionConfirmedTitle')}
    </h2>
    <div style="background:#f0f9f4;border-left:4px solid #27C4A0;
                padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 20px;">
      <p style="margin:0 0 4px;color:#1B2A47;font-weight:600;">
        ${clientDt.toFormat('cccc, LLLL d, yyyy')}
      </p>
      <p style="margin:0;color:#5a6a7e;">
        ${clientDt.toFormat('h:mm a')} – ${clientDt.plus({ minutes: duration }).toFormat('h:mm a')}
        (${booking.clientTimezone})
      </p>
    </div>
    <p style="color:#5a6a7e;margin:0 0 8px;">
      <strong>${t('booking.coach')}:</strong> ${coachName}
    </p>
    <p style="color:#5a6a7e;margin:0 0 8px;">
      <strong>${t('booking.duration')}:</strong> ${t('booking.durationMinutes', { minutes: duration })}
    </p>
    ${meetSection}
    ${booking.topic ? `<p style="color:#5a6a7e;margin:0 0 8px;"><strong>${t('booking.topic')}:</strong> ${booking.topic}</p>` : ''}
    <p style="color:#9aa5b4;margin:24px 0 0;font-size:13px;">
      ${t('booking.needToCancel')}
      <a href="${cancelUrl}" style="color:#3A9FD6;">${t('booking.cancelThisSession')}</a>
    </p>
  `);

  await sendRawEmailWithICS({
    to: booking.clientEmail,
    subject: t('booking.confirmedSubject', { date: clientDt.toFormat('LLL d'), coachName }),
    html: clientHtml,
    icsContent,
  });

  // ── Coach email
  const coachHtml = bookingHtml(t('booking.newSessionBookedTitle'), `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      ${t('booking.newSessionBookedTitle')}
    </h2>
    <div style="background:#EBF5FB;border-left:4px solid #3A9FD6;
                padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 20px;">
      <p style="margin:0 0 4px;color:#1B2A47;font-weight:600;">
        ${coachDt.toFormat('cccc, LLLL d, yyyy')}
      </p>
      <p style="margin:0;color:#5a6a7e;">
        ${coachDt.toFormat('h:mm a')} – ${coachDt.plus({ minutes: duration }).toFormat('h:mm a')}
        (${booking.coachTimezone})
      </p>
    </div>
    <p style="color:#5a6a7e;margin:0 0 8px;">
      <strong>${t('booking.client')}:</strong> ${booking.clientName}
    </p>
    <p style="color:#5a6a7e;margin:0 0 8px;">
      <strong>${t('booking.email')}:</strong> ${booking.clientEmail}
    </p>
    ${booking.clientPhone ? `<p style="color:#5a6a7e;margin:0 0 8px;"><strong>${t('booking.phone')}:</strong> ${booking.clientPhone}</p>` : ''}
    ${booking.topic ? `<p style="color:#5a6a7e;margin:0 0 8px;"><strong>${t('booking.topic')}:</strong> ${booking.topic}</p>` : ''}
    ${meetSection}
  `);

  await sendRawEmailWithICS({
    to: coachEmail,
    subject: t('booking.newBookingSubject', {
      clientName: booking.clientName,
      date: coachDt.toFormat('LLL d'),
      time: coachDt.toFormat('h:mm a'),
    }),
    html: coachHtml,
    icsContent,
  });
}

export async function sendCancellationEmail(
  booking: IBooking,
  coachName: string,
  coachEmail: string,
  cancelledBy: 'client' | 'coach',
  language = 'en',
): Promise<void> {
  const t = getT(language);
  const clientDt = DateTime.fromJSDate(booking.startTime).setZone(booking.clientTimezone).setLocale(language);
  const coachDt = DateTime.fromJSDate(booking.startTime).setZone(booking.coachTimezone).setLocale(language);
  const byWhom = cancelledBy === 'client' ? booking.clientName : coachName;

  // METHOD:CANCEL ICS with sequence=1 so calendar clients supersede the
  // original REQUEST invite and remove the event from attendee calendars.
  const cancelIcs = generateICS(booking, coachName, coachEmail, ICalCalendarMethod.CANCEL, 1);

  const renderHtml = (dt: DateTime, tz: string) => bookingHtml(t('booking.sessionCancelledTitle'), `
    <h2 style="color:#dc2626;margin:0 0 12px;font-size:22px;">
      ${t('booking.sessionCancelledTitle')}
    </h2>
    <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
      ${t('booking.cancelledBody', {
        date: dt.toFormat('cccc, LLLL d, yyyy'),
        time: dt.toFormat('h:mm a'),
        timezone: tz,
        byWhom,
      })}
    </p>
    ${booking.cancellationReason ? `<p style="color:#5a6a7e;margin:0 0 16px;"><strong>${t('booking.reason')}:</strong> ${booking.cancellationReason}</p>` : ''}
  `);

  const subjectFor = (dt: DateTime) =>
    t('booking.cancelledSubject', { date: dt.toFormat('LLL d') });

  // Email both parties so each calendar client removes its copy.
  await sendRawEmailWithICS({
    to: booking.clientEmail,
    subject: subjectFor(clientDt),
    html: renderHtml(clientDt, booking.clientTimezone),
    icsContent: cancelIcs,
    icsMethod: 'CANCEL',
    icsFilename: 'cancel.ics',
  });

  await sendRawEmailWithICS({
    to: coachEmail,
    subject: subjectFor(coachDt),
    html: renderHtml(coachDt, booking.coachTimezone),
    icsContent: cancelIcs,
    icsMethod: 'CANCEL',
    icsFilename: 'cancel.ics',
  });
}

export async function sendRescheduleConfirmation(
  booking: IBooking,
  coachName: string,
  coachEmail: string,
  oldStartTime: Date,
  cancelUrl: string,
  triggeredBy: 'coach_gcal' | 'admin' | 'coach' | 'coachee',
  note?: string,
  language = 'en',
): Promise<void> {
  const t = getT(language);
  const oldClientDt = DateTime.fromJSDate(oldStartTime).setZone(booking.clientTimezone).setLocale(language);
  const newClientDt = DateTime.fromJSDate(booking.startTime).setZone(booking.clientTimezone).setLocale(language);
  const newCoachDt = DateTime.fromJSDate(booking.startTime).setZone(booking.coachTimezone).setLocale(language);

  const rscLink = booking.meetingLink || booking.googleMeetLink;
  const rscLabel = booking.calendarProvider === 'microsoft'
    ? t('booking.joinTeamsMeeting')
    : t('booking.joinGoogleMeet');
  const meetSection = rscLink
    ? `<a href="${rscLink}"
         style="display:inline-block;background:#3A9FD6;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;margin-top:12px;">
        ${rscLabel}
      </a>`
    : '';

  const icsContent = generateICS(booking, coachName, coachEmail);

  // Always email the client. Skip the coach when they triggered the change
  // from their own calendar — they already know.
  const clientHtml = bookingHtml(t('booking.sessionRescheduledTitle'), `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      ${t('booking.sessionRescheduledTitle')}
    </h2>
    <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
      ${t('booking.rescheduledBody', { coachName })}
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="padding:8px 0;color:#9aa5b4;font-size:13px;">${t('booking.previously')}</td>
        <td style="padding:8px 16px;color:#9aa5b4;text-decoration:line-through;">
          ${oldClientDt.toFormat('cccc, LLL d')} at ${oldClientDt.toFormat('h:mm a')}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#1B2A47;font-size:13px;font-weight:600;">${t('booking.now')}</td>
        <td style="padding:8px 16px;color:#1B2A47;font-weight:600;">
          ${newClientDt.toFormat('cccc, LLLL d, yyyy')} at ${newClientDt.toFormat('h:mm a')}
          (${booking.clientTimezone})
        </td>
      </tr>
    </table>
    ${meetSection}
    <p style="color:#9aa5b4;font-size:12px;margin:20px 0 0;">
      ${t('booking.needToCancel')} <a href="${cancelUrl}" style="color:#3A9FD6;">${t('booking.cancelThisSession')}</a>
    </p>
  `);

  await sendRawEmailWithICS({
    to: booking.clientEmail,
    subject: t('booking.rescheduledSubject', { date: newClientDt.toFormat('LLL d') }),
    html: clientHtml,
    icsContent,
  });

  if (triggeredBy === 'coach_gcal') return;

  // Coach email (admin or coachee triggered).
  const rescheduledByLine = triggeredBy === 'coachee'
    ? t('booking.coachRescheduledByCoachee', { clientName: booking.clientName })
    : t('booking.coachRescheduledByAdmin', { clientName: booking.clientName });
  const noteBlock = note && note.trim()
    ? `<div style="background:#f3eeff;border-left:4px solid #7c5cbf;border-radius:6px;
                   padding:12px 14px;margin:16px 0;">
         <div style="font-size:11px;font-weight:700;color:#7c5cbf;
                     text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
           ${t('booking.messageFrom', { name: booking.clientName })}
         </div>
         <div style="color:#1B2A47;font-size:14px;line-height:1.5;white-space:pre-wrap;">
           ${note.trim()}
         </div>
       </div>`
    : '';
  const coachHtml = bookingHtml(t('booking.coachRescheduledTitle'), `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      ${t('booking.coachRescheduledTitle')}
    </h2>
    <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
      ${rescheduledByLine} The new time is
      <strong>${newCoachDt.toFormat('cccc, LLLL d, yyyy')}</strong> at
      <strong>${newCoachDt.toFormat('h:mm a')}</strong> (${booking.coachTimezone}).
    </p>
    ${noteBlock}
    ${booking.topic ? `<p style="color:#5a6a7e;margin:0 0 8px;"><strong>${t('booking.topic')}:</strong> ${booking.topic}</p>` : ''}
  `);

  await sendRawEmailWithICS({
    to: coachEmail,
    subject: t('booking.coachRescheduledSubject', {
      clientName: booking.clientName,
      date: newCoachDt.toFormat('LLL d'),
    }),
    html: coachHtml,
    icsContent,
  });
}

export async function sendReminder(
  booking: IBooking,
  coachName: string,
  type: '24h' | '1h',
  language = 'en',
): Promise<void> {
  const t = getT(language);
  const clientDt = DateTime.fromJSDate(booking.startTime).setZone(booking.clientTimezone).setLocale(language);
  const duration = Math.round(
    (booking.endTime.getTime() - booking.startTime.getTime()) / 60_000,
  );
  const timeLabel = type === '24h' ? t('booking.tomorrow') : t('booking.inOneHour');

  const remLink = booking.meetingLink || booking.googleMeetLink;
  const remLabel = booking.calendarProvider === 'microsoft'
    ? t('booking.joinTeamsMeeting')
    : t('booking.joinGoogleMeet');
  const meetSection = remLink
    ? `<a href="${remLink}"
         style="display:inline-block;background:#3A9FD6;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;margin-top:12px;">
        ${remLabel}
      </a>`
    : '';

  const html = bookingHtml(t('booking.reminderTitle', { timeLabel }), `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      ${t('booking.reminderTitle', { timeLabel })}
    </h2>
    <div style="background:#f0f9f4;border-left:4px solid #27C4A0;
                padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 20px;">
      <p style="margin:0 0 4px;color:#1B2A47;font-weight:600;">
        ${clientDt.toFormat('cccc, LLLL d, yyyy')}
      </p>
      <p style="margin:0;color:#5a6a7e;">
        ${clientDt.toFormat('h:mm a')} – ${clientDt.plus({ minutes: duration }).toFormat('h:mm a')}
        (${booking.clientTimezone})
      </p>
    </div>
    <p style="color:#5a6a7e;margin:0 0 8px;">
      <strong>${t('booking.coach')}:</strong> ${coachName}
    </p>
    ${meetSection}
  `);

  if (isDev && !config.aws.sesFromEmail) {
    console.log(`[BookingEmail] DEV — would send ${type} reminder to ${booking.clientEmail}`);
    return;
  }

  const { SendEmailCommand } = await import('@aws-sdk/client-ses');
  const command = new SendEmailCommand({
    Source: await getFromHeader(),
    Destination: { ToAddresses: [booking.clientEmail] },
    Message: {
      Subject: {
        Data: t('booking.reminderSubject', { timeLabel, coachName }),
        Charset: 'UTF-8',
      },
      Body: { Html: { Data: html, Charset: 'UTF-8' } },
    },
  });
  await ses.send(command);
}
