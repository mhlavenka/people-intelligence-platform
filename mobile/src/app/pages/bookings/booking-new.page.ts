import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Haptics, NotificationType } from '@capacitor/haptics';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonInput,
  IonDatetime,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonRadioGroup,
  IonRadio,
  IonAvatar,
  IonIcon,
  IonSkeletonText,
  IonNote,
  IonChip,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, timeOutline, checkmarkCircleOutline, videocamOutline } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

interface Coach {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  publicSlug?: string;
}

interface EventType {
  _id: string;
  name: string;
  color: string;
  coachSlug: string;
  duration: number;
  title: string;
  description: string;
  googleMeetEnabled: boolean;
}

interface CoachPublicInfo {
  coach: { firstName: string; lastName: string; slug: string };
  eventTypes: EventType[];
}

interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  label: string;
}

@Component({
  selector: 'app-booking-new',
  standalone: true,
  imports: [
    FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonButton, IonInput, IonDatetime, IonSpinner,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonRadioGroup, IonRadio, IonAvatar, IonIcon, IonSkeletonText, IonNote, IonChip,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/bookings"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'BOOKINGS.NEW' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Step 1: Coach Selection -->
      @if (step() === 'coach') {
        <h3>Select your coach</h3>
        @if (loadingCoaches()) {
          <ion-list>
            @for (i of [1, 2]; track i) {
              <ion-item>
                <ion-avatar slot="start"><ion-skeleton-text [animated]="true"></ion-skeleton-text></ion-avatar>
                <ion-label><ion-skeleton-text [animated]="true" style="width: 60%"></ion-skeleton-text></ion-label>
              </ion-item>
            }
          </ion-list>
        } @else if (coaches().length === 0) {
          <ion-card>
            <ion-card-content>No coaches available for booking.</ion-card-content>
          </ion-card>
        } @else {
          <ion-list>
            @for (coach of coaches(); track coach._id) {
              <ion-item button (click)="selectCoach(coach)">
                <ion-avatar slot="start">
                  <ion-icon name="person-outline" style="font-size: 32px; padding: 4px;"></ion-icon>
                </ion-avatar>
                <ion-label>
                  <h2>{{ coach.firstName }} {{ coach.lastName }}</h2>
                  <p>{{ coach.email }}</p>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        }
      }

      <!-- Step 2: Event Type Selection -->
      @if (step() === 'eventType') {
        <h3>What would you like to book?</h3>
        @if (loadingEventTypes()) {
          <ion-spinner></ion-spinner>
        } @else if (eventTypes().length === 0) {
          <ion-card>
            <ion-card-content>This coach has no event types available.</ion-card-content>
          </ion-card>
        } @else {
          <ion-list>
            @for (et of eventTypes(); track et._id) {
              <ion-item button (click)="selectEventType(et)" detail>
                <div class="et-color" [style.background]="et.color" slot="start"></div>
                <ion-label>
                  <h2>{{ et.title || et.name }}</h2>
                  @if (et.description) {
                    <p>{{ et.description }}</p>
                  }
                  <ion-note>
                    <ion-icon name="time-outline"></ion-icon> {{ et.duration }} min
                    @if (et.googleMeetEnabled) {
                      &nbsp;&middot;&nbsp; <ion-icon name="videocam-outline"></ion-icon> Google Meet
                    }
                  </ion-note>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        }
      }

      <!-- Step 3: Date Selection -->
      @if (step() === 'date') {
        <ion-chip>
          {{ selectedCoach()?.firstName }} {{ selectedCoach()?.lastName }}
          &middot; {{ selectedEventType()?.title || selectedEventType()?.name }}
          &middot; {{ selectedEventType()?.duration }} min
        </ion-chip>
        <h3>{{ 'BOOKINGS.SELECT_DATE' | translate }}</h3>
        <ion-datetime
          presentation="date"
          [min]="minDate"
          (ionChange)="onDateSelect($event)"
        ></ion-datetime>
      }

      <!-- Step 4: Time Slot -->
      @if (step() === 'slot') {
        <h3>{{ 'BOOKINGS.SELECT_TIME' | translate }}</h3>
        @if (loadingSlots()) {
          <div class="spinner-center"><ion-spinner></ion-spinner></div>
        } @else if (slots().length === 0) {
          <ion-card>
            <ion-card-content>
              <p>{{ 'BOOKINGS.NO_SLOTS' | translate }}</p>
              <ion-button fill="outline" (click)="step.set('date')">Pick another date</ion-button>
            </ion-card-content>
          </ion-card>
        } @else {
          <ion-list>
            <ion-radio-group [(ngModel)]="selectedSlot">
              @for (slot of slots(); track slot.startUtc) {
                <ion-item>
                  <ion-icon name="time-outline" slot="start" color="medium"></ion-icon>
                  <ion-radio [value]="slot">{{ slot.label }}</ion-radio>
                </ion-item>
              }
            </ion-radio-group>
          </ion-list>
          <ion-button expand="block" [disabled]="!selectedSlot" (click)="step.set('confirm')">
            {{ 'BOOKINGS.CONTINUE' | translate }}
          </ion-button>
        }
      }

      <!-- Step 5: Confirmation -->
      @if (step() === 'confirm') {
        <ion-card>
          <ion-card-header>
            <ion-card-title>Confirm Booking</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p><strong>Coach:</strong> {{ selectedCoach()?.firstName }} {{ selectedCoach()?.lastName }}</p>
            <p><strong>Type:</strong> {{ selectedEventType()?.title || selectedEventType()?.name }}</p>
            <p><strong>Time:</strong> {{ selectedSlot?.label }}</p>
            <p><strong>Duration:</strong> {{ selectedEventType()?.duration }} min</p>
          </ion-card-content>
        </ion-card>

        <ion-input
          [(ngModel)]="topic"
          label="Topic (optional)"
          labelPlacement="floating"
          fill="outline"
        ></ion-input>

        <ion-button expand="block" (click)="confirmBooking()" [disabled]="submitting()">
          @if (submitting()) {
            <ion-spinner name="crescent"></ion-spinner>
          } @else {
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            {{ 'BOOKINGS.CONFIRM' | translate }}
          }
        </ion-button>
      }
    </ion-content>
  `,
  styles: [`
    h3 { margin: 16px 0; font-weight: 600; }
    ion-input { margin: 16px 0; }
    ion-button { margin-top: 16px; }
    .spinner-center { display: flex; justify-content: center; padding: 32px; }
    .et-color { width: 12px; height: 40px; border-radius: 4px; margin-right: 12px; }
    ion-note ion-icon { vertical-align: middle; font-size: 14px; }
    ion-chip { margin: 8px 0 0; }
  `],
})
export class BookingNewPage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  step = signal<'coach' | 'eventType' | 'date' | 'slot' | 'confirm'>('coach');
  coaches = signal<Coach[]>([]);
  loadingCoaches = signal(true);
  selectedCoach = signal<Coach | null>(null);
  eventTypes = signal<EventType[]>([]);
  loadingEventTypes = signal(false);
  selectedEventType = signal<EventType | null>(null);
  slots = signal<AvailableSlot[]>([]);
  loadingSlots = signal(false);
  submitting = signal(false);

  selectedSlot: AvailableSlot | null = null;
  topic = '';
  minDate = new Date().toISOString();

  private selectedDate = '';

  constructor() {
    addIcons({ personOutline, timeOutline, checkmarkCircleOutline, videocamOutline });
  }

  ngOnInit() {
    this.loadCoaches();
  }

  selectCoach(coach: Coach) {
    this.selectedCoach.set(coach);
    if (!coach.publicSlug) {
      this.step.set('date');
      return;
    }
    this.loadingEventTypes.set(true);
    this.step.set('eventType');

    this.api.get<CoachPublicInfo>(`/public/coach/${coach.publicSlug}`).subscribe({
      next: (info) => {
        this.eventTypes.set(info.eventTypes || []);
        this.loadingEventTypes.set(false);
        if (info.eventTypes?.length === 1) {
          this.selectEventType(info.eventTypes[0]);
        }
      },
      error: () => {
        this.loadingEventTypes.set(false);
        this.step.set('date');
      },
    });
  }

  selectEventType(et: EventType) {
    this.selectedEventType.set(et);
    this.step.set('date');
  }

  onDateSelect(event: any) {
    this.selectedDate = event.detail.value?.split('T')[0] || event.detail.value;
    this.step.set('slot');
    this.loadSlots();
  }

  confirmBooking() {
    if (!this.selectedSlot) return;
    this.submitting.set(true);
    const user = this.auth.currentUser();
    const slug = this.selectedEventType()?.coachSlug || this.selectedCoach()?.publicSlug || '';

    this.api
      .post(`/public/booking/${slug}`, {
        startTime: this.selectedSlot.startUtc,
        endTime: this.selectedSlot.endUtc,
        clientName: `${user?.firstName} ${user?.lastName}`,
        clientEmail: user?.email,
        topic: this.topic || undefined,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          Haptics.notification({ type: NotificationType.Success });
          this.router.navigate(['/tabs/bookings']);
        },
        error: () => this.submitting.set(false),
      });
  }

  private loadCoaches() {
    this.loadingCoaches.set(true);
    this.api.get<any[]>('/coaching/engagements').subscribe({
      next: (engagements) => {
        const coachMap = new Map<string, Coach>();
        for (const eng of engagements) {
          if (eng.coachId && eng.status !== 'completed') {
            const coach = eng.coachId;
            if (!coachMap.has(coach._id)) {
              coachMap.set(coach._id, coach);
            }
          }
        }
        this.coaches.set(Array.from(coachMap.values()));
        this.loadingCoaches.set(false);
        if (coachMap.size === 1) {
          this.selectCoach(Array.from(coachMap.values())[0]);
        }
      },
      error: () => this.loadingCoaches.set(false),
    });
  }

  private loadSlots() {
    const slug = this.selectedEventType()?.coachSlug || this.selectedCoach()?.publicSlug || '';
    if (!slug || !this.selectedDate) return;

    this.loadingSlots.set(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    this.api
      .get<AvailableSlot[]>(`/public/booking/${slug}/slots`, {
        from: this.selectedDate,
        to: this.selectedDate,
        tz,
      })
      .subscribe({
        next: (slots) => { this.slots.set(slots); this.loadingSlots.set(false); },
        error: () => this.loadingSlots.set(false),
      });
  }
}
