import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { HttpModule } from "@angular/http";
import {
  MatAutocompleteModule,
  MatButtonModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatProgressSpinnerModule
} from "@angular/material";

import { ZoekerBoxComponent } from "./box/zoeker-box.component";
import { ZOEKER_CFG, ZoekerConfigData } from "./config/zoeker-config";
import { ZoekerCrabGetraptComponent } from "./crab/zoeker-crab-getrapt.component";
import { ZoekerCrabComponent } from "./crab/zoeker-crab.component";
import { ZoekerCrabService } from "./crab/zoeker-crab.service";
import { ZoekerGoogleWdbComponent } from "./google-wdb/zoeker-google-wdb.component";
import { ZoekerGoogleWdbService } from "./google-wdb/zoeker-google-wdb.service";
import { ZoekerPerceelGetraptComponent } from "./perceel/zoeker-perceel-getrapt.component";
import { ZoekerPerceelService } from "./perceel/zoeker-perceel.service";
import { ZoekerHighlightPipe } from "./zoeker-highlight.pipe";
import { DefaultRepresentatieService, ZOEKER_REPRESENTATIE } from "./zoeker-representatie.service";

const components: any[] = [
  ZoekerGoogleWdbComponent,
  ZoekerCrabGetraptComponent,
  ZoekerCrabComponent,
  ZoekerBoxComponent,
  ZoekerHighlightPipe,
  ZoekerPerceelGetraptComponent
];

@NgModule({
  imports: [
    CommonModule,
    HttpModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatMenuModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  declarations: [components],
  exports: [components],
  providers: [ZoekerGoogleWdbService, ZoekerCrabService, ZoekerPerceelService]
})
export class ZoekerModule {
  static forRoot(config: ZoekerConfigData): ModuleWithProviders {
    return {
      ngModule: ZoekerModule,
      providers: [{ provide: ZOEKER_CFG, useValue: config }, { provide: ZOEKER_REPRESENTATIE, useClass: DefaultRepresentatieService }]
    };
  }
}

export * from "./google-wdb/zoeker-google-wdb.service";
export * from "./google-wdb/zoeker-google-wdb.component";
export * from "./config/zoeker-config-google-wdb.config";

export * from "./crab/zoeker-crab-getrapt.component";
export * from "./crab/zoeker-crab.service";
export * from "./crab/zoeker-crab.component";
export * from "./config/zoeker-config-locator-services.config";

export * from "./perceel/zoeker-perceel.service";
export * from "./perceel/zoeker-perceel-getrapt.component";

export * from "./zoeker-highlight.pipe";
export * from "./box/zoeker-box.component";
export * from "./zoeker-base";
export * from "./zoeker-representatie.service";
