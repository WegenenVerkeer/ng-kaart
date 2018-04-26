import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatIconModule, MatInputModule } from "@angular/material";

import { LAGENKIEZER_CFG, LagenkiezerConfig } from "./lagenkiezer-config";
import { LagenkiezerConfigComponent } from "./lagenkiezer-config.component";
import { LagenkiezerComponent } from "./lagenkiezer.component";

const components: any[] = [LagenkiezerComponent, LagenkiezerConfigComponent];

@NgModule({
  imports: [CommonModule, MatIconModule, MatInputModule],
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
export * from "./lagenkiezer-config.component";
export * from "./lagenkiezer-config";
