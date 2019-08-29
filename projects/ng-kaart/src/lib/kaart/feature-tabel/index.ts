import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatButtonModule, MatIconModule, MatInputModule, MatTooltipModule } from "@angular/material";
import { MatTabsModule } from "@angular/material/tabs";

import { FeatureTabelDataComponent } from "./feature-tabel-data.component";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";

const components: any[] = [FeatureTabelOverzichtComponent, FeatureTabelDataComponent];

@NgModule({
  imports: [CommonModule, MatIconModule, MatInputModule, MatButtonModule, MatTabsModule, MatTooltipModule],
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
