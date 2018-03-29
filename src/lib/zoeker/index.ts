import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpModule } from "@angular/http";
import { GoogleLocatieZoekerConfig } from "./google-locatie-zoeker.config";

@NgModule({
  imports: [CommonModule, HttpModule],
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
export * from "./combinatie-zoeker";
export * from "./abstract-zoeker";
