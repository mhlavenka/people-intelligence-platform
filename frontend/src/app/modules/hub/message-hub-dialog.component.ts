import { Component, OnInit, signal, computed, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { TranslateModule } from '@ngx-translate/core';

interface HubUser {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface MessageDoc {
  _id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  partner: HubUser;
  lastMsg: MessageDoc;
  unreadCount: number;
}

interface NotificationDoc {
  _id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

@Component({
  selector: 'app-message-hub-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    AvatarComponent,
    TranslateModule,
  ],
  template: `
    <div class="hub-dialog">

      <!-- Header -->
      <div class="hub-header">
        <h2>{{ "HUB.title" | translate }}</h2>
        <button class="close-btn" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-tab-group [(selectedIndex)]="activeTab" class="hub-tabs">

        <!-- ── Notifications ────────────────────────────────── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>notifications_none</mat-icon>
            <span>{{ 'HUB.notifications' | translate }}</span>
            @if (unreadNotifications() > 0) {
              <span class="tab-badge">{{ unreadNotifications() }}</span>
            }
          </ng-template>

          <div class="tab-content">
            @if (loadingNotifications()) {
              <div class="center-spinner"><mat-spinner diameter="32" /></div>
            } @else {
              @if (notifications().length > 0) {
                <div class="notif-toolbar">
                  <button mat-button (click)="markAllRead()" [disabled]="unreadNotifications() === 0">
                    <mat-icon>done_all</mat-icon> {{ 'HUB.markAllRead' | translate }}
                  </button>
                </div>
              }

              @if (notifications().length === 0) {
                <div class="empty-state">
                  <mat-icon>notifications_none</mat-icon>
                  <p>{{ 'HUB.noNotifications' | translate }}</p>
                </div>
              } @else {
                <div class="notif-list">
                  @for (n of notifications(); track n._id) {
                    <button class="notif-item"
                            [class.unread]="!n.isRead"
                            (click)="openNotif(n)">
                      <div class="notif-icon" [class]="n.type">
                        <mat-icon>{{ notifIcon(n.type) }}</mat-icon>
                      </div>
                      <div class="notif-body">
                        <div class="notif-title">{{ n.title }}</div>
                        <div class="notif-text">{{ n.body }}</div>
                        <div class="notif-time">{{ n.createdAt | date:'MMM d, h:mm a' }}</div>
                      </div>
                      <button class="toggle-read-btn"
                              [matTooltip]="(n.isRead ? 'HUB.markUnread' : 'HUB.markRead') | translate"
                              matTooltipShowDelay="300"
                              (click)="toggleNotifRead(n, $event)">
                        <mat-icon>{{ n.isRead ? 'mark_email_unread' : 'mark_email_read' }}</mat-icon>
                      </button>
                    </button>
                  }
                </div>
              }
            }
          </div>
        </mat-tab>

        <!-- ── Messages ─────────────────────────────────────── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>mail_outline</mat-icon>
            <span>{{ 'HUB.messages' | translate }}</span>
            @if (unreadMessages() > 0) {
              <span class="tab-badge">{{ unreadMessages() }}</span>
            }
          </ng-template>

          <div class="tab-content">
            @if (!activeThread()) {
              <!-- Inbox list -->
              <div class="inbox-toolbar">
                <button mat-stroked-button (click)="startCompose()">
                  <mat-icon>edit</mat-icon> {{ 'HUB.newMessage' | translate }}
                </button>
              </div>

              @if (loadingInbox()) {
                <div class="center-spinner"><mat-spinner diameter="32" /></div>
              } @else if (composing()) {
                <!-- Compose -->
                <div class="compose-panel">
                  <div class="compose-label">{{ 'HUB.to' | translate }}</div>
                  <div class="user-list">
                    @for (u of orgUsers(); track u._id) {
                      <button class="user-chip"
                              [class.selected]="composeTo()?._id === u._id"
                              (click)="composeTo.set(u)">
                        <app-avatar [firstName]="u.firstName" [lastName]="u.lastName" [size]="32" />
                        <div class="user-chip-info">
                          <span>{{ u.firstName }} {{ u.lastName }}</span>
                          <span class="role-label">{{ u.role | titlecase }}</span>
                        </div>
                      </button>
                    }
                  </div>
                  <textarea class="compose-textarea"
                            [(ngModel)]="composeContent"
                            [placeholder]="'HUB.writeMessage' | translate"
                            rows="5"></textarea>
                  <div class="compose-actions">
                    <button mat-stroked-button (click)="composing.set(false)">{{ 'COMMON.cancel' | translate }}</button>
                    <button mat-raised-button color="primary"
                            [disabled]="!composeTo() || !composeContent.trim() || sending()"
                            (click)="sendMessage()">
                      @if (sending()) { <mat-spinner diameter="16" /> }
                      @else { <mat-icon>send</mat-icon> Send }
                    </button>
                  </div>
                </div>
              } @else if (conversations().length === 0) {
                <div class="empty-state">
                  <mat-icon>mail_outline</mat-icon>
                  <p>{{ 'HUB.noConversations' | translate }}</p>
                  <button mat-stroked-button (click)="startCompose()">
                    {{ 'HUB.startConversation' | translate }}
                  </button>
                </div>
              } @else {
                <div class="conversation-list">
                  @for (c of conversations(); track c.partner._id) {
                    <button class="conversation-item"
                            [class.unread]="c.unreadCount > 0"
                            (click)="openThread(c)">
                      <app-avatar [firstName]="c.partner.firstName" [lastName]="c.partner.lastName" [size]="38" />
                      <div class="conv-info">
                        <div class="conv-name">
                          {{ c.partner.firstName }} {{ c.partner.lastName }}
                          @if (c.unreadCount > 0) {
                            <span class="unread-dot">{{ c.unreadCount }}</span>
                          }
                        </div>
                        <div class="conv-preview">{{ c.lastMsg.content | slice:0:60 }}</div>
                      </div>
                      <div class="conv-time">{{ c.lastMsg.createdAt | date:'MMM d' }}</div>
                      <button class="toggle-read-btn"
                              [matTooltip]="(c.unreadCount > 0 ? 'HUB.markRead' : 'HUB.markUnread') | translate"
                              matTooltipShowDelay="300"
                              (click)="toggleConvRead(c, $event)">
                        <mat-icon>{{ c.unreadCount > 0 ? 'mark_email_read' : 'mark_email_unread' }}</mat-icon>
                      </button>
                    </button>
                  }
                </div>
              }

            } @else {
              <!-- Thread view -->
              <div class="thread-header">
                <button class="back-btn" (click)="activeThread.set(null)">
                  <mat-icon>arrow_back</mat-icon>
                </button>
                <app-avatar [firstName]="activeThread()!.partner.firstName" [lastName]="activeThread()!.partner.lastName" [size]="40" />
                <div class="thread-name">
                  {{ activeThread()!.partner.firstName }} {{ activeThread()!.partner.lastName }}
                </div>
                <button mat-stroked-button class="reply-new-btn"
                        (click)="startCompose()">
                  <mat-icon>edit</mat-icon>
                </button>
              </div>

              <div class="thread-messages">
                @if (loadingThread()) {
                  <div class="center-spinner"><mat-spinner diameter="32" /></div>
                } @else {
                  @for (m of thread(); track m._id) {
                    <div class="message-bubble" [class.mine]="m.fromUserId === myId()">
                      <div class="bubble-text">{{ m.content }}</div>
                      <div class="bubble-time">{{ m.createdAt | date:'MMM d, h:mm a' }}</div>
                    </div>
                  }
                }
              </div>

              <div class="thread-reply">
                <textarea [(ngModel)]="replyContent"
                          [placeholder]="'HUB.reply' | translate"
                          rows="3"
                          class="reply-textarea"
                          (keydown.ctrl.enter)="sendReply()"></textarea>
                <button mat-raised-button color="primary"
                        [disabled]="!replyContent.trim() || sending()"
                        (click)="sendReply()">
                  @if (sending()) { <mat-spinner diameter="16" /> }
                  @else { <mat-icon>send</mat-icon> }
                </button>
              </div>
            }
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .hub-dialog {
      width: 100%;
      display: flex;
      flex-direction: column;
      background: #fff;
      overflow: hidden;
    }

    .hub-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #eef2f7;
      flex-shrink: 0;
      h2 { margin: 0; font-size: 17px; font-weight: 700; color: var(--artes-primary); }
    }

    .close-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 50%;
      background: none; border: none; cursor: pointer; color: #9aa5b4;
      &:hover { background: #f0f4f8; color: var(--artes-primary); }
    }

    .hub-tabs {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* Make the tab body fill available height */
    ::ng-deep .hub-tabs {
      .mat-mdc-tab-body-wrapper { flex: 1; overflow: hidden; min-height: 0; }
      .mat-mdc-tab-body        { height: 100%; }
      .mat-mdc-tab-body-content { height: 100%; overflow: hidden; display: flex; flex-direction: column; }
    }

    /* Tab label with badge */
    ::ng-deep .hub-tabs .mat-mdc-tab .mdc-tab__content {
      display: flex; align-items: center; gap: 6px;
    }

    .tab-badge {
      background: #e53e3e; color: #fff;
      font-size: 10px; font-weight: 700; min-width: 18px; height: 18px;
      border-radius: 9px; display: flex; align-items: center;
      justify-content: center; padding: 0 4px;
    }

    .tab-content {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* Inbox */
    .inbox-toolbar {
      padding: 12px 16px;
      border-bottom: 1px solid #eef2f7;
      flex-shrink: 0;
    }

    .conversation-list { display: flex; flex-direction: column; }

    .conversation-item {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; border: none; background: none; cursor: pointer;
      text-align: left; width: 100%;
      border-bottom: 1px solid #f0f4f8;
      transition: background 0.12s;
      &:hover { background: #f8fbff; }
      &.unread { background: beige; }
    }


    .conv-info { flex: 1; overflow: hidden; }
    .conv-name {
      display: flex; align-items: center; gap: 6px;
      font-size: 14px; font-weight: 600; color: var(--artes-primary);
    }
    .conv-preview { font-size: 12px; color: #9aa5b4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .conv-time { font-size: 11px; color: #9aa5b4; flex-shrink: 0; }
    .unread-dot {
      background: var(--artes-accent); color: white; font-size: 10px; font-weight: 700;
      min-width: 18px; height: 18px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center; padding: 0 4px;
    }

    /* Thread */
    .thread-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-bottom: 1px solid #eef2f7; flex-shrink: 0;
    }
    .back-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 50%;
      background: none; border: none; cursor: pointer; color: #5a6a7e;
      &:hover { background: #f0f4f8; }
    }
    .thread-name { flex: 1; font-size: 14px; font-weight: 600; color: var(--artes-primary); }
    .reply-new-btn { min-width: unset; padding: 0 8px; }

    .thread-messages {
      flex: 1; overflow-y: auto;
      padding: 16px; display: flex; flex-direction: column; gap: 10px;
    }

    .message-bubble {
      max-width: 75%; display: flex; flex-direction: column; gap: 3px;
      align-self: flex-start;
      .bubble-text {
        background: #f0f4f8; border-radius: 0 10px 10px 10px;
        padding: 10px 14px; font-size: 13px; color: var(--artes-primary); line-height: 1.5;
      }
      .bubble-time { font-size: 10px; color: #9aa5b4; padding-left: 4px; }
      &.mine {
        align-self: flex-end;
        .bubble-text {
          background: var(--artes-accent); color: white;
          border-radius: 10px 0 10px 10px;
        }
        .bubble-time { text-align: right; padding-right: 4px; }
      }
    }

    .thread-reply {
      display: flex; gap: 8px; align-items: flex-end;
      padding: 12px 16px; border-top: 1px solid #eef2f7; flex-shrink: 0;
    }
    .reply-textarea {
      flex: 1; resize: none; border: 1px solid #dce6f0; border-radius: 8px;
      padding: 10px 12px; font-size: 13px; color: var(--artes-primary);
      outline: none; font-family: inherit; line-height: 1.4;
      &:focus { border-color: var(--artes-accent); }
    }

    /* Compose */
    .compose-panel {
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }
    .compose-label { font-size: 12px; font-weight: 600; color: #5a6a7e; text-transform: uppercase; letter-spacing: 0.5px; }
    .user-list { display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; }
    .user-chip {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; border-radius: 8px; border: 1.5px solid #dce6f0;
      background: white; cursor: pointer; text-align: left;
      transition: all 0.12s;
      &:hover { border-color: var(--artes-accent); }
      &.selected { border-color: var(--artes-accent); background: #e8f4fd; }
    }
    .user-chip-info { display: flex; flex-direction: column; font-size: 13px; color: var(--artes-primary); }
    .role-label { font-size: 11px; color: #9aa5b4; text-transform: capitalize; }
    .compose-textarea {
      resize: none; border: 1px solid #dce6f0; border-radius: 8px;
      padding: 10px 12px; font-size: 13px; color: var(--artes-primary);
      outline: none; font-family: inherit; line-height: 1.4;
      &:focus { border-color: var(--artes-accent); }
    }
    .compose-actions { display: flex; gap: 8px; justify-content: flex-end; }

    /* Notifications */
    .notif-toolbar {
      padding: 8px 16px; border-bottom: 1px solid #eef2f7; flex-shrink: 0;
    }
    .notif-list { display: flex; flex-direction: column; }
    .notif-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px; border: none; background: none; cursor: pointer;
      text-align: left; width: 100%;
      border-bottom: 1px solid #f0f4f8; transition: background 0.12s;
      &:hover { background: #f8fbff; }
      &.unread { background: beige; }
    }
    .notif-icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.idp_generated  { background: rgba(58,159,214,0.12); color: #2080b0; }
      &.survey_response { background: rgba(39,196,160,0.12); color: #1a9678; }
      &.conflict_alert { background: rgba(232,108,58,0.12);  color: #b84a0e; }
      &.message        { background: rgba(27,42,71,0.08);    color: var(--artes-primary); }
      &.system         { background: rgba(154,165,180,0.12); color: #5a6a7e; }
    }
    .notif-body { flex: 1; }
    .notif-title { font-size: 13px; font-weight: 600; color: var(--artes-primary); margin-bottom: 2px; }
    .notif-text  { font-size: 12px; color: #5a6a7e; line-height: 1.4; margin-bottom: 4px; }
    .notif-time  { font-size: 11px; color: #9aa5b4; }
    .toggle-read-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: none; border: none; cursor: pointer; color: #bfc8d4;
      transition: background 0.12s, color 0.12s;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
      &:hover { background: #eef2f7; color: var(--artes-accent); }
    }

    /* Shared */
    .center-spinner { display: flex; justify-content: center; padding: 48px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 48px 24px; color: #9aa5b4; gap: 10px;
      > mat-icon { font-size: 36px; width: 36px; height: 36px; }
      p { margin: 0; font-size: 14px; }
    }
  `],
})
export class MessageHubDialogComponent implements OnInit {
  activeTab = 0;

  conversations     = signal<Conversation[]>([]);
  notifications     = signal<NotificationDoc[]>([]);
  orgUsers          = signal<HubUser[]>([]);
  thread            = signal<MessageDoc[]>([]);
  activeThread      = signal<Conversation | null>(null);

  loadingInbox         = signal(true);
  loadingThread        = signal(false);
  loadingNotifications = signal(true);

  composing     = signal(false);
  composeTo     = signal<HubUser | null>(null);
  composeContent = '';
  replyContent   = '';
  sending        = signal(false);

  myId = signal('');

  unreadMessages      = computed(() => this.conversations().reduce((s, c) => s + c.unreadCount, 0));
  unreadNotifications = computed(() => this.notifications().filter((n) => !n.isRead).length);
  unreadOnOpen = 0;

  constructor(
    public dialogRef: MatDialogRef<MessageHubDialogComponent>,
    private api: ApiService,
    private router: Router,
    @Optional() @Inject(MAT_DIALOG_DATA) private data?: { onReadChange?: () => void },
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.api.get<{ total: number }>('/hub/unread-count').subscribe({
      next: (c) => { this.unreadOnOpen = c.total; },
      error: () => {},
    });

    const inbox$ = this.api.get<Conversation[]>('/hub/messages');
    const notif$ = this.api.get<NotificationDoc[]>('/hub/notifications');

    forkJoin([inbox$, notif$]).subscribe({
      next: ([msgs, notifs]) => {
        this.conversations.set(msgs);
        this.loadingInbox.set(false);
        this.notifications.set(notifs);
        this.loadingNotifications.set(false);

        const hasUnreadNotifs = notifs.some((n) => !n.isRead);
        const hasUnreadMsgs = msgs.some((c) => c.unreadCount > 0);
        // Tab 0 = Notifications, Tab 1 = Messages
        if (!hasUnreadNotifs && hasUnreadMsgs) {
          this.activeTab = 1;
        }
      },
      error: () => {
        this.loadingInbox.set(false);
        this.loadingNotifications.set(false);
      },
    });

    // org users for compose
    this.api.get<HubUser[]>('/hub/users').subscribe({
      next: (list) => this.orgUsers.set(list),
      error: () => {},
    });

    // current user id (from token via /users/me)
    this.api.get<{ _id: string }>('/users/me').subscribe({
      next: (u) => this.myId.set(u._id),
      error: () => {},
    });
  }

  startCompose(): void {
    this.composeTo.set(null);
    this.composeContent = '';
    this.composing.set(true);
    this.activeThread.set(null);
  }

  openThread(c: Conversation): void {
    this.activeThread.set(c);
    this.replyContent = '';
    this.loadingThread.set(true);
    this.api.get<MessageDoc[]>(`/hub/messages/${c.partner._id}`).subscribe({
      next: (msgs) => {
        this.thread.set(msgs);
        this.loadingThread.set(false);
        // refresh unread counts
        this.conversations.update((list) =>
          list.map((conv) =>
            conv.partner._id === c.partner._id ? { ...conv, unreadCount: 0 } : conv
          )
        );
      },
      error: () => this.loadingThread.set(false),
    });
  }

  sendMessage(): void {
    if (!this.composeTo() || !this.composeContent.trim()) return;
    this.sending.set(true);
    this.api.post('/hub/messages', {
      toUserId: this.composeTo()!._id,
      content:  this.composeContent.trim(),
    }).subscribe({
      next: () => {
        this.sending.set(false);
        this.composing.set(false);
        this.composeContent = '';
        this.api.get<Conversation[]>('/hub/messages').subscribe({
          next: (list) => this.conversations.set(list),
        });
      },
      error: () => this.sending.set(false),
    });
  }

  sendReply(): void {
    if (!this.replyContent.trim() || !this.activeThread()) return;
    this.sending.set(true);
    this.api.post('/hub/messages', {
      toUserId: this.activeThread()!.partner._id,
      content:  this.replyContent.trim(),
    }).subscribe({
      next: (msg) => {
        this.thread.update((t) => [...t, msg as MessageDoc]);
        this.replyContent = '';
        this.sending.set(false);
      },
      error: () => this.sending.set(false),
    });
  }

  private notifyReadChange(): void {
    this.data?.onReadChange?.();
  }

  markAllRead(): void {
    this.api.put('/hub/notifications/read-all', {}).subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
        this.notifyReadChange();
      },
    });
  }

  openNotif(n: NotificationDoc): void {
    if (!n.isRead) {
      this.api.put(`/hub/notifications/${n._id}/read`, {}).subscribe();
      this.notifications.update((list) =>
        list.map((x) => (x._id === n._id ? { ...x, isRead: true } : x))
      );
      this.notifyReadChange();
    }
    if (n.link) {
      this.dialogRef.close();
      this.navigateToHubLink(n.link);
    }
  }

  /** Hub links may be stored as absolute URLs (legacy) or relative app paths.
   *  Angular Router can only navigate to in-app paths, so split off the path
   *  + query and use navigateByUrl which handles them in one shot. */
  private navigateToHubLink(link: string): void {
    let target = link;
    if (/^https?:\/\//i.test(link)) {
      try {
        const u = new URL(link);
        target = `${u.pathname}${u.search}${u.hash}`;
      } catch {
        window.location.href = link;
        return;
      }
    }
    this.router.navigateByUrl(target);
  }

  toggleNotifRead(n: NotificationDoc, event: Event): void {
    event.stopPropagation();
    const newRead = !n.isRead;
    this.api.put(`/hub/notifications/${n._id}/read`, { isRead: newRead }).subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((x) => (x._id === n._id ? { ...x, isRead: newRead } : x))
        );
        this.notifyReadChange();
      },
    });
  }

  toggleConvRead(c: Conversation, event: Event): void {
    event.stopPropagation();
    const markRead = c.unreadCount > 0;
    this.api.put(`/hub/messages/${c.partner._id}/read`, { isRead: markRead }).subscribe({
      next: () => {
        this.conversations.update((list) =>
          list.map((conv) =>
            conv.partner._id === c.partner._id
              ? { ...conv, unreadCount: markRead ? 0 : 1 }
              : conv
          )
        );
        this.notifyReadChange();
      },
    });
  }

  notifIcon(type: string): string {
    const icons: Record<string, string> = {
      idp_generated:   'psychology',
      survey_response: 'assignment_turned_in',
      conflict_alert:  'warning_amber',
      message:         'mail',
      system:          'info',
    };
    return icons[type] ?? 'notifications';
  }
}
