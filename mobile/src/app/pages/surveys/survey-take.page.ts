import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Haptics, NotificationType } from '@capacitor/haptics';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonTextarea,
  IonItem,
  IonLabel,
  IonToggle,
  IonText,
  IonProgressBar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { OfflineService } from '../../core/offline.service';
import { ConnectivityService } from '../../core/connectivity.service';

interface Question {
  id: string;
  text: string;
  type: 'scale' | 'text' | 'boolean' | 'forced_choice';
  category: string;
  options?: { value: string; text: string }[];
  scale_range?: { min: number; max: number; labels?: Record<string, string> };
}

interface SurveyTemplate {
  _id: string;
  title: string;
  description?: string;
  instructions?: string;
  questions: Question[];
}

@Component({
  selector: 'app-survey-take',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonSpinner,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonTextarea,
    IonItem,
    IonLabel,
    IonToggle,
    IonText,
    IonProgressBar,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/surveys"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ template()?.title || ('SURVEYS.LOADING' | translate) }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (loading()) {
        <ion-spinner></ion-spinner>
      } @else if (submitted()) {
        <div class="success-state">
          <h2>{{ 'SURVEYS.SUBMITTED' | translate }}</h2>
          <ion-button (click)="goBack()">{{ 'SURVEYS.BACK' | translate }}</ion-button>
        </div>
      } @else if (alreadyCompleted()) {
        <div class="success-state">
          <h2>{{ 'SURVEYS.ALREADY_COMPLETED' | translate }}</h2>
          <p style="color: var(--ion-color-medium); text-align: center; padding: 0 24px;">
            {{ 'SURVEYS.ALREADY_COMPLETED_DESC' | translate }}
          </p>
          <ion-button (click)="goBack()">{{ 'SURVEYS.BACK' | translate }}</ion-button>
        </div>
      } @else if (template()) {
        @if (template()!.instructions) {
          <ion-card>
            <ion-card-content>{{ template()!.instructions }}</ion-card-content>
          </ion-card>
        }

        <ion-progress-bar [value]="progress()"></ion-progress-bar>
        <p class="progress-text">
          {{ currentIndex() + 1 }} / {{ template()!.questions.length }}
        </p>

        @let q = currentQuestion();
        @if (q) {
          <ion-card>
            <ion-card-header>
              <ion-card-title class="question-text">{{ q.text }}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              @switch (q.type) {
                @case ('scale') {
                  <div class="scale-labels">
                    <span class="scale-pole">{{ scaleLabel(q, scaleMin(q)) || (scaleMin(q) + ' — Low') }}</span>
                    <span class="scale-pole">{{ scaleLabel(q, scaleMax(q)) || (scaleMax(q) + ' — High') }}</span>
                  </div>
                  <div class="scale-grid">
                    @for (n of scaleValues(q); track n) {
                      <button class="scale-btn"
                        [class.selected]="currentAnswer === n"
                        (click)="setScale(n)">
                        {{ n }}
                      </button>
                    }
                  </div>
                  @if (currentAnswer !== null) {
                    <p class="scale-selected">
                      {{ 'SURVEYS.SELECTED' | translate }}: <strong>{{ currentAnswer }}</strong>
                      @if (scaleLabel(q, currentAnswer)) {
                        — {{ scaleLabel(q, currentAnswer) }}
                      }
                    </p>
                  }
                }
                @case ('text') {
                  <ion-textarea
                    [(ngModel)]="currentAnswer"
                    placeholder="Your answer..."
                    [autoGrow]="true"
                    fill="outline"
                    rows="4"
                  ></ion-textarea>
                }
                @case ('boolean') {
                  <ion-item>
                    <ion-toggle [(ngModel)]="currentAnswer">
                      {{ currentAnswer ? 'Yes' : 'No' }}
                    </ion-toggle>
                  </ion-item>
                }
                @case ('forced_choice') {
                  <div class="fc-list">
                    @for (opt of q.options; track opt.value) {
                      <button class="fc-card"
                        [class.selected]="currentAnswer === opt.value"
                        (click)="currentAnswer = opt.value">
                        <span class="fc-badge">{{ opt.value }}</span>
                        <span class="fc-text">{{ opt.text }}</span>
                      </button>
                    }
                  </div>
                }
              }
            </ion-card-content>
          </ion-card>

          <div class="nav-buttons">
            @if (currentIndex() > 0) {
              <ion-button fill="outline" (click)="prev()">
                {{ 'SURVEYS.PREV' | translate }}
              </ion-button>
            }
            @if (currentIndex() < template()!.questions.length - 1) {
              <ion-button (click)="next()" [disabled]="currentAnswer === null">
                {{ 'SURVEYS.NEXT' | translate }}
              </ion-button>
            } @else {
              <ion-button color="success" (click)="submit()" [disabled]="submitting()">
                @if (submitting()) {
                  <ion-spinner name="crescent"></ion-spinner>
                } @else {
                  {{ 'SURVEYS.SUBMIT' | translate }}
                }
              </ion-button>
            }
          </div>
        }
      }
    </ion-content>
  `,
  styles: [
    `
      .progress-text {
        text-align: center;
        font-size: 13px;
        color: var(--ion-color-medium);
        margin: 8px 0;
      }
      .question-text {
        font-size: 18px;
        line-height: 1.4;
      }
      .nav-buttons {
        display: flex;
        justify-content: space-between;
        margin-top: 16px;
      }
      .success-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 60%;
      }

      /* ── Scale buttons ── */
      .scale-labels {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .scale-pole {
        font-size: 12px;
        color: var(--ion-color-medium);
        font-style: italic;
      }
      .scale-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
      }
      .scale-btn {
        height: 44px;
        border-radius: 10px;
        border: 2px solid var(--ion-color-light-shade);
        background: var(--ion-color-light);
        color: var(--ion-text-color);
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s;
      }
      .scale-btn.selected {
        background: var(--ion-color-primary);
        border-color: var(--ion-color-primary);
        color: #fff;
      }
      .scale-selected {
        text-align: center;
        font-size: 13px;
        color: var(--ion-color-medium);
        margin-top: 10px;
      }

      /* ── Forced choice cards ── */
      .fc-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .fc-card {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px;
        border-radius: 12px;
        border: 2px solid var(--ion-color-light-shade);
        background: var(--ion-color-light);
        text-align: left;
        cursor: pointer;
        width: 100%;
        transition: all 0.15s;
      }
      .fc-card.selected {
        border-color: var(--ion-color-primary);
        background: var(--ion-color-primary-tint);
      }
      .fc-badge {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--ion-color-light-shade);
        color: var(--ion-color-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .fc-card.selected .fc-badge {
        background: var(--ion-color-primary);
        color: #fff;
      }
      .fc-text {
        flex: 1;
        font-size: 15px;
        line-height: 1.45;
        color: var(--ion-text-color);
      }
    `,
  ],
})
export class SurveyTakePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private offline = inject(OfflineService);
  private connectivity = inject(ConnectivityService);

  template = signal<SurveyTemplate | null>(null);
  loading = signal(true);
  currentIndex = signal(0);
  submitted = signal(false);
  submitting = signal(false);
  alreadyCompleted = signal(false);

  currentAnswer: any = null;
  private answers: Record<string, any> = {};

  currentQuestion = computed(() => {
    const t = this.template();
    return t ? t.questions[this.currentIndex()] : null;
  });

  progress = computed(() => {
    const t = this.template();
    return t ? (this.currentIndex() + 1) / t.questions.length : 0;
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.api.get<{ alreadySubmitted: boolean }>(`/surveys/check/${id}`).subscribe({
      next: (check) => {
        if (check.alreadySubmitted) {
          this.alreadyCompleted.set(true);
          this.loading.set(false);
          return;
        }
        this.api.get<SurveyTemplate>(`/surveys/templates/${id}`).subscribe({
          next: (t) => { this.template.set(t); this.loading.set(false); this.loadAnswer(); },
          error: () => this.loading.set(false),
        });
      },
      error: () => {
        this.api.get<SurveyTemplate>(`/surveys/templates/${id}`).subscribe({
          next: (t) => { this.template.set(t); this.loading.set(false); this.loadAnswer(); },
          error: () => this.loading.set(false),
        });
      },
    });
  }

  next() {
    this.saveAnswer();
    this.currentIndex.update((i) => i + 1);
    this.loadAnswer();
  }

  prev() {
    this.saveAnswer();
    this.currentIndex.update((i) => i - 1);
    this.loadAnswer();
  }

  async submit() {
    this.saveAnswer();
    this.submitting.set(true);

    const responses = Object.entries(this.answers).map(([questionId, value]) => ({
      questionId,
      value,
    }));

    const body = {
      templateId: this.template()!._id,
      isAnonymous: true,
      responses,
    };

    if (!this.connectivity.isOnline()) {
      await this.offline.queueRequest('post', '/surveys/respond', body);
      this.submitting.set(false);
      this.submitted.set(true);
      Haptics.notification({ type: NotificationType.Success });
      return;
    }

    this.api.post('/surveys/respond', body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
        Haptics.notification({ type: NotificationType.Success });
      },
      error: (err: any) => {
        this.submitting.set(false);
        if (err.status === 409) {
          this.alreadyCompleted.set(true);
          Haptics.notification({ type: NotificationType.Warning });
        }
      },
    });
  }

  goBack() {
    this.router.navigate(['/tabs/surveys']);
  }

  scaleMin(q: Question): number { return q.scale_range?.min ?? 1; }
  scaleMax(q: Question): number { return q.scale_range?.max ?? 5; }

  scaleValues(q: Question): number[] {
    const min = this.scaleMin(q);
    const max = this.scaleMax(q);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  scaleLabel(q: Question, val: number | null): string {
    if (val === null || !q.scale_range?.labels) return '';
    return q.scale_range.labels[String(val)] ?? '';
  }

  setScale(n: number): void {
    this.currentAnswer = n;
  }

  private saveAnswer() {
    const q = this.currentQuestion();
    if (q && this.currentAnswer !== null) {
      this.answers[q.id] = this.currentAnswer;
    }
  }

  private loadAnswer() {
    const q = this.currentQuestion();
    this.currentAnswer = q ? (this.answers[q.id] ?? null) : null;
  }
}
