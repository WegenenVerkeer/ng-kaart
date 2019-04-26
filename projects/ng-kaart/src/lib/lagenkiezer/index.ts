import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatButtonModule, MatIconModule, MatInputModule, MatMenuModule, MatTooltipModule } from "@angular/material";
import { MatTabsModule } from "@angular/material/tabs";

import { FilterDetailComponent } from "./filter-detail.component";
import { FilterExpressionComponent } from "./filter-expression.component";

import { LaagmanipulatieComponent } from "./laagmanipulatie.component";
import { LAGENKIEZER_CFG, LagenkiezerConfig } from "./lagenkiezer-config";
import { LagenkiezerComponent } from "./lagenkiezer.component";

const components: any[] = [LagenkiezerComponent, LaagmanipulatieComponent, FilterDetailComponent, FilterExpressionComponent];

@NgModule({
  imports: [CommonModule, MatIconModule, MatInputModule, MatButtonModule, MatMenuModule, MatTabsModule, MatTooltipModule],
  declarations: [components],
  exports: [components]
})
export class LagenkiezerModule {
  static withDefaults(): ModuleWithProviders {
    return LagenkiezerModule.forRoot({});
  }
  static forRoot(config: LagenkiezerConfig): ModuleWithProviders {
    return {
      ngModule: LagenkiezerModule,
      providers: [{ provide: LAGENKIEZER_CFG, useValue: config }]
    };
  }
}

export * from "./lagenkiezer.component";
export * from "./lagenkiezer-config";
export * from "./laagmanipulatie.component";
export * from "./filter-detail.component";
