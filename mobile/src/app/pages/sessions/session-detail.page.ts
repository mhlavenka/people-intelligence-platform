import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, TitleCasePipe } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonLabel,
  IonSkeletonText,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { timeOutline, personOutline, documentTextOutline } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface SessionDetail {
  _id: string;
  date: string;
  duration: number;
  format: string;
  status: string;
  topics: string[];
  sharedNotes?: string;
  coachId: { _id: string; firstName: string; lastName: string };
  growFocus?: string[];
  preSessionRating?: number;
  postSessionRating?: number;
}

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonLabel,
    IonSkeletonText,
    IonIcon,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/sessions"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'SESSIONS.DETAIL' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (loading()) {
        <ion-card>
          <ion-card-content>
            <ion-skeleton-text [animated]="true" style="width: 80%"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 60%"></ion-skeleton-text>
          </ion-card-content>
        </ion-card>
      } @else if (session()) {
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ session()!.coachId.firstName }} {{ session()!.coachId.lastName }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p>
              <ion-icon name="time-outline"></ion-icon>
              {{ session()!.date | date: 'full' }} ({{ session()!.duration }} min)
            </p>
            <p>
              <ion-icon name="person-outline"></ion-icon>
              {{ session()!.format | titlecase }}
            </p>

            @if (session()!.topics.length) {
              <div class="topics">
                @for (topic of session()!.topics; track topic) {
                  <ion-chip>
                    <ion-label>{{ topic }}</ion-label>
                  </ion-chip>
                }
              </div>
            }

            @if (session()!.growFocus?.length) {
              <div class="grow-focus">
                <h3>GROW Focus</h3>
                @for (focus of session()!.growFocus; track focus) {
                  <ion-chip color="secondary">
                    <ion-label>{{ focus | titlecase }}</ion-label>
                  </ion-chip>
                }
              </div>
            }
          </ion-card-content>
        </ion-card>

        @if (session()!.sharedNotes) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="document-text-outline"></ion-icon>
                {{ 'SESSIONS.SHARED_NOTES' | translate }}
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p class="notes-text">{{ session()!.sharedNotes }}</p>
            </ion-card-content>
          </ion-card>
        }
      }
    </ion-content>
  `,
  styles: [
    `
      .topics, .grow-focus {
        margin-top: 12px;
      }
      .grow-focus h3 {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .notes-text {
        white-space: pre-wrap;
        line-height: 1.5;
      }
      ion-icon {
        vertical-align: middle;
        margin-right: 4px;
      }
    `,
  ],
})
export class SessionDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  session = signal<SessionDetail | null>(null);
  loading = signal(true);

  constructor() {
    addIcons({ timeOutline, personOutline, documentTextOutline });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.get<SessionDetail>(`/coaching/sessions/${id}`).subscribe({
        next: (s) => {
          this.session.set(s);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }
}
