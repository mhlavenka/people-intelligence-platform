import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';

interface PendingIntake {
  _id: string;
  title: string;
  description?: string;
  moduleType: 'conflict' | 'neuroinclusion' | 'succession' | 'coaching';
  intakeType: 'survey' | 'interview' | 'assessment';
  questions: { id: string }[];
  language?: string;
  submitted?: boolean;
}

@Component({
  selector: 'app-take-survey-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatChipsModule, TranslateModule,
  ],
  template: `
    <div class="page">
      <div class="header">
        <div>
          <h1>{{ 'NAV.takeSurvey' | translate }}</h1>
          <p class="subtitle">{{ 'TAKE_SURVEY.subtitle' | translate }}</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="32" /></div>
      } @else if (intakes().length === 0) {
        <div class="empty">
          <mat-icon>inbox</mat-icon>
          <h3>{{ 'TAKE_SURVEY.emptyTitle' | translate }}</h3>
          <p>{{ 'TAKE_SURVEY.emptyHint' | translate }}</p>
        </div>
      } @else {
        <div class="cards">
          @for (i of intakes(); track i._id) {
            <div class="card">
              <div class="card-meta">
                <mat-icon class="module-icon" [class]="'mod-' + i.moduleType">{{ moduleIcon(i.moduleType) }}</mat-icon>
                <span class="type-pill">{{ ('SURVEY.type' + capitalize(i.intakeType)) | translate }}</span>
              </div>
              <h3 class="card-title">{{ i.title }}</h3>
              @if (i.description) {
                <p class="card-desc">{{ i.description }}</p>
              }
              <div class="card-foot">
                <span class="qcount">
                  <mat-icon>list_alt</mat-icon>
                  {{ i.questions.length }} {{ 'SURVEY.questions' | translate }}
                </span>
                <button mat-raised-button color="primary"
                        [routerLink]="['/survey/take', i._id]">
                  <mat-icon>play_arrow</mat-icon> {{ 'TAKE_SURVEY.startBtn' | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; max-width: 1100px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;
      h1 { margin: 0; font-size: 24px; color: var(--artes-primary); font-weight: 600; }
      .subtitle { margin: 4px 0 0; color: #5a6a7e; font-size: 14px; }
    }

    .loading { display: flex; justify-content: center; padding: 60px; }

    .empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 80px 16px; text-align: center;
      > mat-icon { font-size: 36px; width: 36px; height: 36px; color: #cbd5e1; }
      h3 { margin: 8px 0 4px; color: var(--artes-primary); font-size: 18px; font-weight: 600; }
      p { margin: 0; color: #7f8ea3; font-size: 14px; max-width: 420px; line-height: 1.5; }
    }

    .cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }

    .card {
      background: white; border: 1px solid #edf1f6; border-radius: 12px;
      padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;
      transition: box-shadow 0.15s, border-color 0.15s;
      &:hover { box-shadow: 0 4px 16px rgba(27,42,71,0.06); border-color: #dce6f0; }
    }
    .card-meta { display: flex; align-items: center; gap: 10px;
      .module-icon { font-size: 20px; width: 20px; height: 20px;
        &.mod-conflict { color: #e86c3a; }
        &.mod-neuroinclusion { color: #27C4A0; }
        &.mod-succession { color: #3A9FD6; }
        &.mod-coaching { color: #7c5cbf; }
      }
      .type-pill {
        font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
        padding: 3px 9px; border-radius: 999px;
        background: rgba(58,159,214,0.10); color: #2080b0;
      }
    }
    .card-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--artes-primary); line-height: 1.4; }
    .card-desc { margin: 0; font-size: 13px; color: #5a6a7e; line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 6px;
      .qcount { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #7f8ea3;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }
  `],
})
export class TakeSurveyListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  loading = signal(true);
  intakes = signal<PendingIntake[]>([]);

  ngOnInit(): void {
    this.api.get<PendingIntake[]>('/surveys/my-intakes?pending=true').subscribe({
      next: (list) => { this.intakes.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  moduleIcon(m: string): string {
    return m === 'conflict' ? 'warning_amber'
      : m === 'neuroinclusion' ? 'psychology'
      : m === 'coaching' ? 'self_improvement'
      : 'trending_up';
  }

  capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
