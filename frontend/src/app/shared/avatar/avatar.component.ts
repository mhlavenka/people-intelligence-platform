import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (profilePicture) {
      <img [src]="profilePicture" [alt]="fullName" class="avatar-img" [style.width.px]="size" [style.height.px]="size" />
    } @else {
      <span class="avatar-initials" [style.width.px]="size" [style.height.px]="size"
            [style.font-size.px]="size * 0.4" [style.background]="bgColor">
        {{ initials }}
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; }
    .avatar-img { border-radius: 50%; object-fit: cover; }
    .avatar-initials {
      border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      font-weight: 700; color: white; text-transform: uppercase; flex-shrink: 0;
    }
  `],
})
export class AvatarComponent {
  @Input() firstName = '';
  @Input() lastName = '';
  @Input() profilePicture = '';
  @Input() size = 36;
  @Input() bgColor = '#3A9FD6';

  get initials(): string {
    return ((this.firstName?.[0] ?? '') + (this.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }
}
