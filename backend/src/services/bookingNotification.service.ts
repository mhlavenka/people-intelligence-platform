import { DateTime } from 'luxon';
import ical, { ICalCalendarMethod } from 'ical-generator';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../config/env';
import { IBooking } from '../models/Booking.model';

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

const FROM = config.aws.sesFromEmail || 'noreply@headsoft.net';
const isDev = config.nodeEnv !== 'production';

// ─── ICS generation ─────────────────────────────────────────────────────────

function generateICS(booking: IBooking, coachName: string, coachEmail: string): string {
  const cal = ical({ name: 'Coaching Session' });
  cal.method(ICalCalendarMethod.REQUEST);
  cal.createEvent({
    start: booking.startTime,
    end: booking.endTime,
    summary: `Coaching Session — ${coachName}`,
    description: booking.topic || 'Coaching session',
    location: booking.googleMeetLink || undefined,
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
}): Promise<void> {
  if (isDev && !config.aws.sesFromEmail) {
    console.log(`[BookingEmail] DEV — would send "${params.subject}" to ${params.to}`);
    return;
  }

  const boundary = `----=_Part_${Date.now()}`;
  const rawMessage = [
    `From: ${FROM}`,
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
    'Content-Type: text/calendar; charset=UTF-8; method=REQUEST',
    'Content-Transfer-Encoding: 7bit',
    'Content-Disposition: attachment; filename="invite.ics"',
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
): Promise<void> {
  const clientDt = DateTime.fromJSDate(booking.startTime).setZone(booking.clientTimezone);
  const coachDt = DateTime.fromJSDate(booking.startTime).setZone(booking.coachTimezone);
  const duration = Math.round(
    (booking.endTime.getTime() - booking.startTime.getTime()) / 60_000,
  );

  const icsContent = generateICS(booking, coachName, coachEmail);

  const meetSection = booking.googleMeetLink
    ? `<p style="margin:0 0 8px;">
         <strong>Google Meet:</strong>
         <a href="${booking.googleMeetLink}" style="color:#3A9FD6;">${booking.googleMeetLink}</a>
       </p>`
    : '';

  // ── Client email
  const clientHtml = bookingHtml('Booking Confirmed', `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      Your Session is Confirmed!
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
      <strong>Coach:</strong> ${coachName}
    </p>
    <p style="color:#5a6a7e;margin:0 0 8px;">
      <strong>Duration:</strong> ${duration} minutes
    </p>
    ${meetSection}
    ${booking.topic ? `<p style="color:#5a6a7e;margin:0 0 8px;"><strong>Topic:</strong> ${booking.topic}</p>` : ''}
    <p style="color:#9aa5b4;margin:24px 0 0;font-size:13px;">
      Need to cancel?
      <a href="${cancelUrl}" style="color:#3A9FD6;">Cancel this session</a>
    </p>
  `);

  await sendRawEmailWithICS({
    to: booking.clientEmail,
    subject: `Confirmed: Coaching Session on ${clientDt.toFormat('LLL d')} with ${coachName}`,
    html: clientHtml,
    icsContent,
  });

  // ── Coach email
  const coachHtml = bookingHtml('New Booking', `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      New Session Booked
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
      <strong>Client:</strong> ${booking.clientName}
    </p>
    <p style="color:#5a6a7e;margin:0 0 8px;">
      <strong>Email:</strong> ${booking.clientEmail}
    </p>
    ${booking.clientPhone ? `<p style="color:#5a6a7e;margin:0 0 8px;"><strong>Phone:</strong> ${booking.clientPhone}</p>` : ''}
    ${booking.topic ? `<p style="color:#5a6a7e;margin:0 0 8px;"><strong>Topic:</strong> ${booking.topic}</p>` : ''}
    ${meetSection}
  `);

  await sendRawEmailWithICS({
    to: coachEmail,
    subject: `New Booking: ${booking.clientName} on ${coachDt.toFormat('LLL d')} at ${coachDt.toFormat('h:mm a')}`,
    html: coachHtml,
    icsContent,
  });
}

export async function sendCancellationEmail(
  booking: IBooking,
  coachName: string,
  coachEmail: string,
  cancelledBy: 'client' | 'coach',
): Promise<void> {
  const clientDt = DateTime.fromJSDate(booking.startTime).setZone(booking.clientTimezone);
  const coachDt = DateTime.fromJSDate(booking.startTime).setZone(booking.coachTimezone);

  const recipientEmail = cancelledBy === 'client' ? coachEmail : booking.clientEmail;
  const recipientName = cancelledBy === 'client' ? coachName : booking.clientName;
  const byWhom = cancelledBy === 'client' ? booking.clientName : coachName;
  const dt = cancelledBy === 'client' ? coachDt : clientDt;
  const tz = cancelledBy === 'client' ? booking.coachTimezone : booking.clientTimezone;

  const html = bookingHtml('Session Cancelled', `
    <h2 style="color:#dc2626;margin:0 0 12px;font-size:22px;">
      Session Cancelled
    </h2>
    <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
      The coaching session scheduled for
      <strong>${dt.toFormat('cccc, LLLL d, yyyy')}</strong> at
      <strong>${dt.toFormat('h:mm a')}</strong> (${tz})
      has been cancelled by ${byWhom}.
    </p>
    ${booking.cancellationReason ? `<p style="color:#5a6a7e;margin:0 0 16px;"><strong>Reason:</strong> ${booking.cancellationReason}</p>` : ''}
  `);

  if (isDev && !config.aws.sesFromEmail) {
    console.log(`[BookingEmail] DEV — would send cancellation to ${recipientEmail}`);
    return;
  }

  const { SendEmailCommand } = await import('@aws-sdk/client-ses');
  const command = new SendEmailCommand({
    Source: FROM,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: { Data: `Cancelled: Coaching Session on ${dt.toFormat('LLL d')}`, Charset: 'UTF-8' },
      Body: { Html: { Data: html, Charset: 'UTF-8' } },
    },
  });
  await ses.send(command);
}

export async function sendRescheduleConfirmation(
  booking: IBooking,
  coachName: string,
  coachEmail: string,
  oldStartTime: Date,
  cancelUrl: string,
  triggeredBy: 'coach_gcal' | 'admin' | 'coach',
): Promise<void> {
  const oldClientDt = DateTime.fromJSDate(oldStartTime).setZone(booking.clientTimezone);
  const newClientDt = DateTime.fromJSDate(booking.startTime).setZone(booking.clientTimezone);
  const newCoachDt = DateTime.fromJSDate(booking.startTime).setZone(booking.coachTimezone);

  const meetSection = booking.googleMeetLink
    ? `<a href="${booking.googleMeetLink}"
         style="display:inline-block;background:#3A9FD6;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;margin-top:12px;">
        Join Google Meet
      </a>`
    : '';

  const icsContent = generateICS(booking, coachName, coachEmail);

  // Always email the client. Skip the coach when they triggered the change
  // from their own calendar — they already know.
  const clientHtml = bookingHtml('Your session has been rescheduled', `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      Your session has been rescheduled
    </h2>
    <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
      Your coaching session with <strong>${coachName}</strong> has been moved.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="padding:8px 0;color:#9aa5b4;font-size:13px;">Previously</td>
        <td style="padding:8px 16px;color:#9aa5b4;text-decoration:line-through;">
          ${oldClientDt.toFormat('cccc, LLL d')} at ${oldClientDt.toFormat('h:mm a')}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#1B2A47;font-size:13px;font-weight:600;">Now</td>
        <td style="padding:8px 16px;color:#1B2A47;font-weight:600;">
          ${newClientDt.toFormat('cccc, LLLL d, yyyy')} at ${newClientDt.toFormat('h:mm a')}
          (${booking.clientTimezone})
        </td>
      </tr>
    </table>
    ${meetSection}
    <p style="color:#9aa5b4;font-size:12px;margin:20px 0 0;">
      Need to cancel? <a href="${cancelUrl}" style="color:#3A9FD6;">Cancel this session</a>
    </p>
  `);

  await sendRawEmailWithICS({
    to: booking.clientEmail,
    subject: `Rescheduled: Coaching Session on ${newClientDt.toFormat('LLL d')}`,
    html: clientHtml,
    icsContent,
  });

  if (triggeredBy === 'coach_gcal') return;

  // Coach email (admin-triggered reschedules only)
  const coachHtml = bookingHtml('Session rescheduled', `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      Session rescheduled
    </h2>
    <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
      The session with <strong>${booking.clientName}</strong> has been moved to
      <strong>${newCoachDt.toFormat('cccc, LLLL d, yyyy')}</strong> at
      <strong>${newCoachDt.toFormat('h:mm a')}</strong> (${booking.coachTimezone}).
    </p>
    ${booking.topic ? `<p style="color:#5a6a7e;margin:0 0 8px;"><strong>Topic:</strong> ${booking.topic}</p>` : ''}
  `);

  await sendRawEmailWithICS({
    to: coachEmail,
    subject: `Rescheduled: ${booking.clientName} on ${newCoachDt.toFormat('LLL d')}`,
    html: coachHtml,
    icsContent,
  });
}

export async function sendReminder(
  booking: IBooking,
  coachName: string,
  type: '24h' | '1h',
): Promise<void> {
  const clientDt = DateTime.fromJSDate(booking.startTime).setZone(booking.clientTimezone);
  const duration = Math.round(
    (booking.endTime.getTime() - booking.startTime.getTime()) / 60_000,
  );
  const timeLabel = type === '24h' ? 'tomorrow' : 'in 1 hour';

  const meetSection = booking.googleMeetLink
    ? `<a href="${booking.googleMeetLink}"
         style="display:inline-block;background:#3A9FD6;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;margin-top:12px;">
        Join Google Meet
      </a>`
    : '';

  const html = bookingHtml('Session Reminder', `
    <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
      Reminder: Your session is ${timeLabel}
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
      <strong>Coach:</strong> ${coachName}
    </p>
    ${meetSection}
  `);

  if (isDev && !config.aws.sesFromEmail) {
    console.log(`[BookingEmail] DEV — would send ${type} reminder to ${booking.clientEmail}`);
    return;
  }

  const { SendEmailCommand } = await import('@aws-sdk/client-ses');
  const command = new SendEmailCommand({
    Source: FROM,
    Destination: { ToAddresses: [booking.clientEmail] },
    Message: {
      Subject: {
        Data: `Reminder: Coaching session ${timeLabel} with ${coachName}`,
        Charset: 'UTF-8',
      },
      Body: { Html: { Data: html, Charset: 'UTF-8' } },
    },
  });
  await ses.send(command);
}
