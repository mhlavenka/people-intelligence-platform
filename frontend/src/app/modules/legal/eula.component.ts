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
            <p [innerHTML]="'LEGAL.eula.importantBox' | translate"></p>
          </div>

          <section>
            <h2>{{ "LEGAL.eula.s1Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s1p1" | translate }}</p>
            <p>{{ "LEGAL.eula.s1p2" | translate }}</p>
            <p [innerHTML]="'LEGAL.eula.s1p3' | translate"></p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s2Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s2p1" | translate }}</p>
            <ul>
              <li>{{ "LEGAL.eula.s2li1" | translate }}</li>
              <li>{{ "LEGAL.eula.s2li2" | translate }}</li>
              <li>{{ "LEGAL.eula.s2li3" | translate }}</li>
              <li>{{ "LEGAL.eula.s2li4" | translate }}</li>
              <li>{{ "LEGAL.eula.s2li5" | translate }}</li>
              <li>{{ "LEGAL.eula.s2li6" | translate }}</li>
              <li>{{ "LEGAL.eula.s2li7" | translate }}</li>
            </ul>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s3Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s3p1" | translate }}</p>
            <p>{{ "LEGAL.eula.s3p2" | translate }}</p>
            <p>{{ "LEGAL.eula.s3p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s4Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s4p1" | translate }}</p>
            <p>{{ "LEGAL.eula.s4p2" | translate }}</p>
            <p>{{ "LEGAL.eula.s4p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s5Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s5p1" | translate }}</p>
            <p [innerHTML]="'LEGAL.eula.s5p2' | translate"></p>
            <p>{{ "LEGAL.eula.s5p3" | translate }}</p>
            <p>{{ "LEGAL.eula.s5p4" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s6Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s6p1" | translate }}</p>
            <ul>
              <li [innerHTML]="'LEGAL.eula.s6li1' | translate"></li>
              <li [innerHTML]="'LEGAL.eula.s6li2' | translate"></li>
              <li [innerHTML]="'LEGAL.eula.s6li3' | translate"></li>
              <li [innerHTML]="'LEGAL.eula.s6li4' | translate"></li>
              <li [innerHTML]="'LEGAL.eula.s6li5' | translate"></li>
            </ul>
            <p>{{ "LEGAL.eula.s6p2" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s7Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s7p1" | translate }}</p>
            <p>{{ "LEGAL.eula.s7p2" | translate }}</p>
            <p>{{ "LEGAL.eula.s7p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s8Title" | translate }}</h2>
            <div class="warning-box">
              <p>{{ "LEGAL.eula.s8box1" | translate }}</p>
              <p>{{ "LEGAL.eula.s8box2" | translate }}</p>
            </div>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s9Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s9p1" | translate }}</p>
            <p>{{ "LEGAL.eula.s9p2" | translate }}</p>
            <p>{{ "LEGAL.eula.s9p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s10Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s10p1" | translate }}</p>
            <p>{{ "LEGAL.eula.s10p2" | translate }}</p>
            <p>{{ "LEGAL.eula.s10p3" | translate }}</p>
            <p>{{ "LEGAL.eula.s10p4" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s11Title" | translate }}</h2>
            <p [innerHTML]="'LEGAL.eula.s11p1' | translate"></p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s12Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s12p1" | translate }}</p>
            <p>{{ "LEGAL.eula.s12p2" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s13Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s13p1" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s14Title" | translate }}</h2>
            <p [innerHTML]="'LEGAL.eula.s14p1' | translate"></p>
          </section>

          <section>
            <h2>{{ "LEGAL.eula.s15Title" | translate }}</h2>
            <p>{{ "LEGAL.eula.s15p1" | translate }}</p>
            <div class="contact-card">
              <p><strong>{{ "LEGAL.eula.s15company" | translate }}</strong></p>
              <p>{{ "LEGAL.eula.s15email" | translate }} <a href="mailto:legal@helenacoaching.com">legal&#64;helenacoaching.com</a></p>
              <p>{{ "LEGAL.eula.s15platform" | translate }} <a href="https://artes.helenacoaching.com">artes.helenacoaching.com</a></p>
            </div>
          </section>

        </article>
      </main>

      <footer class="legal-footer">
        <div class="footer-inner">
          <span>&copy; 2026 HeadSoft Technology &times; Helena Coaching. All rights reserved.</span>
          <div class="footer-links">
            <a routerLink="/termsofservice">{{ "LEGAL.footerTermsShort" | translate }}</a>
            <a routerLink="/privacystatement">{{ "LEGAL.footerPrivacyShort" | translate }}</a>
            <a routerLink="/eula">{{ "LEGAL.footerEula" | translate }}</a>
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
