import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="placeholder-page">
      <mat-icon>{{ icon() }}</mat-icon>
      <h2>{{ title() }}</h2>
      <p>This page is coming soon.</p>
    </div>
  `,
  styles: [`
    .placeholder-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      color: #9aa5b4;
      gap: 12px;

      mat-icon { font-size: 64px; width: 64px; height: 64px; }
      h2 { font-size: 22px; color: #1B2A47; margin: 0; }
      p  { font-size: 14px; margin: 0; }
    }
  `],
})
export class PlaceholderComponent implements OnInit {
  title = signal('Coming Soon');
  icon = signal('construction');

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    if (data['title']) this.title.set(data['title']);
    if (data['icon']) this.icon.set(data['icon']);
  }
}
