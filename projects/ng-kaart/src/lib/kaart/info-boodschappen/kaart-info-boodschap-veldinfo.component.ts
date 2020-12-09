import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  NgZone,
  Output,
} from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { eq, map, option } from "fp-ts";
import { map as rxmap } from "rxjs/operators";
import { constTrue, Function1, Function2, Predicate } from "fp-ts/lib/function";
import * as Mustache from "mustache";
import {
  formateerDate,
  formateerDateTime,
  parseDate,
  parseDateTime,
} from "../../util/date-time";
import { KaartChildDirective } from "../kaart-child.directive";
import { VeldInfo, VeldType, isLocatie } from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";
import { copyToClipboard } from "../../util/clipboard";
import { ServiceNowOpties, ServiceNowUiSelector } from "./service-now-opties";
import { KaartInfoBoodschapComponent } from "./kaart-info-boodschap.component";

interface PuntWeglocatie {
  ident8: string;
  opschrift: number;
  afstand: number;
}

interface LijnWeglocatie {
  ident8: string;
  begin: {
    opschrift: number;
    afstand: number;
  };
  eind: {
    opschrift: number;
    afstand: number;
  };
}

export type VeldinfoMap = Map<string, VeldInfo>;
export interface Properties {
  readonly [key: string]: any;
}

const hasValue: Predicate<any> = (value) =>
  value !== undefined && value !== null;

const nestedPropertyValue: Function2<string, Object, any> = (
  propertyKey,
  object
) =>
  hasValue(propertyKey)
    ? propertyKey
        .split(".")
        .reduce(
          (obj, key) => (hasValue(obj) && hasValue(obj[key]) ? obj[key] : null),
          object
        )
    : null;

const formateerJson = (
  veld: string,
  veldtype: string,
  json: any,
  formatString: string
): string => {
  const jsonString =
    typeof json === "string" || json instanceof String
      ? json
      : JSON.stringify(json);
  const jsonObject =
    veldtype === "json"
      ? JSON.parse(`{"${veld}": ${jsonString}}`)
      : JSON.parse(`{"${veld}": "${jsonString}"}`);
  return Mustache.render(formatString, jsonObject);
};

const veldnamen: Function1<VeldinfoMap, string[]> = (veldbeschrijvingen) => [
  ...veldbeschrijvingen.keys(),
];

const veldbeschrijving: Function2<
  string,
  VeldinfoMap,
  option.Option<VeldInfo>
> = (veld, veldbeschrijvingen) =>
  map.lookup(eq.eqString)(veld, veldbeschrijvingen);

const hasVeldSatisfying: Function1<
  Predicate<VeldInfo>,
  Function2<VeldinfoMap, string, boolean>
> = (test) => (veldbeschrijvingen, veld) =>
  veldbeschrijving(veld, veldbeschrijvingen).exists(test);

const hasVeld: Function2<VeldinfoMap, string, boolean> = hasVeldSatisfying(
  constTrue
);

const heeftDataType: Function2<
  VeldinfoMap,
  string,
  boolean
> = hasVeldSatisfying((veldInfo) =>
  option.fromNullable(veldInfo.dataType).isSome()
);

// indien geen meta informatie functie, toon alle velden
const isBasisVeld: Function2<VeldinfoMap, string, boolean> = hasVeldSatisfying(
  (veldInfo) => veldInfo.isBasisVeld
);

@Component({
  selector: "awv-kaart-info-boodschap-veldinfo",
  templateUrl: "./kaart-info-boodschap-veldinfo.component.html",
  styleUrls: ["./kaart-info-boodschap-veldinfo.component.scss"],
})
export class KaartInfoBoodschapVeldinfoComponent
  extends KaartChildDirective
  implements OnInit {
  @Input()
  properties: Properties;

  @Input()
  veldbeschrijvingen: VeldinfoMap = new Map();

  @Output()
  weglocatie?: string;

  @Output()
  afmeting?: string;

  @Output()
  lengte?: string;

  @Output()
  breedte?: string;

  private _alleVeldenZichtbaar = false;

  // ServiceNow cases aanmaken actief of niet?
  // Default staat deze af. Kan geënabled worden door via ServiceNowOpties serviceNowCasesActief op true te zetten. Zal door Geoloket
  // op actief gezet worden indien de gebruiker rol VTC_Gebruiker heeft
  // We tonen enkel de ServiceNow form indien deze boolean true is en de laag een veld "installatieNaamPad" heeft (eminfra specifiek)
  serviceNowActief = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    parent: KaartComponent,
    zone: NgZone,
    private kaartInfoBoodschapComponent: KaartInfoBoodschapComponent,
    private readonly sanitizer: DomSanitizer
  ) {
    super(parent, zone);

    this.accumulatedOpties$<ServiceNowOpties>(ServiceNowUiSelector)
      .pipe(rxmap((o) => o.serviceNowCasesActief))
      .subscribe((actief) => {
        this.serviceNowActief = actief;
        cdr.detectChanges();
      });
  }

  ngOnInit() {
    super.ngOnInit();
    // set weglocatie hier
    // set afmeting hier
  }

  alleVeldenZichtbaar() {
    return this._alleVeldenZichtbaar;
  }

  setAlleVeldenZichtbaar(zichtbaar: boolean) {
    this._alleVeldenZichtbaar = zichtbaar;
    this.kaartInfoBoodschapComponent.scrollIntoView();
  }

  // zijderijbaan(): string {
  //   switch (this.waarde(ZIJDERIJBAAN)) {
  //     case "R":
  //       return "Rechts";
  //     case "L":
  //       return "Links";
  //     case "M":
  //       return "Midden";
  //     case "O":
  //       return "Op";
  //     default:
  //       return option
  //         .fromNullable(this.waarde(ZIJDERIJBAAN))
  //         .map((b) => b.toString())
  //         .getOrElse("");
  //   }
  // }

  label(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .map((veldInfo) => option.fromNullable(veldInfo.label).getOrElse(""))
      .getOrElse(veld);
  }

  basisEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        !heeftDataType(this.veldbeschrijvingen, veldnaam) &&
        !this.isLinkVeld(veldnaam)
    );
  }

  linkEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        !heeftDataType(this.veldbeschrijvingen, veldnaam) &&
        this.isLinkVeld(veldnaam)
    );
  }

  heeftGeavanceerdeEigenschappen(): boolean {
    return this.geavanceerdeEigenschappen().length > 0;
  }

  geavanceerdeEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        !heeftDataType(this.veldbeschrijvingen, veldnaam) &&
        !this.isLinkVeld(veldnaam)
    );
  }

  geavanceerdeLinkEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        !heeftDataType(this.veldbeschrijvingen, veldnaam) &&
        this.isLinkVeld(veldnaam)
    );
  }

  constante(veld: string): option.Option<string> {
    return (
      veldbeschrijving(veld, this.veldbeschrijvingen)
        .chain((veldInfo) => option.fromNullable(veldInfo.constante))
        // vervang elke instantie van {id} in de waarde van 'constante' door de effectieve id :
        .map((waarde) =>
          veldnamen(this.veldbeschrijvingen).reduce((result, eigenschap) => {
            const token = `{${eigenschap}}`;
            // vervang _alle_ tokens met de waarde uit het record
            return result.includes(token)
              ? result
                  .split(token)
                  .join(`${nestedPropertyValue(eigenschap, this.properties)}`)
              : result;
          }, waarde)
        )
    );
  }

  parseFormat(veldnaam: string): string | null {
    return option.toNullable(
      veldbeschrijving(veldnaam, this.veldbeschrijvingen).chain((veldInfo) =>
        option.fromNullable(veldInfo.parseFormat)
      )
    );
  }

  displayFormat(veldnaam: string): string | null {
    return option.toNullable(
      veldbeschrijving(veldnaam, this.veldbeschrijvingen).chain((veldInfo) =>
        option
          .fromNullable(veldInfo.displayFormat)
          .orElse(() => option.fromNullable(veldInfo.parseFormat))
      )
    );
  }

  isKopieerbaar(veldnaam: string): boolean {
    return veldbeschrijving(veldnaam, this.veldbeschrijvingen)
      .chain((veldInfo) => option.fromNullable(veldInfo.isKopieerbaar))
      .getOrElse(false);
  }

  waarde(veldnaam: string): string | number {
    // indien er een 'constante' object in de definitie is, geef dat terug, anders geef de waarde in het veld terug
    return this.constante(veldnaam).getOrElseL(() => {
      const waarde = nestedPropertyValue(veldnaam, this.properties);
      if (
        this.hasHtml(veldnaam) &&
        waarde &&
        this.veldType(veldnaam) !== "url"
      ) {
        return this.sanitizer.bypassSecurityTrustHtml(
          formateerJson(
            veldnaam,
            this.veldType(veldnaam),
            waarde,
            this.html(veldnaam)
          )
        );
      } else if (this.hasTemplate(veldnaam) && waarde) {
        return formateerJson(
          veldnaam,
          this.veldType(veldnaam),
          waarde,
          this.template(veldnaam)
        );
      } else {
        return waarde;
      }
    });
  }

  private eigenschappen(filter: Predicate<string>): string[] {
    return veldnamen(this.veldbeschrijvingen)
      .filter((veldNaam) => filter(veldNaam))
      .filter(
        (veldNaam) =>
          hasValue(nestedPropertyValue(veldNaam, this.properties)) ||
          this.constante(veldNaam).isSome()
      )
      .filter(
        (veldNaam) => nestedPropertyValue(veldNaam, this.properties) !== ""
      );
  }

  private isLinkVeld(veld: string): boolean {
    return (
      option
        .fromNullable(this.waarde(veld)) // indien waarde van veld begint met http
        .filter((waarde) => typeof waarde === "string")
        .exists((waarde) => `${waarde}`.startsWith("http")) ||
      veldbeschrijving(veld, this.veldbeschrijvingen) // indien 'constante' veld start met http
        .chain((veldInfo) => option.fromNullable(veldInfo.constante)) //
        .exists((constante) => constante.startsWith("http")) ||
      this.veldType(veld) === "url"
    );
  }

  private hasTemplate(veld: string): boolean {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain((veldInfo) => option.fromNullable(veldInfo.template))
      .isSome();
  }

  private hasHtml(veld: string): boolean {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain((veldInfo) => option.fromNullable(veldInfo.html))
      .isSome();
  }

  private template(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain((veldInfo) => option.fromNullable(veldInfo.template))
      .getOrElse("");
  }

  private html(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain((veldInfo) => option.fromNullable(veldInfo.html))
      .getOrElse("");
  }

  veldType(veld: string): VeldType {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .map((veldInfo) => veldInfo.type)
      .getOrElse("string");
  }

  aanmakenCaseServiceNowMogelijk(): boolean {
    return (
      this.serviceNowActief &&
      hasVeld(this.veldbeschrijvingen, "installatieNaampad")
    );
  }

  copyToClipboard(toCopy: string | number) {
    copyToClipboard(toCopy);
  }
}
