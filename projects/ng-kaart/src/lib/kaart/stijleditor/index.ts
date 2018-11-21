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
  MatTooltipModule
} from "@angular/material";
import { MatTabsModule } from "@angular/material/tabs";

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
    ReactiveFormsModule
  ],
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
