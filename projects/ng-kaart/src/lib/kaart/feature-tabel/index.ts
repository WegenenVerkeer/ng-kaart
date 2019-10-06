import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import {
  MatButtonModule,
  MatButtonToggleModule,
  MatCheckboxModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatProgressSpinnerModule,
  MatSliderModule,
  MatSlideToggleModule,
  MatTooltipModule
} from "@angular/material";
import { MatTabsModule } from "@angular/material/tabs";

import { FeatureTabelDataComponent } from "./feature-tabel-data.component";
import { FeatureTabelHeaderComponent } from "./feature-tabel-header.component";
import { FeatureTabelInklapComponent } from "./feature-tabel-inklap.component";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { FeatureTabelPagerComponent } from "./feature-tabel-pager.component";
import { FeatureTabelSorteringStatusComponent } from "./feature-tabel-sortering-status.component";

const components: any[] = [
  FeatureTabelDataComponent,
  FeatureTabelHeaderComponent,
  FeatureTabelInklapComponent,
  FeatureTabelOverzichtComponent,
  FeatureTabelPagerComponent,
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

export * from "./feature-tabel-overzicht.component";
