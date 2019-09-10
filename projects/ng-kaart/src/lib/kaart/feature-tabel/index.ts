import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatButtonModule, MatIconModule, MatInputModule, MatSliderModule, MatTooltipModule } from "@angular/material";
import { MatTabsModule } from "@angular/material/tabs";

import { FeatureTabelDataComponent } from "./feature-tabel-data.component";
import { FeatureTabelHeaderComponent } from "./feature-tabel-header.component";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { FeatureTabelPagerComponent } from "./feature-tabel-pager.component";

const components: any[] = [
  FeatureTabelDataComponent,
  FeatureTabelHeaderComponent,
  FeatureTabelOverzichtComponent,
  FeatureTabelPagerComponent
];

@NgModule({
  imports: [CommonModule, MatIconModule, MatInputModule, MatButtonModule, MatTabsModule, MatTooltipModule, MatSliderModule],
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
