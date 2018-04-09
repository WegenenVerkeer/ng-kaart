import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpModule } from "@angular/http";
import { GoogleLocatieZoekerConfig } from "./google-locatie-zoeker.config";
import { GoogleLocatieZoekerComponent } from "./google-locatie-zoeker.component";
import { ZoekerInputComponent } from "./zoeker-input.component";
import { ZoekerResultaatComponent } from "./zoeker-resultaat.component";
import { MatIconModule, MatFormFieldModule, MatInputModule } from "@angular/material";
import { ReactiveFormsModule } from "@angular/forms";

const components: any[] = [GoogleLocatieZoekerComponent, ZoekerInputComponent, ZoekerResultaatComponent];

@NgModule({
  imports: [CommonModule, HttpModule, ReactiveFormsModule, MatIconModule, MatInputModule, MatFormFieldModule],
  declarations: [components],
  exports: [components],
  providers: [GoogleLocatieZoekerService]
})
export class ZoekerModule {
  static forRoot(config: GoogleLocatieZoekerConfig): ModuleWithProviders {
    return {
      ngModule: ZoekerModule,
      providers: [{ provide: GoogleLocatieZoekerConfig, useValue: config }]
    };
  }
}

export * from "./google-locatie-zoeker.service";
export * from "./google-locatie-zoeker.component";
export * from "./zoeker-input.component";
export * from "./zoeker-resultaat.component";
export * from "./abstract-zoeker";
