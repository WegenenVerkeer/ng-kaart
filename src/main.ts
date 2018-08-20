// Deze lijn moet eerst komen. Wee diegene die ze verplaatst!
import "./polyfills.ts";

// tslint:disable-next-line:ordered-imports
import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { AppModule } from "./testApp/app.module";
import { environment } from "./testApp/environments/environment";

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule);
