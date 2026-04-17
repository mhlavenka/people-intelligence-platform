import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-privacy-statement',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  template: `
    <div class="legal-page">
      <header class="legal-header">
        <a routerLink="/" class="logo-link">
          <img src="assets/artes-logo-full-white.png" alt="ARTES" class="logo" onerror="this.style.display='none'" />
          <span class="logo-text">ARTES</span>
        </a>
        <nav>
          <a routerLink="/termsofservice" class="nav-link">Terms of Service</a>
          <a routerLink="/login" mat-stroked-button class="nav-btn">Sign in</a>
        </nav>
      </header>

      <main class="legal-content">
        <div class="hero">
          <mat-icon class="hero-icon">shield</mat-icon>
          <h1>Privacy Statement</h1>
          <p class="subtitle">Last updated: 17 April 2026</p>
        </div>

        <article class="document">

          <section>
            <h2>1. Overview</h2>
            <p>HeadSoft Technology ("we", "us", "our") operates the ARTES platform in partnership with Helena Coaching. This Privacy Statement explains how we collect, use, store, and protect personal data when you use the ARTES platform ("Platform").</p>
            <p>We are committed to protecting your privacy and processing personal data in compliance with the General Data Protection Regulation (GDPR), the Czech Data Protection Act, and other applicable data protection legislation.</p>
          </section>

          <section>
            <h2>2. Data Controller and Processor</h2>
            <div class="info-box">
              <p><strong>Data Controller:</strong> Your Organisation (the entity that subscribed to ARTES) determines the purposes and means of processing personal data.</p>
              <p><strong>Data Processor:</strong> HeadSoft Technology processes personal data on behalf of your Organisation, in accordance with a Data Processing Agreement.</p>
            </div>
            <p>For personal data related to your ARTES account and platform usage, HeadSoft Technology acts as the Data Controller.</p>
          </section>

          <section>
            <h2>3. Data We Collect</h2>

            <h3>3.1 Account Data</h3>
            <p>When your Organisation creates your account, we collect:</p>
            <ul>
              <li>Full name, email address, department, and role within the organisation</li>
              <li>Hashed password (never stored in plain text)</li>
              <li>Profile picture and bio (optional)</li>
              <li>Two-factor authentication configuration (optional)</li>
              <li>Passkey/WebAuthn credentials (optional)</li>
            </ul>

            <h3>3.2 Survey and Assessment Data</h3>
            <ul>
              <li>Responses to organisational surveys (conflict assessment, neuroinclusion, coaching intake)</li>
              <li>Anonymous survey responses are linked only by a submission token — we cannot identify the respondent</li>
              <li>Coach-led interview responses, including session format and target participant names</li>
            </ul>

            <h3>3.3 Coaching Data</h3>
            <ul>
              <li>Coaching engagement records (coach-coachee pairings, session history)</li>
              <li>Individual Development Plans (IDPs) including goals, milestones, and progress notes</li>
              <li>Session notes, journal entries, and pre/post-session form responses</li>
              <li>Booking information (session times, contact details, topics)</li>
            </ul>

            <h3>3.4 AI-Processed Data</h3>
            <ul>
              <li>Aggregated survey responses submitted for AI analysis (conflict risk, neuroinclusion gaps)</li>
              <li>AI-generated outputs: narratives, risk assessments, development plans, manager scripts</li>
            </ul>

            <h3>3.5 Technical Data</h3>
            <ul>
              <li>IP address, browser type, device information (for security and access logging)</li>
              <li>Authentication tokens (JWT) — short-lived, automatically rotated</li>
              <li>Calendar OAuth tokens (Google Calendar, Microsoft 365) — stored encrypted</li>
            </ul>
          </section>

          <section>
            <h2>4. How We Use Your Data</h2>
            <table class="data-table">
              <thead>
                <tr><th>Purpose</th><th>Legal Basis (GDPR)</th></tr>
              </thead>
              <tbody>
                <tr><td>Providing the Platform and its features</td><td>Contract performance (Art. 6(1)(b))</td></tr>
                <tr><td>User authentication and access control</td><td>Contract performance</td></tr>
                <tr><td>AI-powered analysis and insights</td><td>Legitimate interest (Art. 6(1)(f))</td></tr>
                <tr><td>Email notifications (booking confirmations, reminders)</td><td>Contract performance</td></tr>
                <tr><td>Calendar synchronisation (Google/Microsoft)</td><td>Consent (Art. 6(1)(a))</td></tr>
                <tr><td>Payment processing via Stripe</td><td>Contract performance</td></tr>
                <tr><td>Security monitoring and abuse prevention</td><td>Legitimate interest</td></tr>
                <tr><td>Platform improvement and analytics</td><td>Legitimate interest</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>5. AI Data Processing</h2>
            <p>5.1. The Platform uses Anthropic's Claude AI to generate analyses. Your data is sent to Anthropic's API for processing when you explicitly request an AI analysis.</p>
            <p>5.2. <strong>We do not use your data to train AI models.</strong> Anthropic's API usage terms confirm that data submitted via the API is not used for model training.</p>
            <p>5.3. AI processing is triggered only by explicit user action (e.g., clicking "Analyse" or "Generate IDP"). Data is not continuously or passively processed by AI.</p>
            <p>5.4. AI-generated outputs are stored within your Organisation's data and subject to the same access controls and retention policies.</p>
          </section>

          <section>
            <h2>6. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul>
              <li><strong>Anthropic (Claude AI):</strong> Aggregated survey data and coaching context, only when AI analysis is explicitly requested.</li>
              <li><strong>Amazon Web Services (AWS):</strong> Infrastructure hosting (EC2, SES for email). Data is processed within AWS's security framework.</li>
              <li><strong>MongoDB Atlas:</strong> Database hosting with encryption at rest and in transit.</li>
              <li><strong>Stripe:</strong> Payment processing. We do not store credit card numbers.</li>
              <li><strong>Google / Microsoft:</strong> Calendar data, only when you explicitly connect your calendar via OAuth.</li>
            </ul>
          </section>

          <section>
            <h2>7. Data Security</h2>
            <ul>
              <li><strong>Encryption:</strong> All data in transit is encrypted via TLS/HTTPS. Database connections use TLS. OAuth tokens are stored with select: false (excluded from default queries).</li>
              <li><strong>Authentication:</strong> JWT tokens with 15-minute expiry and 7-day refresh tokens. Optional two-factor authentication (TOTP) and passkey/WebAuthn support.</li>
              <li><strong>Multi-tenancy:</strong> Strict data segregation between organisations via organisationId filtering on every database query. A tenant filter plugin enforces this at the database layer.</li>
              <li><strong>Access control:</strong> Role-based access control (RBAC) with six distinct role levels. Permissions are enforced both in the API and the user interface.</li>
              <li><strong>Password security:</strong> Passwords are hashed using bcrypt. Plain-text passwords are never stored or logged.</li>
              <li><strong>Rate limiting:</strong> API endpoints are rate-limited to prevent abuse.</li>
            </ul>
          </section>

          <section>
            <h2>8. Data Anonymisation</h2>
            <p>8.1. Survey responses can be submitted anonymously via public links. Anonymous responses are linked only by an irreversible submission token.</p>
            <p>8.2. AI analysis requires a minimum of <strong>5 survey responses</strong> before aggregated results are generated. This prevents statistical de-anonymisation of individual respondents.</p>
            <p>8.3. Conflict analyses, neuroinclusion assessments, and other AI outputs are based on aggregated data and do not identify individual respondents.</p>
          </section>

          <section>
            <h2>9. Data Retention</h2>
            <ul>
              <li><strong>Active accounts:</strong> Data is retained for the duration of the Organisation's subscription.</li>
              <li><strong>After termination:</strong> Data is retained for 30 days to allow export, then permanently deleted.</li>
              <li><strong>Authentication logs:</strong> Retained for 90 days for security purposes.</li>
              <li><strong>Backup data:</strong> Encrypted backups are retained for 30 days, then purged.</li>
            </ul>
          </section>

          <section>
            <h2>10. Your Rights (GDPR)</h2>
            <p>As a data subject, you have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal data held on the Platform.</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate personal data.</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data ("right to be forgotten").</li>
              <li><strong>Restriction:</strong> Request limitation of processing in certain circumstances.</li>
              <li><strong>Data portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interest.</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent for calendar integrations at any time via the Platform settings.</li>
            </ul>
            <p>To exercise these rights, contact your Organisation's administrator or email us directly. We will respond within 30 days.</p>
          </section>

          <section>
            <h2>11. International Data Transfers</h2>
            <p>The Platform is hosted on AWS infrastructure. Data may be processed in regions where AWS and our sub-processors operate. Where data is transferred outside the European Economic Area, we ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs).</p>
          </section>

          <section>
            <h2>12. Cookies</h2>
            <p>The Platform uses only essential cookies and local storage for authentication (JWT tokens) and user preferences (language, timezone, UI settings). We do not use tracking cookies, analytics cookies, or advertising cookies.</p>
          </section>

          <section>
            <h2>13. Children's Privacy</h2>
            <p>The Platform is designed for professional use and is not directed at individuals under 16 years of age. We do not knowingly collect personal data from children.</p>
          </section>

          <section>
            <h2>14. Changes to This Statement</h2>
            <p>We may update this Privacy Statement periodically. We will notify Organisation administrators of material changes at least 30 days before they take effect. The "Last updated" date above reflects the most recent revision.</p>
          </section>

          <section>
            <h2>15. Contact</h2>
            <p>For privacy-related enquiries, data subject requests, or complaints:</p>
            <div class="contact-card">
              <p><strong>HeadSoft Technology — Data Protection</strong></p>
              <p>Email: <a href="mailto:privacy@helenacoaching.com">privacy&#64;helenacoaching.com</a></p>
              <p>Platform: <a href="https://artes.helenacoaching.com">artes.helenacoaching.com</a></p>
            </div>
            <p style="margin-top: 12px;">You also have the right to lodge a complaint with your local data protection authority. In the Czech Republic, this is the Office for Personal Data Protection (<a href="https://www.uoou.cz" target="_blank">www.uoou.cz</a>).</p>
          </section>

        </article>
      </main>

      <footer class="legal-footer">
        <div class="footer-inner">
          <span>&copy; 2026 HeadSoft Technology &times; Helena Coaching. All rights reserved.</span>
          <div class="footer-links">
            <a routerLink="/termsofservice">Terms of Service</a>
            <a routerLink="/privacystatement">Privacy Statement</a>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f8fafb; }

    .legal-page { display: flex; flex-direction: column; min-height: 100vh; }

    .legal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 40px; background: #1B2A47;
    }
    .logo-link {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; color: #fff;
    }
    .logo { height: 32px; }
    .logo-text { font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #fff; }
    .legal-header nav { display: flex; align-items: center; gap: 16px; }
    .nav-link { color: rgba(255,255,255,0.8); text-decoration: none; font-size: 14px; &:hover { color: #fff; } }
    .nav-btn { color: #fff !important; border-color: rgba(255,255,255,0.4) !important; font-size: 14px !important; }

    .legal-content { flex: 1; max-width: 800px; width: 100%; margin: 0 auto; padding: 0 24px 60px; }

    .hero { text-align: center; padding: 48px 0 32px; }
    .hero-icon { font-size: 48px; width: 48px; height: 48px; color: #27C4A0; margin-bottom: 12px; }
    .hero h1 { font-size: 36px; color: #1B2A47; margin: 0 0 8px; font-weight: 700; }
    .subtitle { color: #6b7c93; font-size: 14px; margin: 0; }

    .document { background: #fff; border-radius: 16px; padding: 48px; box-shadow: 0 2px 16px rgba(0,0,0,0.04); }

    section { margin-bottom: 32px; &:last-child { margin-bottom: 0; } }

    h2 {
      font-size: 18px; color: #1B2A47; font-weight: 600; margin: 0 0 12px;
      padding-bottom: 8px; border-bottom: 1px solid #eef2f6;
    }
    h3 { font-size: 15px; color: #1B2A47; font-weight: 600; margin: 16px 0 8px; }

    p { font-size: 15px; line-height: 1.7; color: #3d4f63; margin: 0 0 10px; }

    ul { padding-left: 20px; margin: 8px 0 12px; }
    li { font-size: 15px; line-height: 1.7; color: #3d4f63; margin-bottom: 6px; }

    a { color: #3A9FD6; text-decoration: none; &:hover { text-decoration: underline; } }

    .info-box {
      background: #EBF5FB; border-left: 4px solid #3A9FD6; border-radius: 0 8px 8px 0;
      padding: 14px 18px; margin: 0 0 16px;
      p { margin: 0 0 6px; &:last-child { margin: 0; } }
    }

    .data-table {
      width: 100%; border-collapse: collapse; margin: 12px 0;
      font-size: 14px;
      th { text-align: left; padding: 10px 14px; background: #f4f7fa; color: #1B2A47; font-weight: 600; border-bottom: 2px solid #e8eef4; }
      td { padding: 10px 14px; border-bottom: 1px solid #eef2f6; color: #3d4f63; }
      tr:last-child td { border-bottom: none; }
    }

    .contact-card {
      background: #f4f7fa; border-radius: 10px; padding: 16px 20px; margin-top: 12px;
      p { margin: 0 0 4px; &:last-child { margin: 0; } }
    }

    .legal-footer {
      background: #1B2A47; color: rgba(255,255,255,0.7); padding: 20px 40px;
    }
    .footer-inner {
      max-width: 800px; margin: 0 auto;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 13px;
    }
    .footer-links { display: flex; gap: 20px; }
    .footer-links a { color: rgba(255,255,255,0.7); text-decoration: none; &:hover { color: #fff; } }

    @media (max-width: 640px) {
      .legal-header { padding: 12px 16px; }
      .legal-content { padding: 0 12px 40px; }
      .document { padding: 24px 20px; }
      .hero h1 { font-size: 28px; }
      .data-table { font-size: 13px; th, td { padding: 8px 10px; } }
      .footer-inner { flex-direction: column; gap: 8px; text-align: center; }
    }
  `],
})
export class PrivacyStatementComponent {}
