import { ChangeDetectorRef, Component, Input, NgZone } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { eq, map, option } from "fp-ts";
import { map as rxmap } from "rxjs/operators";
import { constTrue, pipe, Predicate } from "fp-ts/lib/function";
import * as Mustache from "mustache";
import * as arrays from "../../util/arrays";
import {
  formateerDate,
  formateerDateTime,
  parseDate,
  parseDateTime,
} from "../../util/date-time";
import { KaartChildDirective } from "../kaart-child.directive";
import { VeldInfo } from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";
import { copyToClipboard } from "../../util/clipboard";
import { ServiceNowOpties, ServiceNowUiSelector } from "./service-now-opties";
import { KaartInfoBoodschapComponent } from "./kaart-info-boodschap.component";

const GEOMETRY = "geometry";
const IDENT8 = "ident8";
const IDENT8EN = "ident8en";
const LOCATIE_IDENT8 = "locatie.ident8";
const BEGIN_POSITIE = "locatie.begin.positie";
const BEGIN_AFSTAND = "locatie.begin.afstand";
const BEGIN_AFSTAND_ALT = "van_afstand";
const BEGIN_OPSCHRIFT = "locatie.begin.opschrift";
const BEGIN_OPSCHRIFT_ALT = "van_referentiepaal";
const EIND_POSITIE = "locatie.eind.positie";
const EIND_AFSTAND = "locatie.eind.afstand";
const EIND_AFSTAND_ALT = "tot_afstand";
const EIND_OPSCHRIFT = "locatie.eind.opschrift";
const EIND_OPSCHRIFT_ALT = "tot_referentiepaal";
const LENGTE = "lengte";
const LOCATIE_GEOMETRY_LENGTE = "locatie.geometry.lengte";
const LOCATIE_LENGTE = "locatie.lengte";
const ZIJDERIJBAAN = "zijderijbaan";
const AFSTANDRIJBAAN = "afstandrijbaan";
const BREEDTE = "breedte";
const HM = "hm";
const OPSCHRIFT = "opschrift";
const VERPL = "verpl";
const AFSTAND = "afstand";

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

const isType: (arg: string) => (arg1: VeldinfoMap, arg2: string) => boolean = (
  type
) => hasVeldSatisfying((veldInfo) => veldInfo.type === type);

const isBooleanVeld: (arg1: VeldinfoMap, arg2: string) => boolean = isType(
  "boolean"
);
const isDateVeld: (arg1: VeldinfoMap, arg2: string) => boolean = isType("date");

// indien geen meta informatie functie, toon alle velden
const isBasisVeld: (
  arg1: VeldinfoMap,
  arg2: string
) => boolean = hasVeldSatisfying((veldInfo) => veldInfo.isBasisVeld);

@Component({
  selector: "awv-kaart-info-boodschap-veldinfo",
  templateUrl: "./kaart-info-boodschap-veldinfo.component.html",
  styleUrls: ["./kaart-info-boodschap-veldinfo.component.scss"],
})
export class KaartInfoBoodschapVeldinfoComponent extends KaartChildDirective {
  @Input()
  properties: Properties;
  @Input()
  veldbeschrijvingen: VeldinfoMap = new Map();

  private _alleVeldenZichtbaar = false;

  teVerbergenProperties = [
    IDENT8,
    LOCATIE_IDENT8,
    IDENT8EN,
    GEOMETRY,
    BEGIN_POSITIE,
    BEGIN_AFSTAND,
    BEGIN_AFSTAND_ALT,
    BEGIN_OPSCHRIFT,
    BEGIN_OPSCHRIFT_ALT,
    EIND_POSITIE,
    EIND_AFSTAND,
    EIND_AFSTAND_ALT,
    EIND_OPSCHRIFT,
    EIND_OPSCHRIFT_ALT,
    LENGTE,
    LOCATIE_GEOMETRY_LENGTE,
    LOCATIE_LENGTE,
    AFSTANDRIJBAAN,
    ZIJDERIJBAAN,
    BREEDTE,
    HM,
    OPSCHRIFT,
    VERPL,
    AFSTAND,
  ];

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

  heeftLocatieGegevensVoor(key: string) {
    return hasValue(this.waarde(key)) && this.isLocatieVeld(key);
  }

  alleVeldenZichtbaar() {
    return this._alleVeldenZichtbaar;
  }

  setAlleVeldenZichtbaar(zichtbaar: boolean) {
    this._alleVeldenZichtbaar = zichtbaar;
    this.kaartInfoBoodschapComponent.scrollIntoView();
  }

  lengte(): option.Option<number> {
    return pipe(
      option.fromNullable(this.waarde(LOCATIE_LENGTE)),
      option.map(Math.round),
      option.alt(() =>
        pipe(option.fromNullable(this.waarde(LENGTE)), option.map(Math.round))
      ),
      option.alt(() =>
        pipe(
          option.fromNullable(this.waarde(LOCATIE_GEOMETRY_LENGTE)),
          option.map(Math.round)
        )
      )
    );
  }

  breedte(): option.Option<string> {
    return pipe(
      option.fromNullable(this.waarde(BREEDTE)),
      option.map((b) => b.toString())
    );
  }

  heeftDimensies() {
    return (
      this.heeftLocatieGegevensVoor(LOCATIE_LENGTE) ||
      this.heeftLocatieGegevensVoor(LOCATIE_LENGTE) ||
      this.heeftLocatieGegevensVoor(LOCATIE_GEOMETRY_LENGTE) ||
      this.heeftLocatieGegevensVoor(BREEDTE)
    );
  }

  dimensies(): string {
    return pipe(
      this.lengte(),
      option.fold(
        () =>
          pipe(
            this.breedte(),
            option.fold(
              () => "Geen dimensies",
              (breedte) => `${breedte}cm`
            )
          ),
        (lengte) =>
          pipe(
            this.breedte(),
            option.fold(
              () => `${lengte}m`,
              (breedte) => `${lengte}m x ${breedte}cm`
            )
          )
      )
    );
  }

  zijderijbaan(): string {
    switch (this.waarde(ZIJDERIJBAAN)) {
      case "R":
        return "Rechts";
      case "L":
        return "Links";
      case "M":
        return "Midden";
      case "O":
        return "Op";
      default:
        return pipe(
          option.fromNullable(this.waarde(ZIJDERIJBAAN)),
          option.map((b) => b.toString()),
          option.getOrElse(() => "")
        );
    }
  }

  heeftVanTot(): boolean {
    return (
      (this.heeftLocatieGegevensVoor(BEGIN_OPSCHRIFT) &&
        this.heeftLocatieGegevensVoor(EIND_OPSCHRIFT)) ||
      (this.heeftLocatieGegevensVoor(BEGIN_OPSCHRIFT_ALT) &&
        this.heeftLocatieGegevensVoor(EIND_OPSCHRIFT_ALT))
    );
  }

  heeftIdent8en(): boolean {
    // TODO we ontbreken een string[] type
    const waarde = this.waarde(IDENT8EN);
    return arrays.isArray(waarde) && arrays.isNonEmpty(waarde);
  }

  ident8en() {
    // TODO we ontbreken een string[] type
    const waarde = this.waarde(IDENT8EN);
    return pipe(
      option.fromPredicate(arrays.isArray)(waarde),
      option.map((s) => s.join(", ")),
      option.getOrElse(() => "")
    );
  }

  heeftIdent8(): boolean {
    return (
      this.heeftLocatieGegevensVoor(IDENT8) ||
      this.heeftLocatieGegevensVoor(LOCATIE_IDENT8) ||
      this.heeftLocatieGegevensVoor(IDENT8EN)
    );
  }

  ident8() {
    if (this.heeftIdent8en()) {
      return this.ident8en();
    } else {
      return pipe(
        option.fromNullable(this.waarde(IDENT8)),
        option.alt(() => option.fromNullable(this.waarde(LOCATIE_IDENT8))),
        option.getOrElse(() => "")
      );
    }
  }

  van(): string {
    return pipe(
      this.pos(BEGIN_OPSCHRIFT),
      option.alt(() => this.pos(BEGIN_OPSCHRIFT_ALT)),
      option.getOrElse(() => "")
    );
  }

  tot(): string {
    return pipe(
      this.pos(EIND_OPSCHRIFT),
      option.alt(() => this.pos(EIND_OPSCHRIFT_ALT)),
      option.getOrElse(() => "")
    );
  }

  private afstand(afstandVeld: string): option.Option<string> {
    return pipe(
      option.fromNullable(this.waarde(afstandVeld)),
      option.map(this.signed)
    );
  }

  vanAfstand(): string {
    return pipe(
      this.afstand(BEGIN_AFSTAND),
      option.alt(() => this.afstand(BEGIN_AFSTAND_ALT)),
      option.getOrElse(() => "")
    );
  }

  totAfstand(): string {
    return pipe(
      this.afstand(EIND_AFSTAND),
      option.alt(() => this.afstand(EIND_AFSTAND_ALT)),
      option.getOrElse(() => "")
    );
  }

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

  zichtbareEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.isLinkVeld(veldnaam) &&
        !isBooleanVeld(this.veldbeschrijvingen, veldnaam) &&
        !isDateVeld(this.veldbeschrijvingen, veldnaam) &&
        (!this.teVerbergenProperties.includes(veldnaam) ||
          this.isGeenLocatieVeld(veldnaam))
    );
  }

  booleanEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        isBooleanVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  dateEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        isDateVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  linkEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        this.isLinkVeld(veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  heeftGeavanceerdeEigenschappen(): boolean {
    return this.geavanceerdeEigenschappen().length > 0;
  }

  geavanceerdeEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        !isBooleanVeld(this.veldbeschrijvingen, veldnaam) &&
        !isDateVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.isLinkVeld(veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  geavanceerdeBooleanEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        isBooleanVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  geavanceerdeDateEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        isDateVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  geavanceerdeLinkEigenschappen(): string[] {
    return this.eigenschappen(
      (veldnaam) =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        this.isLinkVeld(veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
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

  parseFormat(veldnaam: string): option.Option<string> {
    return pipe(
      veldbeschrijving(veldnaam, this.veldbeschrijvingen),
      option.chain((veldInfo) => option.fromNullable(veldInfo.parseFormat))
    );
  }

  displayFormat(veldnaam: string): option.Option<string> {
    return pipe(
      veldbeschrijving(veldnaam, this.veldbeschrijvingen),
      option.chain((veldInfo) =>
        pipe(
          option.fromNullable(veldInfo.displayFormat),
          option.alt(() => option.fromNullable(veldInfo.parseFormat))
        )
      )
    );
  }

  isLocatieVeld(veldnaam: string): boolean {
    return !this.isGeenLocatieVeld(veldnaam);
  }

  isKopieerbaar(veldnaam: string): boolean {
    return pipe(
      veldbeschrijving(veldnaam, this.veldbeschrijvingen),
      option.chain((veldInfo) => option.fromNullable(veldInfo.isKopieerbaar)),
      option.getOrElse(() => false)
    );
  }

  isGeenLocatieVeld(veldnaam: string): boolean {
    return pipe(
      veldbeschrijving(veldnaam, this.veldbeschrijvingen),
      option.chain((veldInfo) =>
        option.fromNullable(veldInfo.isGeenLocatieVeld)
      ),
      option.getOrElse(() => false)
    );
  }

  copyToClipboard(toCopy: string | number) {
    copyToClipboard(toCopy);
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
          this.veldtype(veldnaam) !== "url"
        ) {
          return this.sanitizer.bypassSecurityTrustHtml(
            formateerJson(
              veldnaam,
              this.veldtype(veldnaam),
              waarde,
              this.html(veldnaam)
            )
          );
        } else if (this.hasTemplate(veldnaam) && waarde) {
          return formateerJson(
            veldnaam,
            this.veldtype(veldnaam),
            waarde,
            this.template(veldnaam)
          );
        } else {
          return waarde;
        }
      })
    );
  }

  private maybeDateWaarde(veldnaam: string): option.Option<string> {
    return pipe(
      this.constante(veldnaam),
      option.alt(() => {
        const waarde = nestedPropertyValue(veldnaam, this.properties);
        return pipe(
          option.fromNullable(waarde),
          option.chain(parseDate(this.parseFormat(veldnaam))),
          option.map(formateerDate(this.displayFormat(veldnaam)))
        );
      })
    );
  }

  dateWaarde(veldnaam: string): string {
    return pipe(
      this.maybeDateWaarde(veldnaam),
      option.getOrElse(() => "")
    );
  }

  validDateWaarde(veldnaam: string): boolean {
    return pipe(this.maybeDateWaarde(veldnaam), option.isSome);
  }

  private maybeDateTimeWaarde(veldnaam: string): option.Option<string> {
    return pipe(
      this.constante(veldnaam),
      option.alt(() => {
        const waarde = nestedPropertyValue(veldnaam, this.properties);
        return pipe(
          option.fromNullable(waarde),
          option.chain(parseDateTime(this.parseFormat(veldnaam))),
          option.map(formateerDateTime(this.displayFormat(veldnaam)))
        );
      })
    );
  }

  dateTimeWaarde(veldnaam: string): string {
    return pipe(
      this.maybeDateTimeWaarde(veldnaam),
      option.getOrElse(() => "")
    );
  }

  validDateTimeWaarde(veldnaam: string): boolean {
    return pipe(this.maybeDateTimeWaarde(veldnaam), option.isSome);
  }

  heeftOpschrift() {
    return (
      this.heeftLocatieGegevensVoor(HM) ||
      this.heeftLocatieGegevensVoor(OPSCHRIFT)
    );
  }

  opschrift(): string | number {
    return pipe(
      option.fromNullable(this.waarde(HM)),
      option.alt(() => option.fromNullable(this.waarde(OPSCHRIFT))),
      option.getOrElse(() => "")
    );
  }

  verpl(): string {
    return pipe(
      option.fromNullable(this.waarde(VERPL)),
      option.alt(() => option.fromNullable(this.waarde(AFSTAND))),
      option.map(this.signed),
      option.getOrElse(() => "")
    );
  }

  private pos(positieVeld: string): option.Option<string> {
    return pipe(
      option.fromNullable(this.waarde(positieVeld)),
      option.filter((positie) => typeof positie === "number"),
      option.map((positie) => `${Math.round((positie as number) * 10) / 10}`)
    );
  }

  private signed(value: number): string {
    if (value >= 0) {
      return `+${value}`;
    } else {
      return `${value}`;
    }
  }

  private eigenschappen(filter: Predicate<string>): string[] {
    return veldnamen(this.veldbeschrijvingen)
      .filter((veldNaam) => filter(veldNaam))
      .filter(
        (veldNaam) =>
          hasValue(nestedPropertyValue(veldNaam, this.properties)) ||
          option.isSome(this.constante(veldNaam))
      )
      .filter(
        (veldNaam) => nestedPropertyValue(veldNaam, this.properties) !== ""
      );
  }

  private isLinkVeld(veld: string): boolean {
    return pipe(
      option.fromNullable(this.waarde(veld)), // indien waarde van veld begint met http
      option.filter((waarde) => typeof waarde === "string"),
      option.exists((waarde) => `${waarde}`.startsWith("http")) ||
        pipe(
          veldbeschrijving(veld, this.veldbeschrijvingen), // indien 'constante' veld start met http
          option.chain((veldInfo) => option.fromNullable(veldInfo.constante)), //
          option.exists((constante) => constante.startsWith("http")) ||
            this.veldtype(veld) === "url"
        )
    );
  }

  private hasTemplate(veld: string): boolean {
    return pipe(
      veldbeschrijving(veld, this.veldbeschrijvingen),
      option.chain((veldInfo) => option.fromNullable(veldInfo.template)),
      option.isSome
    );
  }

  private hasHtml(veld: string): boolean {
    return pipe(
      veldbeschrijving(veld, this.veldbeschrijvingen),
      option.chain((veldInfo) => option.fromNullable(veldInfo.html)),
      option.isSome
    );
  }

  private template(veld: string): string {
    return pipe(
      veldbeschrijving(veld, this.veldbeschrijvingen),
      option.chain((veldInfo) => option.fromNullable(veldInfo.template)),
      option.getOrElse(() => "")
    );
  }

  private html(veld: string): string {
    return pipe(
      veldbeschrijving(veld, this.veldbeschrijvingen),
      option.chain((veldInfo) => option.fromNullable(veldInfo.html)),
      option.getOrElse(() => "")
    );
  }

  private veldtype(veld: string): string {
    return pipe(
      veldbeschrijving(veld, this.veldbeschrijvingen),
      option.map((veldInfo) => veldInfo.type.toString()),
      option.getOrElse(() => "")
    );
  }

  aanmakenCaseServiceNowMogelijk(): boolean {
    return (
      this.serviceNowActief &&
      hasVeld(this.veldbeschrijvingen, "installatieNaampad")
    );
  }
}
