import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";

import { FilterModule } from "../filter/index";
import { TransparantieeditorModule } from "../transparantieeditor/index";

import { LaagmanipulatieComponent } from "./laagmanipulatie.component";
import { LAGENKIEZER_CFG, LagenkiezerConfig } from "./lagenkiezer-config";
import { LagenkiezerComponent } from "./lagenkiezer.component";

const components: any[] = [LagenkiezerComponent, LaagmanipulatieComponent];

@NgModule({
  imports: [
    CommonModule,
    FilterModule,
    TransparantieeditorModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatMenuModule,
    MatTabsModule,
    MatTooltipModule
  ],
  declarations: [components],
  exports: [components]
})
export class LagenkiezerModule {
  static withDefaults(): ModuleWithProviders<LagenkiezerModule> {
    return LagenkiezerModule.forRoot({});
  }
  static forRoot(config: LagenkiezerConfig): ModuleWithProviders<LagenkiezerModule> {
    return {
      ngModule: LagenkiezerModule,
      providers: [{ provide: LAGENKIEZER_CFG, useValue: config }]
    };
  }
}

export * from "./lagenkiezer.component";
export * from "./lagenkiezer-config";
export * from "./laagmanipulatie.component";
