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
import { constTrue, pipe, Predicate } from "fp-ts/lib/function";
import * as Mustache from "mustache";
import { KaartChildDirective } from "../kaart-child.directive";
import { VeldInfo, VeldType } from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";
import { ServiceNowOpties, ServiceNowUiSelector } from "./service-now-opties";
import { KaartInfoBoodschapComponent } from "./kaart-info-boodschap.component";

export type VeldinfoMap = Map<string, VeldInfo>;
export interface Properties {
  readonly [key: string]: any;
}

const hasValue: Predicate<any> = (value) =>
  value !== undefined && value !== null;

const nestedPropertyValue: (arg1: string, arg2: Object) => any = (
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

const veldnamen: (arg: VeldinfoMap) => string[] = (veldbeschrijvingen) => [
  ...veldbeschrijvingen.keys(),
];

const veldbeschrijving: (
  arg1: string,
  arg2: VeldinfoMap
) => option.Option<VeldInfo> = (veld, veldbeschrijvingen) =>
  map.lookup(eq.eqString)(veld, veldbeschrijvingen);

const hasVeldSatisfying: (
  arg: Predicate<VeldInfo>
) => (arg1: VeldinfoMap, arg2: string) => boolean = (test) => (
  veldbeschrijvingen,
  veld
) => pipe(veldbeschrijving(veld, veldbeschrijvingen), option.exists(test));

const hasVeld: (arg1: VeldinfoMap, arg2: string) => boolean = hasVeldSatisfying(
  constTrue
);

const heeftDataType: (
  arg1: VeldinfoMap,
  arg2: string
) => boolean = hasVeldSatisfying((veldInfo) =>
  pipe(option.fromNullable(veldInfo.dataType), option.isSome)
);

const isBasisVeld: (
  arg1: VeldinfoMap,
  arg2: string
) => boolean = hasVeldSatisfying((veldInfo) => veldInfo.isBasisVeld);

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
    return pipe(
      veldbeschrijving(veld, this.veldbeschrijvingen),
      option.map((veldInfo) =>
        pipe(
          option.fromNullable(veldInfo.label),
          option.getOrElse(() => "")
        )
      ),
      option.getOrElse(() => veld)
    );
  }

  basisEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        this.veldType(veldnaam) !== "geometry" &&
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
        this.veldType(veldnaam) !== "geometry" &&
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
    return pipe(
      veldbeschrijving(veld, this.veldbeschrijvingen),
      option.chain((veldInfo) => option.fromNullable(veldInfo.constante)),
      // vervang elke instantie van {id} in de waarde van 'constante' door de effectieve id :
      option.map((waarde) =>
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

  parseFormat(veld: string): string | null {
    return pipe(
      this.veldInfo(veld),
      option.chain((veldInfo) => option.fromNullable(veldInfo.parseFormat)),
      option.toNullable
    );
  }

  displayFormat(veld: string): string | null {
    return pipe(
      this.veldInfo(veld),
      option.chain((veldInfo) =>
        pipe(
          option.fromNullable(veldInfo.displayFormat),
          option.alt(() => option.fromNullable(veldInfo.parseFormat))
        )
      ),
      option.toNullable
    );
  }

  isKopieerbaar(veld: string): boolean {
    return pipe(
      this.veldInfo(veld),
      option.chain((veldInfo) => option.fromNullable(veldInfo.isKopieerbaar)),
      option.getOrElse(() => false)
    );
  }

  waarde(veldnaam: string): string | number {
    // indien er een 'constante' object in de definitie is, geef dat terug, anders geef de waarde in het veld terug
    return pipe(
      this.constante(veldnaam),
      option.getOrElse(() => {
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
      })
    );
  }

  private eigenschappen(filter: Predicate<string>): string[] {
    return veldnamen(this.veldbeschrijvingen)
      .filter((veldNaam) => filter(veldNaam))
      .filter(
        (veldNaam) =>
          hasValue(nestedPropertyValue(veldNaam, this.properties)) ||
          pipe(this.constante(veldNaam), option.isSome)
      )
      .filter(
        (veldNaam) => nestedPropertyValue(veldNaam, this.properties) !== ""
      );
  }

  private isLinkVeld(veld: string): boolean {
    return (
      pipe(
        option.fromNullable(this.waarde(veld)), // indien waarde van veld begint met http
        option.filter((waarde) => typeof waarde === "string"),
        option.exists((waarde) => `${waarde}`.startsWith("http"))
      ) ||
      pipe(
        veldbeschrijving(veld, this.veldbeschrijvingen), // indien 'constante' veld start met http
        option.chain((veldInfo) => option.fromNullable(veldInfo.constante)), //
        option.exists((constante) => constante.startsWith("http"))
      ) ||
      this.veldType(veld) === "url"
    );
  }

  private veldInfo(veld: string): option.Option<VeldInfo> {
    return veldbeschrijving(veld, this.veldbeschrijvingen);
  }

  private hasTemplate(veld: string): boolean {
    return pipe(
      this.veldInfo(veld),
      option.chain((veldInfo) => option.fromNullable(veldInfo.template)),
      option.isSome
    );
  }

  private hasHtml(veld: string): boolean {
    return pipe(
      this.veldInfo(veld),
      option.chain((veldInfo) => option.fromNullable(veldInfo.html)),
      option.isSome
    );
  }

  private template(veld: string): string {
    return pipe(
      this.veldInfo(veld),
      option.chain((veldInfo) => option.fromNullable(veldInfo.template)),
      option.getOrElse(() => "")
    );
  }

  private html(veld: string): string {
    return pipe(
      this.veldInfo(veld),
      option.chain((veldInfo) => option.fromNullable(veldInfo.html)),
      option.getOrElse(() => "")
    );
  }

  veldType(veld: string): VeldType {
    return pipe(
      this.veldInfo(veld),
      option.map((veldInfo) => veldInfo.type),
      option.getOrElse(() => "string")
    );
  }

  aanmakenCaseServiceNowMogelijk(): boolean {
    return (
      this.serviceNowActief &&
      hasVeld(this.veldbeschrijvingen, "installatieNaampad")
    );
  }
}
