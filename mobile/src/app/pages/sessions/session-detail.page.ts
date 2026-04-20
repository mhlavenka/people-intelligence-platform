import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { timeOutline, personOutline, documentTextOutline, createOutline, checkmarkCircleOutline } from 'ionicons/icons';
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
  preSessionIntakeTemplateId?: { _id: string; title: string } | string;
  postSessionIntakeTemplateId?: { _id: string; title: string } | string;
  preSessionIntakeCompleted?: boolean;
  postSessionIntakeCompleted?: boolean;
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
    IonButton,
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

        @if (hasPreIntake()) {
          <ion-button
            expand="block"
            [fill]="session()!.preSessionIntakeCompleted ? 'outline' : 'solid'"
            [color]="session()!.preSessionIntakeCompleted ? 'medium' : 'primary'"
            (click)="openIntake('pre')"
          >
            <ion-icon [name]="session()!.preSessionIntakeCompleted ? 'checkmark-circle-outline' : 'create-outline'" slot="start"></ion-icon>
            {{ session()!.preSessionIntakeCompleted ? 'Pre-Session Form Completed' : 'Complete Pre-Session Form' }}
          </ion-button>
        }

        @if (hasPostIntake()) {
          <ion-button
            expand="block"
            [fill]="session()!.postSessionIntakeCompleted ? 'outline' : 'solid'"
            [color]="session()!.postSessionIntakeCompleted ? 'medium' : 'secondary'"
            (click)="openIntake('post')"
          >
            <ion-icon [name]="session()!.postSessionIntakeCompleted ? 'checkmark-circle-outline' : 'create-outline'" slot="start"></ion-icon>
            {{ session()!.postSessionIntakeCompleted ? 'Post-Session Reflection Completed' : 'Complete Post-Session Reflection' }}
          </ion-button>
        }

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
  private router = inject(Router);
  private api = inject(ApiService);

  session = signal<SessionDetail | null>(null);
  loading = signal(true);

  constructor() {
    addIcons({ timeOutline, personOutline, documentTextOutline, createOutline, checkmarkCircleOutline });
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

  hasPreIntake(): boolean {
    const s = this.session();
    return !!s?.preSessionIntakeTemplateId;
  }

  hasPostIntake(): boolean {
    const s = this.session();
    return !!s?.postSessionIntakeTemplateId;
  }

  openIntake(type: 'pre' | 'post') {
    const s = this.session();
    if (!s) return;
    const templateRef = type === 'pre' ? s.preSessionIntakeTemplateId : s.postSessionIntakeTemplateId;
    const templateId = typeof templateRef === 'string' ? templateRef : templateRef?._id;
    if (!templateId) return;
    this.router.navigate(['/tabs/sessions', s._id, 'intake', templateId], {
      queryParams: { type },
    });
  }
}
