import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-eula',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule,
    TranslateModule,
  ],
  template: `
    <div class="legal-page">
      <header class="legal-header">
        <a routerLink="/" class="logo-link">
          <img src="assets/artes-logo-full-white.png" alt="ARTES" class="logo" onerror="this.style.display='none'" />
          <span class="logo-text">ARTES</span>
        </a>
        <nav>
          <a routerLink="/termsofservice" class="nav-link">{{ "LEGAL.termsLink" | translate }}</a>
          <a routerLink="/privacystatement" class="nav-link">{{ "LEGAL.privacyLink" | translate }}</a>
          <a routerLink="/login" mat-stroked-button class="nav-btn">{{ "LEGAL.signIn" | translate }}</a>
        </nav>
      </header>

      <main class="legal-content">
        <div class="hero">
          <mat-icon class="hero-icon">description</mat-icon>
          <h1>{{ "LEGAL.eulaTitle" | translate }}</h1>
          <p class="subtitle">{{ "LEGAL.lastUpdated" | translate }}</p>
        </div>

        <article class="document">

          <div class="highlight-box">
            <p><strong>IMPORTANT — READ CAREFULLY:</strong> This End User Licence Agreement ("EULA") is a legal agreement between you ("User") and HeadSoft Technology ("Licensor") for the use of the ARTES software platform ("Software"). By accessing or using the Software, you agree to be bound by this EULA.</p>
          </div>

          <section>
            <h2>1. Grant of Licence</h2>
            <p>1.1. Subject to the terms of this EULA and a valid subscription, the Licensor grants you a limited, non-exclusive, non-transferable, revocable licence to access and use the Software via a web browser for your Organisation's internal business purposes.</p>
            <p>1.2. This licence is granted on a per-Organisation basis. The number of authorised users is determined by your Organisation's subscription plan.</p>
            <p>1.3. The Software is provided as a hosted service (SaaS). No software is installed on your devices — access is via the internet at <strong>artes.helenacoaching.com</strong>.</p>
          </section>

          <section>
            <h2>2. Licence Restrictions</h2>
            <p>You must not:</p>
            <ul>
              <li>Copy, modify, distribute, sell, lease, sublicence, or create derivative works based on the Software.</li>
              <li>Reverse-engineer, decompile, disassemble, or attempt to derive the source code of the Software.</li>
              <li>Remove, obscure, or alter any proprietary notices, labels, or marks on the Software.</li>
              <li>Use the Software to build a competing product or service.</li>
              <li>Access the Software through any automated means (bots, scrapers, crawlers) except through documented APIs.</li>
              <li>Share login credentials or allow unauthorised third parties to access the Software through your account.</li>
              <li>Attempt to circumvent usage limits, access controls, or security measures.</li>
            </ul>
          </section>

          <section>
            <h2>3. Intellectual Property</h2>
            <p>3.1. The Software, including its architecture, design, source code, algorithms, user interface, documentation, and all associated intellectual property rights, is and remains the exclusive property of HeadSoft Technology.</p>
            <p>3.2. This EULA does not grant you any ownership rights in the Software. You are granted only the limited licence described in Section 1.</p>
            <p>3.3. The ARTES name, logo, and associated branding are trademarks of HeadSoft Technology and Helena Coaching. You may not use these marks without prior written consent.</p>
          </section>

          <section>
            <h2>4. User Content and Data</h2>
            <p>4.1. You and your Organisation retain ownership of all data entered into the Software ("User Content"), including survey responses, coaching notes, assessment results, and organisational information.</p>
            <p>4.2. You grant the Licensor a limited licence to process User Content solely for the purpose of providing and improving the Software's functionality, including AI-powered analyses.</p>
            <p>4.3. AI-generated outputs (conflict analyses, development plans, neuroinclusion assessments) are derived from User Content using the Licensor's proprietary methodologies. These outputs are provided to your Organisation under the terms of this licence.</p>
          </section>

          <section>
            <h2>5. AI-Powered Features</h2>
            <p>5.1. The Software incorporates artificial intelligence features powered by third-party AI models. These features generate analytical outputs based on submitted data.</p>
            <p>5.2. AI-generated content is provided <strong>"as is"</strong> as a decision-support tool. It does not constitute professional advice in psychology, human resources, law, or any other domain.</p>
            <p>5.3. You acknowledge that AI outputs may contain inaccuracies and should be reviewed by qualified professionals before any action is taken.</p>
            <p>5.4. The Licensor does not warrant that AI-generated content will be accurate, complete, or fit for any particular purpose.</p>
          </section>

          <section>
            <h2>6. Third-Party Services</h2>
            <p>6.1. The Software integrates with third-party services including:</p>
            <ul>
              <li><strong>Anthropic (Claude AI)</strong> — for AI-powered analysis and content generation</li>
              <li><strong>Google Calendar / Microsoft 365</strong> — for calendar synchronisation and booking management</li>
              <li><strong>Stripe</strong> — for secure payment processing</li>
              <li><strong>Amazon Web Services (AWS)</strong> — for infrastructure and email delivery (SES)</li>
              <li><strong>MongoDB Atlas</strong> — for database services</li>
            </ul>
            <p>6.2. Your use of these integrations may be subject to the respective third-party terms. The Licensor is not responsible for the availability, performance, or security of third-party services.</p>
          </section>

          <section>
            <h2>7. Service Availability and Updates</h2>
            <p>7.1. The Licensor will make commercially reasonable efforts to maintain the Software's availability but does not guarantee uninterrupted access.</p>
            <p>7.2. The Licensor may update, modify, or enhance the Software at any time. Such updates may include bug fixes, feature additions, security patches, or changes to the user interface.</p>
            <p>7.3. The Licensor reserves the right to deprecate or remove features with reasonable notice to affected Organisations.</p>
          </section>

          <section>
            <h2>8. Disclaimer of Warranties</h2>
            <div class="warning-box">
              <p>THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
              <p>THE LICENSOR DOES NOT WARRANT THAT THE SOFTWARE WILL MEET YOUR REQUIREMENTS, OPERATE WITHOUT INTERRUPTION, OR BE ERROR-FREE.</p>
            </div>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>9.1. To the maximum extent permitted by applicable law, the Licensor shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of or inability to use the Software.</p>
            <p>9.2. The Licensor's total aggregate liability under this EULA shall not exceed the fees paid by your Organisation in the twelve (12) months preceding the event giving rise to the claim.</p>
            <p>9.3. The Licensor accepts no liability for decisions or actions taken based on AI-generated content.</p>
          </section>

          <section>
            <h2>10. Term and Termination</h2>
            <p>10.1. This EULA is effective from the date you first access the Software and continues for the duration of your Organisation's subscription.</p>
            <p>10.2. The Licensor may terminate this EULA immediately if you breach any of its terms.</p>
            <p>10.3. Upon termination, your right to access the Software ceases immediately. Sections 3, 8, 9, and 12 survive termination.</p>
            <p>10.4. Your Organisation may request data export within 30 days of termination. After this period, data will be permanently deleted.</p>
          </section>

          <section>
            <h2>11. Privacy and Data Protection</h2>
            <p>The collection and processing of personal data through the Software is governed by our <a routerLink="/privacystatement">Privacy Statement</a>. By using the Software, you acknowledge that you have read and understood the Privacy Statement.</p>
          </section>

          <section>
            <h2>12. Governing Law and Disputes</h2>
            <p>12.1. This EULA is governed by the laws of the Czech Republic, without regard to its conflict of law provisions.</p>
            <p>12.2. Any disputes arising under this EULA shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes shall be submitted to the competent courts of Prague, Czech Republic.</p>
          </section>

          <section>
            <h2>13. Severability</h2>
            <p>If any provision of this EULA is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.</p>
          </section>

          <section>
            <h2>14. Entire Agreement</h2>
            <p>This EULA, together with the <a routerLink="/termsofservice">Terms of Service</a> and <a routerLink="/privacystatement">Privacy Statement</a>, constitutes the entire agreement between you and the Licensor regarding the use of the Software, and supersedes all prior agreements and understandings.</p>
          </section>

          <section>
            <h2>15. Contact</h2>
            <p>For questions about this EULA:</p>
            <div class="contact-card">
              <p><strong>HeadSoft Technology</strong></p>
              <p>Email: <a href="mailto:legal@helenacoaching.com">legal&#64;helenacoaching.com</a></p>
              <p>Platform: <a href="https://artes.helenacoaching.com">artes.helenacoaching.com</a></p>
            </div>
          </section>

        </article>
      </main>

      <footer class="legal-footer">
        <div class="footer-inner">
          <span>&copy; 2026 HeadSoft Technology &times; Helena Coaching. All rights reserved.</span>
          <div class="footer-links">
            <a routerLink="/termsofservice">Terms</a>
            <a routerLink="/privacystatement">Privacy</a>
            <a routerLink="/eula">EULA</a>
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
    .hero-icon { font-size: 48px; width: 48px; height: 48px; color: #e67e22; margin-bottom: 12px; }
    .hero h1 { font-size: 36px; color: #1B2A47; margin: 0 0 8px; font-weight: 700; }
    .subtitle { color: #6b7c93; font-size: 14px; margin: 0; }

    .document { background: #fff; border-radius: 16px; padding: 48px; box-shadow: 0 2px 16px rgba(0,0,0,0.04); }

    section { margin-bottom: 32px; &:last-child { margin-bottom: 0; } }

    h2 {
      font-size: 18px; color: #1B2A47; font-weight: 600; margin: 0 0 12px;
      padding-bottom: 8px; border-bottom: 1px solid #eef2f6;
    }

    p { font-size: 15px; line-height: 1.7; color: #3d4f63; margin: 0 0 10px; }

    ul { padding-left: 20px; margin: 8px 0 12px; }
    li { font-size: 15px; line-height: 1.7; color: #3d4f63; margin-bottom: 6px; }

    a { color: #3A9FD6; text-decoration: none; &:hover { text-decoration: underline; } }

    .highlight-box {
      background: #EBF5FB; border-left: 4px solid #3A9FD6; border-radius: 0 8px 8px 0;
      padding: 16px 20px; margin: 0 0 28px;
      p { margin: 0; font-size: 14px; }
    }

    .warning-box {
      background: #fef8f0; border-left: 4px solid #e67e22; border-radius: 0 8px 8px 0;
      padding: 16px 20px; margin: 8px 0;
      p { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.3px; color: #5a4a3a; &:last-child { margin: 0; } }
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
      .footer-inner { flex-direction: column; gap: 8px; text-align: center; }
    }
  `],
})
export class EulaComponent {}
