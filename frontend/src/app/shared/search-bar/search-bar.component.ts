import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, FormsModule, TranslateModule],
  template: `
    <mat-form-field appearance="outline" class="search-field">
      <mat-label>{{ placeholder }}</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput [ngModel]="value" (ngModelChange)="onInput($event)" />
      @if (value) {
        <button mat-icon-button matSuffix (click)="clear()">
          <mat-icon>close</mat-icon>
        </button>
      }
    </mat-form-field>
  `,
  styles: [`
    .search-field { width: 100%; }
    ::ng-deep .search-field .mat-mdc-form-field-infix { min-height: 40px; }
  `],
})
export class SearchBarComponent {
  @Input() placeholder = 'Search...';
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  onInput(val: string): void {
    this.value = val;
    this.valueChange.emit(val);
  }

  clear(): void {
    this.value = '';
    this.valueChange.emit('');
  }
}
