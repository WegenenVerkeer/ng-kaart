import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import {
  MatButtonModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatOptionModule,
  MatSelectModule,
  MatSliderModule,
  MatTooltipModule
} from "@angular/material";
import { MatTabsModule } from "@angular/material/tabs";

import { TransparantieeditorComponent } from "./transparantieeditor.component";

const components = [TransparantieeditorComponent];

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    MatSliderModule,
    MatTabsModule,
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

export * from "./transparantieeditor.component";
export * from "./state";
