import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  IonRadioGroup,
  IonRadio,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

interface CoachInfo {
  coachName: string;
  coachSlug: string;
  appointmentDuration: number;
  timezone: string;
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
    DatePipe,
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
    IonRadioGroup,
    IonRadio,
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
      @if (step() === 'date') {
        <h3>{{ 'BOOKINGS.SELECT_DATE' | translate }}</h3>
        <ion-datetime
          presentation="date"
          [min]="minDate"
          (ionChange)="onDateSelect($event)"
        ></ion-datetime>
      }

      @if (step() === 'slot') {
        <h3>{{ 'BOOKINGS.SELECT_TIME' | translate }}</h3>
        @if (loadingSlots()) {
          <ion-spinner></ion-spinner>
        } @else if (slots().length === 0) {
          <p>{{ 'BOOKINGS.NO_SLOTS' | translate }}</p>
        } @else {
          <ion-list>
            <ion-radio-group [(ngModel)]="selectedSlot">
              @for (slot of slots(); track slot.startUtc) {
                <ion-item>
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

      @if (step() === 'confirm') {
        <ion-card>
          <ion-card-content>
            <p><strong>{{ coachInfo()?.coachName }}</strong></p>
            <p>{{ selectedSlot?.label }}</p>
            <p>{{ coachInfo()?.appointmentDuration }} min</p>
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
    `,
  ],
})
export class BookingNewPage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  step = signal<'date' | 'slot' | 'confirm'>('date');
  coachInfo = signal<CoachInfo | null>(null);
  slots = signal<AvailableSlot[]>([]);
  loadingSlots = signal(false);
  submitting = signal(false);

  selectedSlot: AvailableSlot | null = null;
  topic = '';
  minDate = new Date().toISOString();

  private coachSlug = '';
  private selectedDate = '';

  ngOnInit() {
    // TODO: In a full implementation, this would come from a coach selection step
    // For now we'll handle the case where the coachee has a single assigned coach
  }

  onDateSelect(event: any) {
    this.selectedDate = event.detail.value;
    this.step.set('slot');
    this.loadSlots();
  }

  confirmBooking() {
    if (!this.selectedSlot || !this.coachInfo()) return;

    this.submitting.set(true);
    const user = this.auth.currentUser();

    this.api
      .post(`/public/booking/${this.coachSlug}`, {
        startTime: this.selectedSlot.startUtc,
        endTime: this.slots()[0]?.endUtc,
        clientName: `${user?.firstName} ${user?.lastName}`,
        clientEmail: user?.email,
        topic: this.topic || undefined,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigate(['/tabs/bookings']);
        },
        error: () => this.submitting.set(false),
      });
  }

  private loadSlots() {
    if (!this.coachSlug || !this.selectedDate) return;

    this.loadingSlots.set(true);
    const from = this.selectedDate;
    const to = this.selectedDate;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    this.api
      .get<AvailableSlot[]>(`/public/booking/${this.coachSlug}/slots`, { from, to, tz })
      .subscribe({
        next: (slots) => {
          this.slots.set(slots);
          this.loadingSlots.set(false);
        },
        error: () => this.loadingSlots.set(false),
      });
  }
}
