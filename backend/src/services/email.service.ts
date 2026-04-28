import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import i18next from 'i18next';
import { config } from '../config/env';
import { AppSettings } from '../models/AppSettings.model';

// ─── Client ──────────────────────────────────────────────────────────────────

const ses = new SESClient({
  region: config.aws.region,
  ...(config.aws.accessKeyId && config.aws.secretAccessKey
    ? {
        credentials: {
          accessKeyId:     config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
      }
    : {}), // fall back to IAM role / env-based credentials when keys are absent
});

const DEFAULT_DISPLAY_NAME = 'ARTES Hub';
const DEFAULT_FALLBACK_EMAIL = 'noreply@headsoft.net';

// Cache the resolved Source header for 60s so we don't hit AppSettings on
// every send; system-admin updates take effect within a minute.
let fromCache: { value: string; expiresAt: number } | null = null;
const FROM_CACHE_TTL_MS = 60_000;

/** Build a SES Source header `"Display Name" <email@x.com>` from
 *  AppSettings.emailDelivery, falling back to env / hardcoded defaults. */
export async function getFromHeader(): Promise<string> {
  const now = Date.now();
  if (fromCache && fromCache.expiresAt > now) return fromCache.value;

  let senderEmail = '';
  let senderName = '';
  try {
    const settings = await AppSettings.findOne().select('emailDelivery').lean();
    senderEmail = (settings?.emailDelivery?.senderEmail ?? '').trim();
    senderName  = (settings?.emailDelivery?.senderName ?? '').trim();
  } catch (err) {
    console.warn('[EmailService] AppSettings lookup failed; falling back to env:', err);
  }

  if (!senderEmail) {
    // Fall back to env var (may include a display name); strip it.
    const raw = (config.aws.sesFromEmail || DEFAULT_FALLBACK_EMAIL).trim();
    const angleMatch = raw.match(/<([^>]+)>/);
    senderEmail = (angleMatch ? angleMatch[1] : raw).trim();
  }
  if (!senderName) senderName = DEFAULT_DISPLAY_NAME;

  const header = `"${senderName.replace(/"/g, '\\"')}" <${senderEmail}>`;
  fromCache = { value: header, expiresAt: now + FROM_CACHE_TTL_MS };
  return header;
}

/** Invalidate the From cache; call from system-admin-settings PUT after an
 *  emailDelivery change so the next send uses the new value immediately. */
export function invalidateFromCache(): void { fromCache = null; }

const isDev = config.nodeEnv !== 'production';

// ─── i18n helper ─────────────────────────────────────────────────────────────

function getT(language: string) {
  return i18next.getFixedT(language, 'emails');
}

// ─── Branded wrapper ──────────────────────────────────────────────────────────

function brandedHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#EBF5FB;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EBF5FB;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1B2A47;padding:28px 36px;text-align:left;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;
                         letter-spacing:-0.3px;">ARTES</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 28px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7f9fc;padding:20px 36px;
                     border-top:1px solid #e8eef4;text-align:center;">
            <p style="margin:0;color:#9aa5b4;font-size:12px;line-height:1.5;">
              © ${new Date().getFullYear()} HeadSoft Tech × Helena Coaching.<br/>
              You received this email because you have an account on the
              ARTES.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Core send function ───────────────────────────────────────────────────────

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  language?: string;
}): Promise<void> {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const isAlreadyWrapped = params.html.trimStart().startsWith('<!DOCTYPE')
    || params.html.trimStart().startsWith('<!doctype');
  if (!isAlreadyWrapped) {
    params.html = brandedHtml(params.subject, params.html);
  }

  if (isDev && !config.aws.sesFromEmail) {
    console.log(
      `[EmailService] DEV — would send "${params.subject}" to ${recipients.join(', ')}`
    );
    return;
  }

  const command = new SendEmailCommand({
    Source: await getFromHeader(),
    Destination: { ToAddresses: recipients },
    Message: {
      Subject: { Data: params.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: params.html, Charset: 'UTF-8' },
        ...(params.text ? { Text: { Data: params.text, Charset: 'UTF-8' } } : {}),
      },
    },
  });

  await ses.send(command);
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export async function sendEmailWithAttachments(params: {
  to: string | string[];
  subject: string;
  html: string;
  attachments: EmailAttachment[];
}): Promise<void> {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const wrappedHtml = brandedHtml(params.subject, params.html);

  if (isDev && !config.aws.sesFromEmail) {
    console.log(
      `[EmailService] DEV — would send "${params.subject}" to ${recipients.join(', ')} with ${params.attachments.length} attachment(s)`
    );
    return;
  }

  const fromHeader = await getFromHeader();
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const rawParts: string[] = [
    `From: ${fromHeader}`,
    `To: ${recipients.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(wrappedHtml).toString('base64').replace(/(.{76})/g, '$1\n'),
  ];

  for (const att of params.attachments) {
    rawParts.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      att.content.toString('base64').replace(/(.{76})/g, '$1\n'),
    );
  }
  rawParts.push(`--${boundary}--`);

  const command = new SendRawEmailCommand({
    RawMessage: { Data: Buffer.from(rawParts.join('\r\n')) },
  });
  await ses.send(command);
}

// ─── Transactional templates ──────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string, token: string, language = 'en'): Promise<void> {
  const t = getT(language);
  const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: t('general.resetPasswordSubject'),
    html: brandedHtml(t('general.resetPasswordTitle'), `
      <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
        ${t('general.resetPasswordTitle')}
      </h2>
      <p style="color:#5a6a7e;margin:0 0 24px;line-height:1.6;">
        ${t('general.resetPasswordBody')}
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:#3A9FD6;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        ${t('general.resetPasswordButton')}
      </a>
      <p style="color:#9aa5b4;margin:28px 0 0;font-size:13px;">
        ${t('general.resetPasswordIgnore')}
      </p>
    `),
  });
}

export async function sendWelcomeEmail(params: {
  email: string;
  firstName: string;
  orgName: string;
  tempPassword?: string;
  language?: string;
}): Promise<void> {
  const t = getT(params.language || 'en');
  const loginUrl = `${config.frontendUrl}/auth/login`;
  const passwordLine = params.tempPassword
    ? `<p style="color:#5a6a7e;margin:0 0 8px;line-height:1.6;">
         ${t('general.welcomeTempPassword')} <strong style="font-family:monospace;
         background:#f0f4f8;padding:2px 8px;border-radius:4px;">
         ${params.tempPassword}</strong>
         &nbsp;${t('general.welcomeChangePwd')}
       </p>`
    : '';

  await sendEmail({
    to: params.email,
    subject: t('general.welcomeSubject', { orgName: params.orgName }),
    html: brandedHtml(t('general.welcomeTitle', { firstName: params.firstName }), `
      <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
        ${t('general.welcomeTitle', { firstName: params.firstName })}
      </h2>
      <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
        ${t('general.welcomeBody', { orgName: params.orgName })}
      </p>
      <p style="color:#5a6a7e;margin:0 0 8px;line-height:1.6;">
        Email: <strong>${params.email}</strong>
      </p>
      ${passwordLine}
      <a href="${loginUrl}"
         style="display:inline-block;background:#1B2A47;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;margin-top:16px;">
        ${t('general.welcomeButton')}
      </a>
    `),
  });
}

export async function sendIDPReadyEmail(params: {
  email: string;
  firstName: string;
  orgName: string;
  language?: string;
}): Promise<void> {
  const t = getT(params.language || 'en');
  const url = `${config.frontendUrl}/succession`;
  await sendEmail({
    to: params.email,
    subject: t('general.idpReadySubject'),
    html: brandedHtml(t('general.idpReadyTitle', { firstName: params.firstName }), `
      <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
        ${t('general.idpReadyTitle', { firstName: params.firstName })}
      </h2>
      <p style="color:#5a6a7e;margin:0 0 24px;line-height:1.6;">
        ${t('general.idpReadyBody')}
      </p>
      <a href="${url}"
         style="display:inline-block;background:#3A9FD6;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        ${t('general.idpReadyButton')}
      </a>
    `),
  });
}

export async function sendPaymentReminderEmail(params: {
  email: string;
  orgName: string;
  invoiceNumber: string;
  totalFormatted: string;
  dueDateFormatted: string;
  daysOverdue: number;
  isOverdue: boolean;
  language?: string;
}): Promise<void> {
  const t = getT(params.language || 'en');
  const billingUrl = `${config.frontendUrl}/billing`;
  const urgency = params.isOverdue
    ? `<p style="color:#dc2626;font-weight:600;margin:0 0 16px;font-size:15px;">
         ${t('general.paymentOverdueBody', { days: params.daysOverdue })}
       </p>`
    : `<p style="color:#f59e0b;font-weight:500;margin:0 0 16px;font-size:14px;">
         ${t('general.paymentDueBody', { date: params.dueDateFormatted })}
       </p>`;

  await sendEmail({
    to: params.email,
    subject: params.isOverdue
      ? t('general.paymentOverdueSubject', { invoiceNumber: params.invoiceNumber, total: params.totalFormatted })
      : t('general.paymentReminderSubject', { invoiceNumber: params.invoiceNumber, dueDate: params.dueDateFormatted }),
    html: brandedHtml(params.isOverdue ? t('general.paymentOverdueTitle') : t('general.paymentReminderTitle'), `
      <h2 style="color:#1B2A47;margin:0 0 8px;font-size:22px;">
        ${params.isOverdue ? t('general.paymentOverdueTitle') : t('general.paymentReminderTitle')}
      </h2>
      <p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;">
        <strong>${t('general.organization')}:</strong> ${params.orgName}
      </p>
      <p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;">
        <strong>${t('general.invoice')}:</strong> ${params.invoiceNumber}
      </p>
      <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
        <strong>${t('general.amountDue')}:</strong> ${params.totalFormatted}
      </p>
      ${urgency}
      <a href="${billingUrl}"
         style="display:inline-block;background:${params.isOverdue ? '#dc2626' : '#3A9FD6'};color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        ${t('general.payNow')}
      </a>
      <p style="color:#9aa5b4;margin:20px 0 0;font-size:12px;">
        ${t('general.alreadyPaid')}
      </p>
    `),
    text: `${params.isOverdue ? t('general.paymentOverdueTitle') : t('general.paymentReminderTitle')}\n\n${t('general.organization')}: ${params.orgName}\n${t('general.invoice')}: ${params.invoiceNumber}\n${t('general.amountDue')}: ${params.totalFormatted}\n\n${billingUrl}`,
  });
}

export async function sendSuspensionEmail(params: {
  email: string;
  orgName: string;
  reason: string;
  invoiceNumber?: string;
  language?: string;
}): Promise<void> {
  const t = getT(params.language || 'en');
  const billingUrl = `${config.frontendUrl}/billing`;
  await sendEmail({
    to: params.email,
    subject: t('general.suspensionSubject', { orgName: params.orgName }),
    html: brandedHtml(t('general.suspensionTitle'), `
      <h2 style="color:#dc2626;margin:0 0 8px;font-size:22px;">
        ${t('general.suspensionTitle')}
      </h2>
      <p style="color:#5a6a7e;margin:0 0 8px;line-height:1.6;">
        ${t('general.suspensionBody', { orgName: params.orgName })}
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
                  padding:14px 18px;margin:16px 0;">
        <p style="color:#dc2626;margin:0;font-weight:500;">
          <strong>${t('general.suspensionReason')}:</strong> ${params.reason}
        </p>
      </div>
      ${params.invoiceNumber
        ? `<p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
             ${t('general.suspensionRelatedInvoice')}: <strong>${params.invoiceNumber}</strong>
           </p>`
        : ''}
      <p style="color:#5a6a7e;margin:0 0 24px;line-height:1.6;">
        ${t('general.suspensionRestore')}
      </p>
      <a href="${billingUrl}"
         style="display:inline-block;background:#dc2626;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        ${t('general.suspensionButton')}
      </a>
    `),
    text: `${t('general.suspensionTitle')}\n\n${t('general.organization')}: ${params.orgName}\n${t('general.suspensionReason')}: ${params.reason}\n\n${billingUrl}`,
  });
}

export async function sendMessageNotificationEmail(params: {
  email: string;
  firstName: string;
  fromName: string;
  preview: string;
  language?: string;
}): Promise<void> {
  const t = getT(params.language || 'en');
  const url = `${config.frontendUrl}/dashboard`;
  await sendEmail({
    to: params.email,
    subject: t('general.newMessageSubject', { fromName: params.fromName }),
    html: brandedHtml(t('general.newMessageTitle', { fromName: params.fromName }), `
      <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
        ${t('general.newMessageTitle', { fromName: params.fromName })}
      </h2>
      <div style="background:#f7f9fc;border-left:4px solid #3A9FD6;
                  padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 24px;">
        <p style="margin:0;color:#5a6a7e;font-style:italic;line-height:1.5;">
          "${params.preview}"
        </p>
      </div>
      <a href="${url}"
         style="display:inline-block;background:#1B2A47;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        ${t('general.newMessageButton')}
      </a>
    `),
  });
}
