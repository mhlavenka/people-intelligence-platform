import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-conflict-skill-building',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <!-- Knowledge & Skill Building -->
    <div class="section-card knowledge">
      <div class="section-header">
        <div class="section-icon blue"><mat-icon>school</mat-icon></div>
        <div>
          <h3>{{ "CONFLICT.knowledgeSkillBuilding" | translate }}</h3>
          <p>{{ "CONFLICT.knowledgeSkillBuildingDesc" | translate }}</p>
        </div>
      </div>

      <div class="edu-columns">
        <div class="edu-col">
          <div class="edu-col-label"><mat-icon>layers</mat-icon> {{ "CONFLICT.inPlatformModules" | translate }}</div>
          @for (item of inPlatformPaths; track item.route) {
            <a class="edu-card" [routerLink]="item.route">
              <div class="edu-icon" [style.background]="item.color + '18'" [style.color]="item.color">
                <mat-icon>{{ item.icon }}</mat-icon>
              </div>
              <div class="edu-info">
                <strong>{{ item.titleKey | translate }}</strong>
                <span>{{ item.descKey | translate }}</span>
              </div>
              <mat-icon class="edu-arrow">chevron_right</mat-icon>
            </a>
          }
        </div>

        <div class="edu-col">
          <div class="edu-col-label"><mat-icon>open_in_new</mat-icon> {{ "CONFLICT.externalAssessments" | translate }}</div>
          @for (item of externalTools; track item.url) {
            <a class="edu-card" [href]="item.url" target="_blank" rel="noopener">
              <div class="edu-icon" [style.background]="item.color + '18'" [style.color]="item.color">
                <mat-icon>{{ item.icon }}</mat-icon>
              </div>
              <div class="edu-info">
                <strong>{{ item.titleKey | translate }}</strong>
                <span>{{ item.descKey | translate }}</span>
              </div>
              <mat-icon class="edu-arrow">open_in_new</mat-icon>
            </a>
          }
        </div>
      </div>
    </div>

    <!-- Interest-Based Negotiation Toolkit -->
    <div class="section-card toolkit">
      <div class="section-header">
        <div class="section-icon green"><mat-icon>handshake</mat-icon></div>
        <div>
          <h3>{{ "CONFLICT.negotiationToolkit" | translate }}</h3>
          <p>{{ "CONFLICT.negotiationToolkitDesc" | translate }}</p>
        </div>
      </div>
      <div class="toolkit-grid">
        @for (resource of toolkitResources; track resource.titleKey) {
          <div class="toolkit-card">
            <div class="toolkit-icon" [style.background]="resource.color + '18'" [style.color]="resource.color">
              <mat-icon>{{ resource.icon }}</mat-icon>
            </div>
            <div class="toolkit-info">
              <strong>{{ resource.titleKey | translate }}</strong>
              <span>{{ resource.descKey | translate }}</span>
            </div>
            <button mat-icon-button [matTooltip]="('CONFLICT.downloadResource' | translate) + ' ' + (resource.titleKey | translate)" class="download-btn">
              <mat-icon>download</mat-icon>
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .edu-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .edu-col-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.7px; color: #9aa5b4; margin-bottom: 10px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .edu-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 10px; margin-bottom: 8px;
      border: 1px solid #e8edf4; text-decoration: none; cursor: pointer;
      background: #fafbfc; transition: background 0.13s, border-color 0.13s;
      &:last-child { margin-bottom: 0; }
      &:hover { background: #f0f8ff; border-color: var(--artes-accent); }
    }
    .edu-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; }
    }
    .edu-info {
      flex: 1; min-width: 0;
      strong { display: block; font-size: 13px; color: var(--artes-primary); margin-bottom: 2px; }
      span { font-size: 11px; color: #6b7280; line-height: 1.4; display: block; }
    }
    .edu-arrow { color: #c4cdd6; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

    .toolkit-grid { display: flex; flex-direction: column; gap: 10px; }
    .toolkit-card {
      display: flex; align-items: center; gap: 14px; padding: 14px 16px;
      border: 1px solid #e8edf4; border-radius: 10px; background: #fafbfc;
      transition: background 0.15s;
      &:hover { background: #f0f4f8; }
    }
    .toolkit-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; }
    }
    .toolkit-info {
      flex: 1; display: flex; flex-direction: column; gap: 2px;
      strong { font-size: 13px; color: var(--artes-primary); }
      span { font-size: 12px; color: #5a6a7e; }
    }
    .download-btn { color: var(--artes-accent); }
  `],
})
export class ConflictSkillBuildingComponent {
  inPlatformPaths = [
    { route: '/neuroinclusion', titleKey: 'CONFLICT.neuroInclusionTitle', descKey: 'CONFLICT.neuroInclusionDesc', icon: 'psychology', color: '#27C4A0' },
    { route: '/succession', titleKey: 'CONFLICT.leadershipIDPTitle', descKey: 'CONFLICT.leadershipIDPDesc', icon: 'trending_up', color: '#3A9FD6' },
    { route: '/coach/interview', titleKey: 'CONFLICT.coachInterviewTitle', descKey: 'CONFLICT.coachInterviewDesc', icon: 'record_voice_over', color: '#7c3aed' },
  ];

  externalTools = [
    { url: 'https://cad.storefront.mhs.com/collections/eq-i-2-0/', titleKey: 'CONFLICT.eqi20Title', descKey: 'CONFLICT.eqi20Desc', icon: 'insights', color: '#e86c3a' },
    { url: 'https://cad.storefront.mhs.com/collections/eq-360/', titleKey: 'CONFLICT.eq360Title', descKey: 'CONFLICT.eq360Desc', icon: '360', color: '#f0a500' },
    { url: 'https://www.themyersbriggs.com/en-US/Products-and-Services/Myers-Briggs', titleKey: 'CONFLICT.mbtiTitle', descKey: 'CONFLICT.mbtiDesc', icon: 'people_alt', color: '#1B2A47' },
    { url: 'https://www.viacharacter.org/', titleKey: 'CONFLICT.viaTitle', descKey: 'CONFLICT.viaDesc', icon: 'star_outline', color: '#27C4A0' },
  ];

  toolkitResources = [
    { titleKey: 'CONFLICT.positionsFrameworkTitle', descKey: 'CONFLICT.positionsFrameworkDesc', icon: 'compare_arrows', color: '#3A9FD6' },
    { titleKey: 'CONFLICT.interestMappingTitle', descKey: 'CONFLICT.interestMappingDesc', icon: 'account_tree', color: '#27C4A0' },
    { titleKey: 'CONFLICT.conflictDiagnosticTitle', descKey: 'CONFLICT.conflictDiagnosticDesc', icon: 'category', color: '#e86c3a' },
    { titleKey: 'CONFLICT.managerPlannerTitle', descKey: 'CONFLICT.managerPlannerDesc', icon: 'edit_note', color: '#7c3aed' },
  ];
}
