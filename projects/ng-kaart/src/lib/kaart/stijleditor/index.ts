import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatOptionModule } from "@angular/material/core";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";

import { LaagstijleditorComponent } from "./laagstijleditor.component";

const components = [LaagstijleditorComponent];

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  exports: [components],
  declarations: [components],
  providers: [],
})
export class StijleditorModule {
  static forRoot(): ModuleWithProviders<StijleditorModule> {
    return {
      ngModule: StijleditorModule,
      providers: [],
    };
  }
}

export * from "./laagstijleditor.component";
export * from "./state";
