import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatRadioModule } from "@angular/material/radio";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatSliderModule } from "@angular/material/slider";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";

import { FeatureTabelDataComponent } from "./feature-tabel-data.component";
import { FeatureTabelHeaderComponent } from "./feature-tabel-header.component";
import { FeatureTabelInklapComponent } from "./feature-tabel-inklap.component";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { FeatureTabelPagerComponent } from "./feature-tabel-pager.component";
import { FeatureTabelSettingsComponent } from "./feature-tabel-settings.component";
import { FeatureTabelSorteringStatusComponent } from "./feature-tabel-sortering-status.component";
import { FeatureTabelSelectieViaPolygonComponent } from "./selecteer-features/feature-tabel-polygon-selectie.component";

const components: any[] = [
  FeatureTabelDataComponent,
  FeatureTabelHeaderComponent,
  FeatureTabelInklapComponent,
  FeatureTabelOverzichtComponent,
  FeatureTabelPagerComponent,
  FeatureTabelSorteringStatusComponent,
  FeatureTabelSelectieViaPolygonComponent,
  FeatureTabelSettingsComponent,
  FeatureTabelSorteringStatusComponent
];

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTooltipModule
  ],
  declarations: [components],
  exports: [components]
})
export class FeatureTabelModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: FeatureTabelModule,
      providers: []
    };
  }
}

export * from "./feature-tabel-inklap.component";
export * from "./feature-tabel-overzicht.component";
