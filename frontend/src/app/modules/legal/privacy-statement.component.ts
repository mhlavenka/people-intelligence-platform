import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-privacy-statement',
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
          <a routerLink="/login" mat-stroked-button class="nav-btn">{{ "LEGAL.signIn" | translate }}</a>
        </nav>
      </header>

      <main class="legal-content">
        <div class="hero">
          <mat-icon class="hero-icon">shield</mat-icon>
          <h1>{{ "LEGAL.privacyTitle" | translate }}</h1>
          <p class="subtitle">{{ "LEGAL.lastUpdated" | translate }}</p>
        </div>

        <article class="document">

          <section>
            <h2>{{ "LEGAL.privacy.s1Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s1p1" | translate }}</p>
            <p>{{ "LEGAL.privacy.s1p2" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s2Title" | translate }}</h2>
            <div class="info-box">
              <p [innerHTML]="'LEGAL.privacy.s2controller' | translate"></p>
              <p [innerHTML]="'LEGAL.privacy.s2processor' | translate"></p>
            </div>
            <p>{{ "LEGAL.privacy.s2p1" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s3Title" | translate }}</h2>

            <h3>{{ "LEGAL.privacy.s3h1" | translate }}</h3>
            <p>{{ "LEGAL.privacy.s3h1intro" | translate }}</p>
            <ul>
              <li>{{ "LEGAL.privacy.s3h1li1" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h1li2" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h1li3" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h1li4" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h1li5" | translate }}</li>
            </ul>

            <h3>{{ "LEGAL.privacy.s3h2" | translate }}</h3>
            <ul>
              <li>{{ "LEGAL.privacy.s3h2li1" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h2li2" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h2li3" | translate }}</li>
            </ul>

            <h3>{{ "LEGAL.privacy.s3h3" | translate }}</h3>
            <ul>
              <li>{{ "LEGAL.privacy.s3h3li1" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h3li2" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h3li3" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h3li4" | translate }}</li>
            </ul>

            <h3>{{ "LEGAL.privacy.s3h4" | translate }}</h3>
            <ul>
              <li>{{ "LEGAL.privacy.s3h4li1" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h4li2" | translate }}</li>
            </ul>

            <h3>{{ "LEGAL.privacy.s3h5" | translate }}</h3>
            <ul>
              <li>{{ "LEGAL.privacy.s3h5li1" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h5li2" | translate }}</li>
              <li>{{ "LEGAL.privacy.s3h5li3" | translate }}</li>
            </ul>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s4Title" | translate }}</h2>
            <table class="data-table">
              <thead>
                <tr><th>{{ "LEGAL.privacy.s4thPurpose" | translate }}</th><th>{{ "LEGAL.privacy.s4thLegal" | translate }}</th></tr>
              </thead>
              <tbody>
                <tr><td>{{ "LEGAL.privacy.s4r1purpose" | translate }}</td><td>{{ "LEGAL.privacy.s4r1legal" | translate }}</td></tr>
                <tr><td>{{ "LEGAL.privacy.s4r2purpose" | translate }}</td><td>{{ "LEGAL.privacy.s4r2legal" | translate }}</td></tr>
                <tr><td>{{ "LEGAL.privacy.s4r3purpose" | translate }}</td><td>{{ "LEGAL.privacy.s4r3legal" | translate }}</td></tr>
                <tr><td>{{ "LEGAL.privacy.s4r4purpose" | translate }}</td><td>{{ "LEGAL.privacy.s4r4legal" | translate }}</td></tr>
                <tr><td>{{ "LEGAL.privacy.s4r5purpose" | translate }}</td><td>{{ "LEGAL.privacy.s4r5legal" | translate }}</td></tr>
                <tr><td>{{ "LEGAL.privacy.s4r6purpose" | translate }}</td><td>{{ "LEGAL.privacy.s4r6legal" | translate }}</td></tr>
                <tr><td>{{ "LEGAL.privacy.s4r7purpose" | translate }}</td><td>{{ "LEGAL.privacy.s4r7legal" | translate }}</td></tr>
                <tr><td>{{ "LEGAL.privacy.s4r8purpose" | translate }}</td><td>{{ "LEGAL.privacy.s4r8legal" | translate }}</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s5Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s5p1" | translate }}</p>
            <p [innerHTML]="'LEGAL.privacy.s5p2' | translate"></p>
            <p>{{ "LEGAL.privacy.s5p3" | translate }}</p>
            <p>{{ "LEGAL.privacy.s5p4" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s6Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s6p1" | translate }}</p>
            <ul>
              <li [innerHTML]="'LEGAL.privacy.s6li1' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s6li2' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s6li3' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s6li4' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s6li5' | translate"></li>
            </ul>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s7Title" | translate }}</h2>
            <ul>
              <li [innerHTML]="'LEGAL.privacy.s7li1' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s7li2' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s7li3' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s7li4' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s7li5' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s7li6' | translate"></li>
            </ul>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s8Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s8p1" | translate }}</p>
            <p [innerHTML]="'LEGAL.privacy.s8p2' | translate"></p>
            <p>{{ "LEGAL.privacy.s8p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s9Title" | translate }}</h2>
            <ul>
              <li [innerHTML]="'LEGAL.privacy.s9li1' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s9li2' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s9li3' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s9li4' | translate"></li>
            </ul>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s10Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s10p1" | translate }}</p>
            <ul>
              <li [innerHTML]="'LEGAL.privacy.s10li1' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s10li2' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s10li3' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s10li4' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s10li5' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s10li6' | translate"></li>
              <li [innerHTML]="'LEGAL.privacy.s10li7' | translate"></li>
            </ul>
            <p>{{ "LEGAL.privacy.s10p2" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s11Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s11p1" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s12Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s12p1" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s13Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s13p1" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s14Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s14p1" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.privacy.s15Title" | translate }}</h2>
            <p>{{ "LEGAL.privacy.s15p1" | translate }}</p>
            <div class="contact-card">
              <p><strong>{{ "LEGAL.privacy.s15company" | translate }}</strong></p>
              <p>{{ "LEGAL.privacy.s15email" | translate }} <a href="mailto:privacy@helenacoaching.com">privacy&#64;helenacoaching.com</a></p>
              <p>{{ "LEGAL.privacy.s15platform" | translate }} <a href="https://artes.helenacoaching.com">artes.helenacoaching.com</a></p>
            </div>
            <p style="margin-top: 12px;" [innerHTML]="'LEGAL.privacy.s15authority' | translate"></p>
          </section>

        </article>
      </main>

      <footer class="legal-footer">
        <div class="footer-inner">
          <span>&copy; 2026 HeadSoft Technology &times; Helena Coaching. All rights reserved.</span>
          <div class="footer-links">
            <a routerLink="/termsofservice">{{ "LEGAL.footerTerms" | translate }}</a>
            <a routerLink="/privacystatement">{{ "LEGAL.footerPrivacy" | translate }}</a>
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
