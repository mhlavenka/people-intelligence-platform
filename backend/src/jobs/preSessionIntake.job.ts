import cron from 'node-cron';
import { CoachingSession } from '../models/CoachingSession.model';
import { User } from '../models/User.model';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { sendEmail } from '../services/email.service';
import { notifyPreSessionForm } from '../services/hubNotification.service';
import { config } from '../config/env';

const WINDOW_MS = 15 * 60 * 1000;

export function startPreSessionIntakeJob(): void {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const sessions = await CoachingSession.find({
        status: 'scheduled',
        preSessionIntakeTemplateId: { $exists: true, $ne: null },
        preSessionIntakeSentAt: { $exists: false },
        date: {
          $gte: now,
          $lte: new Date(in24h.getTime() + WINDOW_MS),
        },
      }).setOptions({ bypassTenantCheck: true });

      for (const session of sessions) {
        try {
          const [coachee, coach, template] = await Promise.all([
            User.findById(session.coacheeId).select('firstName lastName email'),
            User.findById(session.coachId).select('firstName lastName'),
            SurveyTemplate.findById(session.preSessionIntakeTemplateId)
              .select('title')
              .setOptions({ bypassTenantCheck: true }),
          ]);

          if (!coachee?.email || !template) continue;

          const coachName = coach ? `${coach.firstName} ${coach.lastName}` : 'your coach';
          const sessionDate = session.date.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          });
          const sessionTime = session.date.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit',
          });
          const intakeUrl = `${config.frontendUrl}/intake/${template._id}?sessionId=${session._id}`;

          await sendEmail({
            to: coachee.email,
            subject: `Pre-session form ready — ${sessionDate}`,
            html: buildPreSessionIntakeHtml({
              coacheeName: coachee.firstName,
              coachName,
              templateTitle: template.title,
              sessionDate,
              sessionTime,
              intakeUrl,
            }),
          });

          notifyPreSessionForm({
            coacheeId: session.coacheeId,
            organizationId: session.organizationId,
            coachName,
            sessionDate,
            templateTitle: template.title,
            intakeUrl,
          }).catch((err) => console.error('[PreSessionIntake] Hub notification failed:', err));

          session.preSessionIntakeSentAt = now;
          await session.save();
          console.log(`[PreSessionIntake] Sent to ${coachee.email} for session ${session._id}`);
        } catch (err) {
          console.error(`[PreSessionIntake] Failed for session ${session._id}:`, err);
        }
      }
    } catch (err) {
      console.error('[PreSessionIntake] Job failed:', err);
    }
  });

  console.log('[PreSessionIntake] Pre-session intake notification job started (every 15 min)');
}

function buildPreSessionIntakeHtml(p: {
  coacheeName: string;
  coachName: string;
  templateTitle: string;
  sessionDate: string;
  sessionTime: string;
  intakeUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#EBF5FB;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EBF5FB;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:#1B2A47;padding:28px 36px;text-align:left;">
    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ARTES</span>
  </td></tr>
  <tr><td style="padding:36px 36px 28px;">
    <h2 style="margin:0 0 16px;color:#1B2A47;font-size:20px;">
      Hi ${p.coacheeName}, your pre-session form is ready
    </h2>
    <p style="color:#5a6a7e;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${p.coachName} has a brief questionnaire for you to complete before your
      upcoming coaching session.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;width:100%;margin-bottom:20px;">
      <tr>
        <td style="color:#5a6a7e;font-size:13px;padding:4px 0;">
          <strong style="color:#1B2A47;">Session:</strong> ${p.sessionDate} at ${p.sessionTime}
        </td>
      </tr>
      <tr>
        <td style="color:#5a6a7e;font-size:13px;padding:4px 0;">
          <strong style="color:#1B2A47;">Form:</strong> ${p.templateTitle}
        </td>
      </tr>
    </table>
    <p style="color:#5a6a7e;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Please complete it before your session so your coach can review your
      responses and make the most of your time together.
    </p>
    <a href="${p.intakeUrl}"
       style="display:inline-block;background:#7c5cbf;color:#ffffff;
              font-size:15px;font-weight:600;padding:12px 28px;
              border-radius:8px;text-decoration:none;">
      Complete Pre-Session Form
    </a>
  </td></tr>
  <tr><td style="background:#f7f9fc;padding:20px 36px;border-top:1px solid #e8eef4;text-align:center;">
    <p style="margin:0;color:#9aa5b4;font-size:12px;line-height:1.5;">
      &copy; ${new Date().getFullYear()} HeadSoft Tech &times; Helena Coaching.<br/>
      You received this email because you have an account on ARTES.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
