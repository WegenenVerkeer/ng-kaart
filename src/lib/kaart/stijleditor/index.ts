import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatButtonModule, MatIconModule, MatInputModule, MatTooltipModule } from "@angular/material";
import { MatTabsModule } from "@angular/material/tabs";

import { LaagstijleditorComponent } from "./laagstijleditor.component";

const components = [LaagstijleditorComponent];

@NgModule({
  imports: [CommonModule, MatIconModule, MatInputModule, MatButtonModule, MatTabsModule, MatTooltipModule],
  exports: [components],
  declarations: [components],
  providers: []
})
export class StijleditorModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: StijleditorModule,
      providers: []
    };
  }
}

export * from "./laagstijleditor.component";
export * from "./state";
