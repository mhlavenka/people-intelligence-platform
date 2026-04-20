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
  IonRange,
  IonTextarea,
  IonRadioGroup,
  IonRadio,
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
    IonRange,
    IonTextarea,
    IonRadioGroup,
    IonRadio,
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
                  <ion-range
                    [min]="q.scale_range?.min || 1"
                    [max]="q.scale_range?.max || 10"
                    [pin]="true"
                    [snaps]="true"
                    [ticks]="true"
                    [(ngModel)]="currentAnswer"
                  ></ion-range>
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
                  <ion-radio-group [(ngModel)]="currentAnswer">
                    @for (opt of q.options; track opt.value) {
                      <ion-item>
                        <ion-radio [value]="opt.value">{{ opt.text }}</ion-radio>
                      </ion-item>
                    }
                  </ion-radio-group>
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
    if (id) {
      this.api.get<SurveyTemplate>(`/surveys/templates/${id}`).subscribe({
        next: (t) => {
          this.template.set(t);
          this.loading.set(false);
          this.loadAnswer();
        },
        error: () => this.loading.set(false),
      });
    }
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
      error: () => this.submitting.set(false),
    });
  }

  goBack() {
    this.router.navigate(['/tabs/surveys']);
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
