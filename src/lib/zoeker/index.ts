import { CommonModule } from "@angular/common";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { HttpModule } from "@angular/http";
import { MatFormFieldModule, MatIconModule, MatInputModule } from "@angular/material";

import { GoogleLocatieZoekerComponent } from "./google-locatie-zoeker.component";
import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";
import { ZoekerHighlightPipe } from "./zoeker-highlight.pipe";
import { ZoekerComponent } from "./zoeker.component";
import { ZOEKER_CFG, ZoekerConfigData } from "./zoeker.config";
import { CrabZoekerService, CrabZoekerComponent } from ".";

const components: any[] = [GoogleLocatieZoekerComponent, CrabZoekerComponent, ZoekerComponent, ZoekerHighlightPipe];

@NgModule({
  imports: [CommonModule, HttpModule, ReactiveFormsModule, MatIconModule, MatInputModule, MatFormFieldModule],
  declarations: [components],
  exports: [components],
  providers: [GoogleLocatieZoekerService, CrabZoekerService]
})
export class ZoekerModule {
  static forRoot(config: ZoekerConfigData): ModuleWithProviders {
    return {
      ngModule: ZoekerModule,
      providers: [{ provide: ZOEKER_CFG, useValue: config }]
    };
  }
}

export * from "./google-locatie-zoeker.service";
export * from "./google-locatie-zoeker.component";
export * from "./google-locatie-zoeker.config";

export * from "./crab-zoeker.service";
export * from "./crab-zoeker.component";
export * from "./crab-zoeker.config";

export * from "./zoeker-highlight.pipe";
export * from "./zoeker.component";
export * from "./abstract-zoeker";
