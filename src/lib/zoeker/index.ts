import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpModule } from "@angular/http";
import { GoogleLocatieZoekerConfig } from "./google-locatie-zoeker.config";
import { GoogleLocatieZoekerComponent } from "./google-locatie-zoeker.component";
import { ZoekerComponent } from "./zoeker.component";
import { MatIconModule, MatFormFieldModule, MatInputModule } from "@angular/material";
import { ReactiveFormsModule } from "@angular/forms";
import { ZoekerHighlightPipe } from "./zoeker-highlight.pipe";

const components: any[] = [GoogleLocatieZoekerComponent, ZoekerComponent, ZoekerHighlightPipe];

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
export * from "./zoeker-highlight.pipe";
export * from "./zoeker.component";
export * from "./abstract-zoeker";
