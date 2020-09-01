import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltipModule } from "@angular/material/tooltip";

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
import {
  DefaultRepresentatieService,
  ZOEKER_REPRESENTATIE,
} from "./zoeker-representatie.service";

const components: any[] = [
  ZoekerBoxComponent,
  ZoekerCrabGetraptComponent,
  ZoekerAlleLagenGetraptComponent,
  ZoekerHelpComponent,
  ZoekerHighlightPipe,
  ZoekerPerceelGetraptComponent,
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
    MatTooltipModule,
  ],
  declarations: [components],
  exports: [components],
  providers: [ZoekerGoogleWdbService, ZoekerCrabService, ZoekerPerceelService],
})
export class ZoekerModule {
  static forRoot(config: ZoekerConfigData): ModuleWithProviders<ZoekerModule> {
    return {
      ngModule: ZoekerModule,
      providers: [
        { provide: ZOEKER_CFG, useValue: config },
        {
          provide: ZOEKER_REPRESENTATIE,
          useClass: DefaultRepresentatieService,
        },
      ],
    };
  }
}

export * from "./alle-lagen/zoeker-alle-lagen-getrapt.component";
export * from "./alle-lagen/zoeker-alle-lagen-getrapt.component";
export * from "./alle-lagen/zoeker-alle-lagen.service";
export * from "./box/zoeker-box.component";
export * from "./config/zoeker-config-google-wdb.config";
export * from "./config/zoeker-config-locator-services.config";
export * from "./crab/zoeker-crab-getrapt.component";
export * from "./crab/zoeker-crab.service";
export * from "./google-wdb/zoeker-google-wdb.service";
export * from "./help/zoeker-help.component";
export * from "./help/zoeker-help.component";
export * from "./perceel/zoeker-perceel-getrapt.component";
export * from "./perceel/zoeker-perceel.service";
export * from "./zoeker-highlight.pipe";
export * from "./zoeker-representatie.service";
export * from "./zoeker";
