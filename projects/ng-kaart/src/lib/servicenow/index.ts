import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";

import { ServicenowMaakCaseComponent } from "./servicenow-maak-case.component";

const components: any[] = [ServicenowMaakCaseComponent];

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  declarations: [components],
  exports: [components],
  providers: [],
})
export class ServiceNowModule {
  static forRoot(): ModuleWithProviders<ServiceNowModule> {
    return {
      ngModule: ServiceNowModule,
      providers: [],
    };
  }
}

export * from "./servicenow-maak-case.component";
