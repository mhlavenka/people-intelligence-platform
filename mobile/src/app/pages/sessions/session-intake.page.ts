import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Haptics, NotificationType } from '@capacitor/haptics';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonButton, IonSpinner, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonRange, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonLabel,
  IonToggle, IonProgressBar, IonText,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface Question {
  id: string;
  text: string;
  type: 'scale' | 'text' | 'boolean' | 'forced_choice';
  category: string;
  options?: { value: string; text: string }[];
  scale_range?: { min: number; max: number; labels?: Record<string, string> };
}

interface IntakeTemplate {
  _id: string;
  title: string;
  description?: string;
  instructions?: string;
  questions: Question[];
}

interface CheckResponse {
  alreadySubmitted: boolean;
  locked: boolean;
  lockedReason?: string;
}

@Component({
  selector: 'app-session-intake',
  standalone: true,
  imports: [
    FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonButton, IonSpinner, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonRange, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonLabel,
    IonToggle, IonProgressBar, IonText,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="'/tabs/sessions/' + sessionId"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ template()?.title || 'Session Form' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (loading()) {
        <div class="spinner-center"><ion-spinner></ion-spinner></div>
      } @else if (locked()) {
        <ion-card>
          <ion-card-content>
            <ion-text color="warning">{{ lockedReason() }}</ion-text>
          </ion-card-content>
        </ion-card>
      } @else if (alreadySubmitted() || submitted()) {
        <div class="success-state">
          <h2>Form Completed</h2>
          <p>Your response has been submitted.</p>
          <ion-button (click)="goBack()">Back to Session</ion-button>
        </div>
      } @else if (template()) {
        @if (template()!.instructions) {
          <ion-card>
            <ion-card-content>{{ template()!.instructions }}</ion-card-content>
          </ion-card>
        }

        <ion-progress-bar [value]="progress()"></ion-progress-bar>
        <p class="progress-text">{{ currentIndex() + 1 }} / {{ template()!.questions.length }}</p>

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
                    [pin]="true" [snaps]="true" [ticks]="true"
                    [(ngModel)]="currentAnswer"
                  ></ion-range>
                }
                @case ('text') {
                  <ion-textarea
                    [(ngModel)]="currentAnswer"
                    placeholder="Your answer..."
                    [autoGrow]="true" fill="outline" rows="4"
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
              <ion-button fill="outline" (click)="prev()">Previous</ion-button>
            }
            @if (currentIndex() < template()!.questions.length - 1) {
              <ion-button (click)="next()" [disabled]="currentAnswer === null">Next</ion-button>
            } @else {
              <ion-button color="success" (click)="submit()" [disabled]="submitting()">
                @if (submitting()) {
                  <ion-spinner name="crescent"></ion-spinner>
                } @else {
                  Submit
                }
              </ion-button>
            }
          </div>
        }
      }
    </ion-content>
  `,
  styles: [`
    .spinner-center { display: flex; justify-content: center; padding: 32px; }
    .progress-text { text-align: center; font-size: 13px; color: var(--ion-color-medium); margin: 8px 0; }
    .question-text { font-size: 18px; line-height: 1.4; }
    .nav-buttons { display: flex; justify-content: space-between; margin-top: 16px; }
    .success-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60%; }
  `],
})
export class SessionIntakePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  sessionId = '';
  private templateId = '';
  private type = ''; // 'pre' or 'post'

  template = signal<IntakeTemplate | null>(null);
  loading = signal(true);
  locked = signal(false);
  lockedReason = signal('');
  alreadySubmitted = signal(false);
  submitted = signal(false);
  submitting = signal(false);
  currentIndex = signal(0);

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
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
    this.templateId = this.route.snapshot.paramMap.get('templateId') || '';
    this.type = this.route.snapshot.queryParamMap.get('type') || 'pre';

    this.api.get<CheckResponse>(`/surveys/check/${this.templateId}`, { sessionId: this.sessionId }).subscribe({
      next: (check) => {
        if (check.alreadySubmitted) {
          this.alreadySubmitted.set(true);
          this.loading.set(false);
          return;
        }
        if (check.locked) {
          this.locked.set(true);
          this.lockedReason.set(check.lockedReason || 'This form is not available yet.');
          this.loading.set(false);
          return;
        }
        this.loadTemplate();
      },
      error: () => this.loading.set(false),
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

  submit() {
    this.saveAnswer();
    this.submitting.set(true);

    const responses = Object.entries(this.answers).map(([questionId, value]) => ({
      questionId,
      value,
    }));

    this.api
      .post('/surveys/respond', {
        templateId: this.templateId,
        sessionId: this.sessionId,
        isAnonymous: false,
        responses,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
          Haptics.notification({ type: NotificationType.Success });
        },
        error: () => this.submitting.set(false),
      });
  }

  goBack() {
    this.router.navigate(['/tabs/sessions', this.sessionId]);
  }

  private loadTemplate() {
    this.api.get<IntakeTemplate>(`/surveys/templates/${this.templateId}`).subscribe({
      next: (t) => { this.template.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
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
