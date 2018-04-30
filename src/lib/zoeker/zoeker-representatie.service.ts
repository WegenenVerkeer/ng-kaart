import { Inject, Injectable, InjectionToken } from "@angular/core";
import { MatIconRegistry } from "@angular/material";
import { DomSanitizer } from "@angular/platform-browser";
import * as ol from "openlayers";

import { CrabZoekerConfig } from "./crab-zoeker.config";
import { GoogleWdbLocatieZoekerConfig } from "./google-wdb-locatie-zoeker.config";
import { ZOEKER_CFG, ZoekerConfigData } from "./zoeker.config";

export const ZOEKER_REPRESENTATIE = new InjectionToken<AbstractRepresentatieService>("ZoekerRepresentatie");

export type ZoekerRepresentatieType = "Crab" | "Google" | "WDB";

export interface AbstractRepresentatieService {
  getOlStyle(type: ZoekerRepresentatieType): ol.style.Style;
  getSvgNaam(type: ZoekerRepresentatieType): string;
}

const googleSvgNaam = "pin_g_vierkant";
const wdbSvgNaam = "pin_w_vierkant";
const crabSvgNaam = "pin_c_vierkant";

const crabMarker =
  // tslint:disable-next-line:max-line-length
  '<svg x="0px" y="0px" width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414"><path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 3.3c1.49 0 2.7 1.21 2.7 2.7 0 1.49-1.21 2.7-2.7 2.7-1.49 0-2.7-1.21-2.7-2.7 0-1.49 1.21-2.7 2.7-2.7zM18 16H6v-.9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.9z" fill-rule="nonzero" stroke="#fff" stroke-width=".3"/><path fill="none" d="M0 0h24v24H0z"/><path d="M4.886 3.837h14.229v14.229H4.886z"/><text x="6.777" y="16.651" font-family="Roboto-Medium,Roboto" font-weight="500" font-size="16" fill="#fff">C</text></svg>';
const googleMarker =
  // tslint:disable-next-line:max-line-length
  '<svg x="0px" y="0px" width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414"><path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 3.3c1.49 0 2.7 1.21 2.7 2.7 0 1.49-1.21 2.7-2.7 2.7-1.49 0-2.7-1.21-2.7-2.7 0-1.49 1.21-2.7 2.7-2.7zM18 16H6v-.9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.9z" fill-rule="nonzero" stroke="#fff" stroke-width=".3"/><path fill="none" d="M0 0h24v24H0z"/><path d="M4.886 3.837h14.229v14.229H4.886z"/><text x="6.555" y="16.622" font-family="Roboto-Medium,Roboto" font-weight="500" font-size="16" fill="#fff">G</text></svg>';
const wdbMarker =
  // tslint:disable-next-line:max-line-length
  '<svg x="0px" y="0px" width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414"><path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 3.3c1.49 0 2.7 1.21 2.7 2.7 0 1.49-1.21 2.7-2.7 2.7-1.49 0-2.7-1.21-2.7-2.7 0-1.49 1.21-2.7 2.7-2.7zM18 16H6v-.9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.9z" fill-rule="nonzero" stroke="#fff" stroke-width=".3"/><path fill="none" d="M0 0h24v24H0z"/><path d="M4.886 3.837h14.229v14.229H4.886z"/><text x="4.961" y="16.633" font-family="Roboto-Medium,Roboto" font-weight="500" font-size="16" fill="#fff">W</text></svg>';

@Injectable()
export class DefaultRepresentatieService implements AbstractRepresentatieService {
  private readonly crabZoekerConfig: CrabZoekerConfig;
  private readonly googleLocatieZoekerConfig: GoogleWdbLocatieZoekerConfig;
  private googleStyle: ol.style.Style;
  private wdbStyle: ol.style.Style;
  private crabStyle: ol.style.Style;

  constructor(
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    private matIconRegistry: MatIconRegistry,
    private readonly sanitizer: DomSanitizer
  ) {
    function maakDataUrl(pin: string): string {
      return "data:image/svg+xml;utf8," + encodeURIComponent(pin);
    }

    function vervangKleur(pin: string, kleur: ol.Color): string {
      function vullFillIn(nodes: NodeListOf<SVGGraphicsElement>, fillKleur: string) {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes.item(i);
          if (!node.hasAttribute("fill")) {
            node.setAttribute("fill", fillKleur);
          }
        }
      }

      // Openlayers zijn color replacement werkt niet zoals we verwachten. Wit wordt vervangen door de opgegeven kleur.
      // Wij hebben juist wit in ons icoon nodig.
      // Daarom gaan we zelf de svg processen. We gaan er van uit dat alle path en text elementen waar geen fill op zit,
      // we de vervangende kleur moeten gebruiken.
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(pin, "text/xml");

      const kleurString = "#" + kleur[0].toString(16) + kleur[1].toString(16) + kleur[2].toString(16);

      vullFillIn(xmlDoc.getElementsByTagName("path"), kleurString);
      vullFillIn(xmlDoc.getElementsByTagName("text"), kleurString);

      return "data:image/svg+xml;utf8," + encodeURIComponent(new XMLSerializer().serializeToString(xmlDoc.documentElement));
    }

    function maakStyle(kleur: ol.Color, lichtereKleur: ol.Color, marker: string): ol.style.Style {
      return new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: kleur,
          width: 1
        }),
        fill: new ol.style.Fill({
          color: lichtereKleur
        }),
        image: new ol.style.Icon({
          anchor: [0.5, 1.0],
          src: vervangKleur(marker, kleur)
        })
      });
    }

    this.crabZoekerConfig = new CrabZoekerConfig(zoekerConfigData.crab);
    this.googleLocatieZoekerConfig = new GoogleWdbLocatieZoekerConfig(zoekerConfigData.googleWdb);

    this.matIconRegistry.addSvgIcon(crabSvgNaam, this.sanitizer.bypassSecurityTrustResourceUrl(maakDataUrl(crabMarker)));
    this.matIconRegistry.addSvgIcon(googleSvgNaam, this.sanitizer.bypassSecurityTrustResourceUrl(maakDataUrl(googleMarker)));
    this.matIconRegistry.addSvgIcon(wdbSvgNaam, this.sanitizer.bypassSecurityTrustResourceUrl(maakDataUrl(wdbMarker)));

    this.googleStyle = maakStyle(this.googleLocatieZoekerConfig.kleur, this.googleLocatieZoekerConfig.lichtereKleur(), googleMarker);
    this.wdbStyle = maakStyle(this.googleLocatieZoekerConfig.kleur, this.googleLocatieZoekerConfig.lichtereKleur(), wdbMarker);
    this.crabStyle = maakStyle(this.crabZoekerConfig.kleur, this.crabZoekerConfig.kleur, crabMarker);
  }

  getOlStyle(type: ZoekerRepresentatieType): ol.style.Style {
    switch (type) {
      case "Crab":
        return this.crabStyle;
      case "Google":
        return this.googleStyle;
      case "WDB":
        return this.wdbStyle;
    }
  }
  getSvgNaam(type: ZoekerRepresentatieType): string {
    switch (type) {
      case "Crab":
        return crabSvgNaam;
      case "Google":
        return googleSvgNaam;
      case "WDB":
        return wdbSvgNaam;
    }
  }
}
