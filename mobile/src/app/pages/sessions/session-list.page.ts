import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
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
  IonSegment,
  IonSegmentButton,
  IonNote,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { videocamOutline, callOutline, personOutline } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface Session {
  _id: string;
  date: string;
  duration: number;
  format: 'video' | 'phone' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  topics: string[];
  coachId: { _id: string; firstName: string; lastName: string; profilePicture?: string };
  sharedNotes?: string;
}

@Component({
  selector: 'app-session-list',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
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
    IonSegment,
    IonSegmentButton,
    IonNote,
    IonIcon,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ 'SESSIONS.TITLE' | translate }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [(ngModel)]="segment" (ionChange)="segmentChanged()">
          <ion-segment-button value="upcoming">
            {{ 'SESSIONS.UPCOMING' | translate }}
          </ion-segment-button>
          <ion-segment-button value="past">
            {{ 'SESSIONS.PAST' | translate }}
          </ion-segment-button>
        </ion-segment>
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
                <ion-skeleton-text [animated]="true" style="width: 60%"></ion-skeleton-text>
                <ion-skeleton-text [animated]="true" style="width: 40%"></ion-skeleton-text>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      } @else if (sessions().length === 0) {
        <div class="empty-state">
          <p>{{ 'SESSIONS.EMPTY' | translate }}</p>
        </div>
      } @else {
        <ion-list>
          @for (session of sessions(); track session._id) {
            <ion-item button (click)="openSession(session._id)">
              <ion-icon
                [name]="formatIcon(session.format)"
                slot="start"
                color="medium"
              ></ion-icon>
              <ion-label>
                <h2>{{ session.coachId.firstName }} {{ session.coachId.lastName }}</h2>
                <p>{{ session.date | date: 'medium' }}</p>
                @if (session.topics.length) {
                  <ion-note>{{ session.topics.join(', ') }}</ion-note>
                }
              </ion-label>
              <ion-badge slot="end" [color]="statusColor(session.status)">
                {{ session.status }}
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
export class SessionListPage implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  sessions = signal<Session[]>([]);
  loading = signal(true);
  segment = 'upcoming';

  constructor() {
    addIcons({ videocamOutline, callOutline, personOutline });
  }

  ngOnInit() {
    this.loadSessions();
  }

  segmentChanged() {
    this.loadSessions();
  }

  refresh(event: any) {
    this.loadSessions(() => event.target.complete());
  }

  openSession(id: string) {
    this.router.navigate(['/tabs/sessions', id]);
  }

  formatIcon(format: string): string {
    switch (format) {
      case 'video': return 'videocam-outline';
      case 'phone': return 'call-outline';
      default: return 'person-outline';
    }
  }

  statusColor(status: string): string {
    switch (status) {
      case 'scheduled': return 'primary';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  }

  private loadSessions(onComplete?: () => void) {
    this.loading.set(true);
    this.api.get<Session[]>('/coaching/sessions').subscribe({
      next: (sessions) => {
        const now = new Date();
        const filtered = sessions.filter((s) => {
          const sessionDate = new Date(s.date);
          return this.segment === 'upcoming'
            ? sessionDate >= now && s.status === 'scheduled'
            : sessionDate < now || s.status !== 'scheduled';
        });
        filtered.sort((a, b) => {
          const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
          return this.segment === 'upcoming' ? diff : -diff;
        });
        this.sessions.set(filtered);
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
