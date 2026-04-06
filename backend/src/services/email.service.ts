import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../config/env';

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

const FROM = config.aws.sesFromEmail || 'noreply@headsoft.net';
const isDev = config.nodeEnv !== 'production';

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
                         letter-spacing:-0.3px;">People Intelligence</span>
            <span style="color:#3A9FD6;font-size:20px;font-weight:700;">
              &nbsp;Platform</span>
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
              People Intelligence Platform.
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
}): Promise<void> {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];

  if (isDev && !config.aws.sesFromEmail) {
    console.log(
      `[EmailService] DEV — would send "${params.subject}" to ${recipients.join(', ')}`
    );
    return;
  }

  const command = new SendEmailCommand({
    Source: FROM,
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

// ─── Transactional templates ──────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your People Intelligence Platform password',
    html: brandedHtml('Reset Your Password', `
      <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
        Reset Your Password
      </h2>
      <p style="color:#5a6a7e;margin:0 0 24px;line-height:1.6;">
        We received a request to reset your password. Click the button below —
        this link expires in <strong>1 hour</strong>.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:#3A9FD6;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        Reset Password
      </a>
      <p style="color:#9aa5b4;margin:28px 0 0;font-size:13px;">
        If you didn't request a password reset, you can safely ignore this email.
        Your password won't change.
      </p>
    `),
  });
}

export async function sendWelcomeEmail(params: {
  email: string;
  firstName: string;
  orgName: string;
  tempPassword?: string;
}): Promise<void> {
  const loginUrl = `${config.frontendUrl}/auth/login`;
  const passwordLine = params.tempPassword
    ? `<p style="color:#5a6a7e;margin:0 0 8px;line-height:1.6;">
         Temporary password: <strong style="font-family:monospace;
         background:#f0f4f8;padding:2px 8px;border-radius:4px;">
         ${params.tempPassword}</strong>
         &nbsp;(please change on first login)
       </p>`
    : '';

  await sendEmail({
    to: params.email,
    subject: `Welcome to ${params.orgName} on People Intelligence Platform`,
    html: brandedHtml('Welcome', `
      <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
        Welcome, ${params.firstName}!
      </h2>
      <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
        You've been added to <strong>${params.orgName}</strong> on the People
        Intelligence Platform. Log in to get started.
      </p>
      <p style="color:#5a6a7e;margin:0 0 8px;line-height:1.6;">
        Email: <strong>${params.email}</strong>
      </p>
      ${passwordLine}
      <a href="${loginUrl}"
         style="display:inline-block;background:#1B2A47;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;margin-top:16px;">
        Log In Now
      </a>
    `),
  });
}

export async function sendIDPReadyEmail(params: {
  email: string;
  firstName: string;
  orgName: string;
}): Promise<void> {
  const url = `${config.frontendUrl}/succession`;
  await sendEmail({
    to: params.email,
    subject: 'Your Individual Development Plan is ready',
    html: brandedHtml('IDP Ready', `
      <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
        Your IDP is ready, ${params.firstName}!
      </h2>
      <p style="color:#5a6a7e;margin:0 0 24px;line-height:1.6;">
        Your coach has generated a new AI-powered Individual Development Plan
        using the GROW methodology. Log in to review your goals, milestones,
        and action steps.
      </p>
      <a href="${url}"
         style="display:inline-block;background:#3A9FD6;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        View My IDP
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
}): Promise<void> {
  const billingUrl = `${config.frontendUrl}/billing`;
  const urgency = params.isOverdue
    ? `<p style="color:#dc2626;font-weight:600;margin:0 0 16px;font-size:15px;">
         This invoice is ${params.daysOverdue} day${params.daysOverdue === 1 ? '' : 's'} overdue.
         Please pay immediately to avoid service interruption.
       </p>`
    : `<p style="color:#f59e0b;font-weight:500;margin:0 0 16px;font-size:14px;">
         Payment is due on ${params.dueDateFormatted}. Please ensure timely payment.
       </p>`;

  await sendEmail({
    to: params.email,
    subject: params.isOverdue
      ? `[OVERDUE] Invoice ${params.invoiceNumber} — ${params.totalFormatted} past due`
      : `Payment reminder — Invoice ${params.invoiceNumber} due ${params.dueDateFormatted}`,
    html: brandedHtml('Payment Reminder', `
      <h2 style="color:#1B2A47;margin:0 0 8px;font-size:22px;">
        Payment ${params.isOverdue ? 'Overdue' : 'Reminder'}
      </h2>
      <p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;">
        <strong>Organization:</strong> ${params.orgName}
      </p>
      <p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;">
        <strong>Invoice:</strong> ${params.invoiceNumber}
      </p>
      <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
        <strong>Amount due:</strong> ${params.totalFormatted}
      </p>
      ${urgency}
      <a href="${billingUrl}"
         style="display:inline-block;background:${params.isOverdue ? '#dc2626' : '#3A9FD6'};color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        Pay Now
      </a>
      <p style="color:#9aa5b4;margin:20px 0 0;font-size:12px;">
        If you have already paid, please disregard this message.
      </p>
    `),
    text: `Payment ${params.isOverdue ? 'OVERDUE' : 'Reminder'}\n\nOrganization: ${params.orgName}\nInvoice: ${params.invoiceNumber}\nAmount: ${params.totalFormatted}\nDue: ${params.dueDateFormatted}\n\nPay at: ${billingUrl}`,
  });
}

export async function sendSuspensionEmail(params: {
  email: string;
  orgName: string;
  reason: string;
  invoiceNumber?: string;
}): Promise<void> {
  const billingUrl = `${config.frontendUrl}/billing`;
  await sendEmail({
    to: params.email,
    subject: `[Action Required] ${params.orgName} — Account suspended`,
    html: brandedHtml('Account Suspended', `
      <h2 style="color:#dc2626;margin:0 0 8px;font-size:22px;">
        Account Suspended
      </h2>
      <p style="color:#5a6a7e;margin:0 0 8px;line-height:1.6;">
        Access to <strong>${params.orgName}</strong> on the People Intelligence Platform
        has been suspended.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
                  padding:14px 18px;margin:16px 0;">
        <p style="color:#dc2626;margin:0;font-weight:500;">
          <strong>Reason:</strong> ${params.reason}
        </p>
      </div>
      ${params.invoiceNumber
        ? `<p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
             Related invoice: <strong>${params.invoiceNumber}</strong>
           </p>`
        : ''}
      <p style="color:#5a6a7e;margin:0 0 24px;line-height:1.6;">
        To restore access, please settle the outstanding balance. Your data remains
        safe and will be fully available once the account is reactivated.
      </p>
      <a href="${billingUrl}"
         style="display:inline-block;background:#dc2626;color:#ffffff;
                padding:14px 28px;border-radius:6px;text-decoration:none;
                font-weight:600;font-size:15px;">
        Resolve Now
      </a>
    `),
    text: `Account Suspended\n\nOrganization: ${params.orgName}\nReason: ${params.reason}\n\nResolve at: ${billingUrl}`,
  });
}

export async function sendMessageNotificationEmail(params: {
  email: string;
  firstName: string;
  fromName: string;
  preview: string;
}): Promise<void> {
  const url = `${config.frontendUrl}/dashboard`;
  await sendEmail({
    to: params.email,
    subject: `New message from ${params.fromName}`,
    html: brandedHtml('New Message', `
      <h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">
        New message from ${params.fromName}
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
        Open Messages
      </a>
    `),
  });
}
