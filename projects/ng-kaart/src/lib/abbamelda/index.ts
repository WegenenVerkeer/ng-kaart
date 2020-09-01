import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";

import { AbbameldaStuurmeldingComponent } from "./abbamelda-stuurmelding.component";

const components: any[] = [AbbameldaStuurmeldingComponent];

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
export class AbbameldaModule {
  static forRoot(): ModuleWithProviders<AbbameldaModule> {
    return {
      ngModule: AbbameldaModule,
      providers: [],
    };
  }
}

export * from "./abbamelda-stuurmelding.component";
