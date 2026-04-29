import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dialog-close-btn',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <button class="close-btn" type="button" (click)="closed.emit()" aria-label="Close">
      <mat-icon>close</mat-icon>
    </button>
  `,
  styles: [`
    .close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: none;
      border: none;
      cursor: pointer;
      color: #9aa5b4;
      padding: 0;
      transition: background 0.12s, color 0.12s;
    }
    .close-btn:hover {
      background: #f0f4f8;
      color: var(--artes-primary);
    }
    .close-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
    }
  `],
})
export class DialogCloseButtonComponent {
  @Output() closed = new EventEmitter<void>();
}
