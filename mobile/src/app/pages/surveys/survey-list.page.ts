import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface SurveyTemplate {
  _id: string;
  title: string;
  description?: string;
  moduleType: string;
  intakeType: string;
  questionCount?: number;
  completed?: boolean;
}

@Component({
  selector: 'app-survey-list',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonIcon,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ 'SURVEYS.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading()) {
        <ion-list>
          @for (i of [1, 2, 3]; track i) {
            <ion-item>
              <ion-label>
                <ion-skeleton-text [animated]="true" style="width: 70%"></ion-skeleton-text>
                <ion-skeleton-text [animated]="true" style="width: 50%"></ion-skeleton-text>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      } @else if (surveys().length === 0) {
        <div class="empty-state">
          <p>{{ 'SURVEYS.EMPTY' | translate }}</p>
        </div>
      } @else {
        <ion-list>
          @for (survey of surveys(); track survey._id) {
            <ion-item [button]="!survey.completed" (click)="openSurvey(survey)"
              [class.completed]="survey.completed">
              <ion-icon [name]="survey.completed ? 'checkmark-circle-outline' : 'document-text-outline'"
                slot="start" [color]="survey.completed ? 'success' : 'primary'"></ion-icon>
              <ion-label>
                <h2>{{ survey.title }}</h2>
                @if (survey.completed) {
                  <p class="completed-text">{{ 'SURVEYS.ALREADY_COMPLETED' | translate }}</p>
                } @else if (survey.description) {
                  <p>{{ survey.description }}</p>
                }
              </ion-label>
              @if (!survey.completed) {
                <ion-badge slot="end" color="tertiary">
                  {{ survey.intakeType }}
                </ion-badge>
              }
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 50%;
        color: var(--ion-color-medium);
      }
      .completed { opacity: 0.55; }
      .completed-text { color: var(--ion-color-success); font-weight: 600; }
    `,
  ],
})
export class SurveyListPage implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  surveys = signal<SurveyTemplate[]>([]);
  loading = signal(true);

  constructor() {
    addIcons({ documentTextOutline, checkmarkCircleOutline });
  }

  ngOnInit() {
    this.loadSurveys();
  }

  refresh(event: any) {
    this.loadSurveys(() => event.target.complete());
  }

  openSurvey(survey: SurveyTemplate) {
    if (survey.completed) return;
    this.router.navigate(['/tabs/surveys', survey._id]);
  }

  private loadSurveys(onComplete?: () => void) {
    this.loading.set(true);
    this.api.get<SurveyTemplate[]>('/surveys/my-intakes').subscribe({
      next: (templates) => {
        if (templates.length === 0) {
          this.surveys.set([]);
          this.loading.set(false);
          onComplete?.();
          return;
        }
        const checks = templates.map((t) =>
          this.api.get<{ alreadySubmitted: boolean }>(`/surveys/check/${t._id}`)
        );
        forkJoin(checks).subscribe({
          next: (results) => {
            this.surveys.set(templates.map((t, i) => ({ ...t, completed: results[i].alreadySubmitted })));
            this.loading.set(false);
            onComplete?.();
          },
          error: () => {
            this.surveys.set(templates);
            this.loading.set(false);
            onComplete?.();
          },
        });
      },
      error: () => {
        this.loading.set(false);
        onComplete?.();
      },
    });
  }
}
