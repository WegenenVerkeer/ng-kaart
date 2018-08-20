import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule } from "@angular/material";

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
    MatFormFieldModule
  ],
  declarations: [components],
  exports: [components],
  providers: []
})
export class AbbameldaModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: AbbameldaModule,
      providers: []
    };
  }
}

export * from "./abbamelda-stuurmelding.component";
