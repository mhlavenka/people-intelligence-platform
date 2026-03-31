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
