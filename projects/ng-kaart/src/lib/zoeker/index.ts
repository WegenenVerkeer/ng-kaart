import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import {
  MatAutocompleteModule,
  MatButtonModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatProgressSpinnerModule,
  MatSelectModule,
  MatTooltipModule
} from "@angular/material";

import { ZoekerAlleLagenGetraptComponent } from "./alle-lagen/zoeker-alle-lagen-getrapt.component";
import { ZoekerBoxComponent } from "./box/zoeker-box.component";
import { ZOEKER_CFG, ZoekerConfigData } from "./config/zoeker-config";
import { ZoekerCrabGetraptComponent } from "./crab/zoeker-crab-getrapt.component";
import { ZoekerCrabService } from "./crab/zoeker-crab.service";
import { ZoekerGoogleWdbService } from "./google-wdb/zoeker-google-wdb.service";
import { ZoekerHelpComponent } from "./help/zoeker-help.component";
import { ZoekerPerceelGetraptComponent } from "./perceel/zoeker-perceel-getrapt.component";
import { ZoekerPerceelService } from "./perceel/zoeker-perceel.service";
import { ZoekerHighlightPipe } from "./zoeker-highlight.pipe";
import { DefaultRepresentatieService, ZOEKER_REPRESENTATIE } from "./zoeker-representatie.service";

const components: any[] = [
  ZoekerBoxComponent,
  ZoekerCrabGetraptComponent,
  ZoekerAlleLagenGetraptComponent,
  ZoekerHelpComponent,
  ZoekerHighlightPipe,
  ZoekerPerceelGetraptComponent
];

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatMenuModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule
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
export * from "./config/zoeker-config-google-wdb.config";

export * from "./crab/zoeker-crab-getrapt.component";
export * from "./crab/zoeker-crab.service";
export * from "./config/zoeker-config-locator-services.config";

export * from "./perceel/zoeker-perceel.service";
export * from "./perceel/zoeker-perceel-getrapt.component";

export * from "./alle-lagen/zoeker-alle-lagen.service";

export * from "./zoeker-highlight.pipe";
export * from "./box/zoeker-box.component";
export * from "./zoeker";
export * from "./zoeker-representatie.service";
