import { Component } from "@angular/core";
import { ViewEncapsulation } from "@angular/core";
import { Routes } from "@angular/router";

import { FeatureDemoComponent } from "./feature-demo.component";
import { ProtractorComponent } from "./protractor.component";

@Component({
  selector: "awv-ng-kaart-test-app",
  template: "<router-outlet></router-outlet>",
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {}

export const routes: Routes = [
  { path: "", component: FeatureDemoComponent },
  { path: "test", component: ProtractorComponent }, // Zorg er voor dat de Protractor tests een eenvoudiger pagina zien
];
