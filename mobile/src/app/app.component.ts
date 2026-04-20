import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { PushService } from './core/push.service';
import { ConnectivityService } from './core/connectivity.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent implements OnInit {
  private translate = inject(TranslateService);
  private push = inject(PushService);
  private connectivity = inject(ConnectivityService);

  ngOnInit() {
    this.translate.addLangs(['en', 'fr', 'es']);
    this.translate.setDefaultLang('en');
    this.connectivity.init();
  }
}
