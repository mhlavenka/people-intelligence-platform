import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonAccordionGroup,
  IonAccordion,
  IonChip,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  status: 'not_started' | 'in_progress' | 'completed';
  phase: 'goal' | 'reality' | 'options' | 'will';
}

interface IDP {
  _id: string;
  goals: string[];
  milestones: Milestone[];
  createdAt: string;
  narrative?: string;
}

@Component({
  selector: 'app-idp-view',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,
    IonBadge,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonAccordionGroup,
    IonAccordion,
    IonChip,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ 'IDP.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading()) {
        <div class="ion-padding">
          <ion-skeleton-text [animated]="true" style="width: 80%; height: 24px"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true" style="width: 100%; height: 120px; margin-top: 16px"></ion-skeleton-text>
        </div>
      } @else if (!idp()) {
        <div class="empty-state">
          <p>{{ 'IDP.EMPTY' | translate }}</p>
        </div>
      } @else {
        <div class="ion-padding">
          @if (idp()!.goals.length) {
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ 'IDP.GOALS' | translate }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-list>
                  @for (goal of idp()!.goals; track goal) {
                    <ion-item>
                      <ion-label class="ion-text-wrap">{{ goal }}</ion-label>
                    </ion-item>
                  }
                </ion-list>
              </ion-card-content>
            </ion-card>
          }

          <ion-accordion-group [multiple]="true" [value]="['goal', 'reality', 'options', 'will']">
            @for (phase of phases; track phase) {
              <ion-accordion [value]="phase">
                <ion-item slot="header" color="light">
                  <ion-label>{{ phase | titlecase }}</ion-label>
                  <ion-badge slot="end">
                    {{ phaseProgress(phase) }}
                  </ion-badge>
                </ion-item>
                <div slot="content" class="ion-padding">
                  <ion-list>
                    @for (milestone of getMilestones(phase); track milestone.id) {
                      <ion-item>
                        <ion-checkbox
                          slot="start"
                          [checked]="milestone.status === 'completed'"
                          (ionChange)="toggleMilestone(milestone)"
                        ></ion-checkbox>
                        <ion-label [class.completed]="milestone.status === 'completed'">
                          <h3>{{ milestone.title }}</h3>
                          <p>{{ milestone.description }}</p>
                          @if (milestone.targetDate) {
                            <p class="target-date">Due: {{ milestone.targetDate | date: 'mediumDate' }}</p>
                          }
                        </ion-label>
                      </ion-item>
                    }
                  </ion-list>
                </div>
              </ion-accordion>
            }
          </ion-accordion-group>
        </div>
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
      .completed h3 {
        text-decoration: line-through;
        color: var(--ion-color-medium);
      }
      .target-date {
        font-size: 12px;
        color: var(--ion-color-medium);
      }
    `,
  ],
})
export class IdpViewPage implements OnInit {
  private api = inject(ApiService);

  idp = signal<IDP | null>(null);
  loading = signal(true);

  phases: ('goal' | 'reality' | 'options' | 'will')[] = ['goal', 'reality', 'options', 'will'];

  ngOnInit() {
    this.loadIdp();
  }

  refresh(event: any) {
    this.loadIdp(() => event.target.complete());
  }

  getMilestones(phase: string): Milestone[] {
    return this.idp()?.milestones.filter((m) => m.phase === phase) || [];
  }

  phaseProgress(phase: string): string {
    const milestones = this.getMilestones(phase);
    const completed = milestones.filter((m) => m.status === 'completed').length;
    return `${completed}/${milestones.length}`;
  }

  toggleMilestone(milestone: Milestone) {
    const newStatus = milestone.status === 'completed' ? 'in_progress' : 'completed';
    milestone.status = newStatus;

    this.api
      .patch(`/succession/idp/milestones/${milestone.id}`, { status: newStatus })
      .subscribe();
  }

  private loadIdp(onComplete?: () => void) {
    this.loading.set(true);
    this.api.get<IDP>('/succession/idp/me').subscribe({
      next: (idp) => {
        this.idp.set(idp);
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
