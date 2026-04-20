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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, timeOutline, checkmarkCircleOutline } from 'ionicons/icons';
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

interface CoachPublicInfo {
  coachName: string;
  appointmentDuration: number;
  timezone: string;
  bookingPageTitle?: string;
  bookingPageDesc?: string;
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
                <ion-avatar slot="start">
                  <ion-skeleton-text [animated]="true"></ion-skeleton-text>
                </ion-avatar>
                <ion-label>
                  <ion-skeleton-text [animated]="true" style="width: 60%"></ion-skeleton-text>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        } @else if (coaches().length === 0) {
          <ion-card>
            <ion-card-content>
              <p>No coaches available for booking. Please contact your organization.</p>
            </ion-card-content>
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

      <!-- Step 2: Date Selection -->
      @if (step() === 'date') {
        <ion-card>
          <ion-card-content>
            <ion-icon name="person-outline"></ion-icon>
            <strong>{{ selectedCoach()?.firstName }} {{ selectedCoach()?.lastName }}</strong>
            @if (coachPublicInfo()) {
              <ion-note> &middot; {{ coachPublicInfo()!.appointmentDuration }} min</ion-note>
            }
          </ion-card-content>
        </ion-card>

        <h3>{{ 'BOOKINGS.SELECT_DATE' | translate }}</h3>
        <ion-datetime
          presentation="date"
          [min]="minDate"
          (ionChange)="onDateSelect($event)"
        ></ion-datetime>
      }

      <!-- Step 3: Time Slot -->
      @if (step() === 'slot') {
        <h3>{{ 'BOOKINGS.SELECT_TIME' | translate }}</h3>
        @if (loadingSlots()) {
          <div class="spinner-center">
            <ion-spinner></ion-spinner>
          </div>
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

      <!-- Step 4: Confirmation -->
      @if (step() === 'confirm') {
        <ion-card>
          <ion-card-header>
            <ion-card-title>Confirm Booking</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p><strong>Coach:</strong> {{ selectedCoach()?.firstName }} {{ selectedCoach()?.lastName }}</p>
            <p><strong>Time:</strong> {{ selectedSlot?.label }}</p>
            <p><strong>Duration:</strong> {{ coachPublicInfo()?.appointmentDuration }} min</p>
          </ion-card-content>
        </ion-card>

        <ion-input
          [(ngModel)]="topic"
          label="Topic (optional)"
          labelPlacement="floating"
          fill="outline"
        ></ion-input>

        <ion-button
          expand="block"
          (click)="confirmBooking()"
          [disabled]="submitting()"
        >
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
  styles: [
    `
      h3 {
        margin: 16px 0;
        font-weight: 600;
      }
      ion-input {
        margin: 16px 0;
      }
      ion-button {
        margin-top: 16px;
      }
      .spinner-center {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      ion-card-content ion-icon {
        vertical-align: middle;
        margin-right: 4px;
      }
    `,
  ],
})
export class BookingNewPage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  step = signal<'coach' | 'date' | 'slot' | 'confirm'>('coach');
  coaches = signal<Coach[]>([]);
  loadingCoaches = signal(true);
  selectedCoach = signal<Coach | null>(null);
  coachPublicInfo = signal<CoachPublicInfo | null>(null);
  slots = signal<AvailableSlot[]>([]);
  loadingSlots = signal(false);
  submitting = signal(false);

  selectedSlot: AvailableSlot | null = null;
  topic = '';
  minDate = new Date().toISOString();

  private coachSlug = '';
  private selectedDate = '';

  constructor() {
    addIcons({ personOutline, timeOutline, checkmarkCircleOutline });
  }

  ngOnInit() {
    this.loadCoaches();
  }

  selectCoach(coach: Coach) {
    this.selectedCoach.set(coach);
    this.coachSlug = coach.publicSlug || '';

    if (this.coachSlug) {
      this.api.get<CoachPublicInfo>(`/public/booking/${this.coachSlug}`).subscribe({
        next: (info) => {
          this.coachPublicInfo.set(info);
          this.step.set('date');
        },
        error: () => this.step.set('date'),
      });
    } else {
      this.step.set('date');
    }
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

    this.api
      .post(`/public/booking/${this.coachSlug}`, {
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
    // Get coaches from engagements — the coachee sees their assigned coaches
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

        // If only one coach, auto-select
        if (coachMap.size === 1) {
          this.selectCoach(Array.from(coachMap.values())[0]);
        }
      },
      error: () => this.loadingCoaches.set(false),
    });
  }

  private loadSlots() {
    if (!this.coachSlug || !this.selectedDate) return;

    this.loadingSlots.set(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    this.api
      .get<AvailableSlot[]>(`/public/booking/${this.coachSlug}/slots`, {
        from: this.selectedDate,
        to: this.selectedDate,
        tz,
      })
      .subscribe({
        next: (slots) => {
          this.slots.set(slots);
          this.loadingSlots.set(false);
        },
        error: () => this.loadingSlots.set(false),
      });
  }
}
