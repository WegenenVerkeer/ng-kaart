import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSliderModule } from "@angular/material/slider";
import { MatTooltipModule } from "@angular/material/tooltip";

import { TransparantieeditorComponent } from "./transparantieeditor.component";

const components = [TransparantieeditorComponent];

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSliderModule,
    MatTooltipModule,
    ReactiveFormsModule
  ],
  exports: [components],
  declarations: [components],
  providers: []
})
export class TransparantieeditorModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: TransparantieeditorModule,
      providers: []
    };
  }
}

export * from "./state";
export * from "./transparantie";
export * from "./transparantieeditor.component";
