import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { HttpModule } from "@angular/http";
import { MatFormFieldModule, MatIconModule, MatInputModule } from "@angular/material";

import { GoogleLocatieZoekerComponent } from "./google-locatie-zoeker.component";
import { GOOGLE_LOCATIE_ZOEKER_CFG, GoogleLocatieZoekerConfigData } from "./google-locatie-zoeker.config";
import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";
import { ZoekerHighlightPipe } from "./zoeker-highlight.pipe";
import { ZoekerComponent } from "./zoeker.component";

const components: any[] = [GoogleLocatieZoekerComponent, ZoekerComponent, ZoekerHighlightPipe];

@NgModule({
  imports: [CommonModule, HttpModule, ReactiveFormsModule, MatIconModule, MatInputModule, MatFormFieldModule],
  declarations: [components],
  exports: [components],
  providers: [GoogleLocatieZoekerService]
})
export class ZoekerModule {
  static forRoot(config: GoogleLocatieZoekerConfigData): ModuleWithProviders {
    return {
      ngModule: ZoekerModule,
      providers: [{ provide: GOOGLE_LOCATIE_ZOEKER_CFG, useValue: config }]
    };
  }
}

export * from "./google-locatie-zoeker.service";
export * from "./google-locatie-zoeker.component";
export * from "./google-locatie-zoeker.config";
export * from "./zoeker-highlight.pipe";
export * from "./zoeker.component";
export * from "./abstract-zoeker";
