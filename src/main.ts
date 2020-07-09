import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { classicLogger } from "projects/ng-kaart/src/lib/classic/log";
import { kaartLogger } from "projects/ng-kaart/src/lib/kaart/log";

import { AppModule } from "./app/app.module";
import { environment } from "./environments/environment";

if (environment.production) {
  enableProdMode();
} else {
  kaartLogger.setLevel("debug");
  classicLogger.setLevel("debug");
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .then(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("ng-kaart/ng-kaart-service-worker.js").catch(err => {
        console.log("Kon ng-kaart-service-worker.js niet registreren", err);
      });
    } else {
      console.log("Geen service worker ondersteuning beschikbaar");
    }
  })
  .catch(err => console.error(err));
