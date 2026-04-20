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
import { documentTextOutline } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface SurveyTemplate {
  _id: string;
  title: string;
  description?: string;
  moduleType: string;
  intakeType: string;
  questionCount?: number;
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
            <ion-item button (click)="openSurvey(survey._id)">
              <ion-icon name="document-text-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h2>{{ survey.title }}</h2>
                @if (survey.description) {
                  <p>{{ survey.description }}</p>
                }
              </ion-label>
              <ion-badge slot="end" color="tertiary">
                {{ survey.intakeType }}
              </ion-badge>
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
    `,
  ],
})
export class SurveyListPage implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  surveys = signal<SurveyTemplate[]>([]);
  loading = signal(true);

  constructor() {
    addIcons({ documentTextOutline });
  }

  ngOnInit() {
    this.loadSurveys();
  }

  refresh(event: any) {
    this.loadSurveys(() => event.target.complete());
  }

  openSurvey(id: string) {
    this.router.navigate(['/tabs/surveys', id]);
  }

  private loadSurveys(onComplete?: () => void) {
    this.loading.set(true);
    this.api.get<SurveyTemplate[]>('/surveys/templates', { intakeType: 'survey' }).subscribe({
      next: (templates) => {
        this.surveys.set(templates);
        this.loading.set(false);
        onComplete?.();
      },
      error: () => {
        this.loading.set(false);
        onComplete?.();
      },
    });
  }
}
