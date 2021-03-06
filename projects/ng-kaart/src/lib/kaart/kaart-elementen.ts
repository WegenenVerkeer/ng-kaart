import { eq, option, ord } from "fp-ts";
import { Refinement } from "fp-ts/lib/function";
import { Fold, Getter, Iso, Lens, Optional, Prism } from "monocle-ts";
import * as rx from "rxjs";
import { debounceTime, mapTo } from "rxjs/operators";

import { Filter as fltr } from "../filter/filter-model";
import { FilterTotaal, totaalOpTeHalen } from "../filter/filter-totaal";
import { isNoSqlFsSource, NosqlFsSource } from "../source/nosql-fs-source";
import { Transparantie } from "../transparantieeditor/transparantie";
import { mapToOptionalByKey } from "../util/lenses";
import * as maps from "../util/maps";
import * as matchers from "../util/matchers";
import { observableFromOlEvents } from "../util/ol-observable";
import * as ol from "../util/openlayers-compat";

import { Legende } from "./kaart-legende";
import { Laagtabelinstellingen } from "./kaart-protocol-subscriptions";
import { AwvV0StyleSpec, StyleSelector } from "./stijl-selector";

export const SingleTileWmsType = "LaagType.SingleTileWms";
export type SingleTileWmsType = typeof SingleTileWmsType;
export const TiledWmsType = "LaagType.TiledWms";
export type TiledWmsType = typeof TiledWmsType;
export const WmtsType = "LaagType.Wmts";
export type WmtsType = typeof WmtsType;
export const VectorType = "LaagType.Vector";
export type VectorType = typeof VectorType;
export const BlancoType = "LaagType.Blanco";
export type BlancoType = typeof BlancoType;
export type LaagType =
  | SingleTileWmsType
  | TiledWmsType
  | WmtsType
  | VectorType
  | BlancoType;

export type AchtergrondLaag = WmsLaag | WmtsLaag | BlancoLaag;

export type Laaggroep =
  | "Achtergrond"
  | "Voorgrond.Hoog"
  | "Voorgrond.Laag"
  | "Tools";

export type Laag = WmsLaag | WmtsLaag | VectorLaag | BlancoLaag;

export interface WmsLaag {
  readonly type: SingleTileWmsType | TiledWmsType;
  readonly titel: string;
  readonly naam: string;
  readonly backgroundUrl: string;
  readonly urls: Array<string>;
  readonly versie: option.Option<string>;
  readonly cqlFilter: option.Option<string>;
  readonly tileSize: option.Option<number>;
  readonly format: option.Option<string>;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly verwijderd: boolean;
  readonly beschikbareProjecties: string[];
}

export interface WmtsCapaConfig {
  readonly type: "Capa";
  readonly url: string;
  readonly wmtsOptions: ol.source.WMTSOptions;
}

export interface WmtsManualConfig {
  readonly type: "Manual";
  readonly urls: Array<string>;
  readonly style: option.Option<string>;
  readonly matrixIds: string[];
  readonly origin: option.Option<ol.Coordinate>;
  readonly extent: option.Option<ol.Extent>;
}

export interface WmtsLaag {
  readonly type: WmtsType;
  readonly titel: string;
  readonly naam: string;
  readonly backgroundUrl: string;
  readonly versie: option.Option<string>;
  readonly format: option.Option<string>;
  readonly matrixSet: string;
  readonly config: WmtsCapaConfig | WmtsManualConfig;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly verwijderd: boolean;
}

export type VeldType =
  | "string"
  | "integer"
  | "double"
  | "geometry"
  | "date"
  | "boolean"
  | "json"
  | "url";

export interface VeldInfo {
  readonly naam: string; // naam zoals gekend in de feature
  readonly label?: string; // titel om weer te geven in de UI
  readonly type: VeldType;
  readonly isBasisVeld: boolean;
  readonly constante?: string;
  readonly template?: string;
  readonly html?: string;
  readonly uniekeWaarden?: string[];
  readonly parseFormat?: string; // voor date. Alle formats zijn Luxon specs.
  readonly displayFormat?: string; // voor date
  readonly sqlFormat?: string; // voor date
  readonly isGeenLocatieVeld?: boolean; // beschouw veld niet als deel van de weglocatie informatie
  readonly isKopieerbaar?: boolean; // toon kopieer knop in identify popup
}

export interface VectorLaag {
  readonly type: VectorType;
  readonly source: ol.source.Vector;
  readonly clusterDistance: option.Option<number>;
  readonly titel: string;
  readonly styleSelector: option.Option<StyleSelector>;
  readonly styleSelectorBron: option.Option<AwvV0StyleSpec>; // De JSON specificatie die aan de basis ligt van de StyleSelector
  readonly selectieStyleSelector: option.Option<StyleSelector>;
  readonly hoverStyleSelector: option.Option<StyleSelector>;
  readonly selecteerbaar: boolean;
  readonly hover: boolean;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly velden: Map<string, VeldInfo>;
  readonly offsetveld: option.Option<string>;
  readonly verwijderd: boolean;
  readonly rijrichtingIsDigitalisatieZin: boolean;
  readonly filter: option.Option<string>;
}

export interface BlancoLaag {
  readonly type: BlancoType;
  readonly titel: string;
  readonly backgroundUrl: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly verwijderd: boolean;
}

export interface TekenSettings {
  readonly geometryType: ol.geom.GeometryType;
  readonly geometry: option.Option<ol.geom.Geometry>;
  readonly laagStyle: option.Option<StyleSelector>;
  readonly drawStyle: option.Option<StyleSelector>;
  readonly meerdereGeometrieen: boolean;
}

export interface StartTekenen {
  type: "start";
  settings: TekenSettings;
}

export interface StopTekenen {
  type: "stop";
}

export type TekenenCommand = StartTekenen | StopTekenen;

export interface Tekenresultaat {
  readonly geometry: ol.geom.Geometry;
  readonly volgnummer: number;
  readonly featureId: number | string;
}

export interface Laagfilterinstellingen {
  readonly spec: fltr.Filter;
  readonly actief: boolean;
  readonly totaal: FilterTotaal;
}

/**
 * Dit is een wrapper rond Laag die naast de laag zelf ook het gebruik van de laag bij houdt.
 */
export interface ToegevoegdeLaag {
  readonly bron: Laag;
  readonly layer: ol.layer.Base;
  readonly titel: string; // copie omdat dit veel gebruikt wordt
  readonly laaggroep: Laaggroep;
  readonly positieInGroep: number;
  readonly magGetoondWorden: boolean;
  readonly transparantie: Transparantie;
  readonly legende: option.Option<Legende>;
  readonly stijlInLagenKiezer: option.Option<string>; // optionele naam van een CSS klasse om lijn in lagenkiezer individueel te stijlen
}

export interface ToegevoegdeVectorLaag extends ToegevoegdeLaag {
  readonly bron: VectorLaag;
  readonly layer: ol.layer.Vector;
  readonly stijlPositie: number; // We gaan er van uit dat alle vectorlagen in dezelfde groep zitten!
  readonly stijlSel: option.Option<StyleSelector>;
  readonly stijlSelBron: option.Option<AwvV0StyleSpec>; // Het JSON document dat aan de basis ligt van de StyleSelector
  readonly selectiestijlSel: option.Option<StyleSelector>;
  readonly hoverstijlSel: option.Option<StyleSelector>;
  readonly filterinstellingen: Laagfilterinstellingen;
  readonly tabelLaagInstellingen: option.Option<Laagtabelinstellingen>;
}

export interface OpLaagGroep<T> {
  readonly Achtergrond: T;
  readonly "Voorgrond.Hoog": T;
  readonly "Voorgrond.Laag": T;
  readonly Tools: T;
}

export function underlyingSource(layer: ol.layer.Layer): ol.source.Source {
  const source = layer.getSource();
  if (source instanceof ol.source.Cluster) {
    return source.getSource();
  } else {
    return source;
  }
}

export const isWmsLaag: Refinement<Laag, WmsLaag> = (laag): laag is WmsLaag =>
  laag.type === SingleTileWmsType || laag.type === TiledWmsType;
export const isTiledWmsLaag: Refinement<Laag, WmsLaag> = (
  laag
): laag is WmsLaag => laag.type === TiledWmsType;
export const isBlancoLaag: Refinement<Laag, BlancoLaag> = (
  laag
): laag is BlancoLaag => laag.type === BlancoType;
export const isVectorLaag: Refinement<Laag, VectorLaag> = (
  laag
): laag is VectorLaag => laag.type === VectorType;
export const isNoSqlFsLaag: Refinement<Laag, VectorLaag> = (
  laag
): laag is VectorLaag =>
  laag.type === VectorType && isNoSqlFsSource(laag.source);
export const asVectorLaag: (
  laag: Laag
) => option.Option<VectorLaag> = option.fromPredicate(isVectorLaag) as (
  _: Laag
) => option.Option<VectorLaag>;
export const asTiledWmsLaag: (laag: Laag) => option.Option<WmsLaag> = (laag) =>
  option.filter(isTiledWmsLaag)(option.some(laag));
export const isToegevoegdeVectorLaag: Refinement<
  ToegevoegdeLaag,
  ToegevoegdeVectorLaag
> = (laag): laag is ToegevoegdeVectorLaag => isVectorLaag(laag.bron);
export const asToegevoegdeVectorLaag: (
  laag: ToegevoegdeLaag
) => option.Option<ToegevoegdeVectorLaag> = (laag) =>
  option.fromPredicate<ToegevoegdeLaag>((lg) => isVectorLaag(lg.bron))(
    laag
  ) as option.Option<ToegevoegdeVectorLaag>;
export const isZichtbaar: (_: number) => (_: ToegevoegdeLaag) => boolean = (
  currentRes
) => (laag) =>
  laag.layer.getMinResolution() <= currentRes &&
  laag.layer.getMaxResolution() > currentRes &&
  laag.layer.getVisible();
export const asToegevoegdeNosqlVectorLaag: (
  laag: ToegevoegdeLaag
) => option.Option<ToegevoegdeVectorLaag> = (laag) =>
  option.fromPredicate<ToegevoegdeLaag>((lg) => isNoSqlFsLaag(lg.bron))(
    laag
  ) as option.Option<ToegevoegdeVectorLaag>;
export const asNosqlSource: (
  source: ol.source.Vector
) => option.Option<NosqlFsSource> = option.fromPredicate(isNoSqlFsSource) as (
  _: ol.source.Vector
) => option.Option<NosqlFsSource>;

/// ////////////
// Constructors
//

export function TekenSettings(
  geometryType: ol.geom.GeometryType,
  geometry: option.Option<ol.geom.Geometry>,
  laagStyle: option.Option<StyleSelector>,
  drawStyle: option.Option<StyleSelector>,
  meerdereGeometrieen: boolean
): TekenSettings {
  return {
    geometryType: geometryType,
    geometry: geometry,
    laagStyle: laagStyle,
    drawStyle: drawStyle,
    meerdereGeometrieen: meerdereGeometrieen,
  };
}

export function StartTekenen(settings: TekenSettings): StartTekenen {
  return {
    type: "start",
    settings: settings,
  };
}

export function StopTekenen(): StopTekenen {
  return {
    type: "stop",
  };
}

export function TekenResultaat(
  geometry: ol.geom.Geometry,
  volgnummer: number,
  featureId: number | string
): Tekenresultaat {
  return {
    volgnummer: volgnummer,
    featureId: featureId,
    geometry: geometry,
  };
}

export function Laagfilterinstellingen(
  spec: fltr.Filter,
  actief: boolean,
  totaal: FilterTotaal
): Laagfilterinstellingen {
  return {
    spec: spec,
    actief: actief,
    totaal: totaal,
  };
}

export const stdLaagfilterinstellingen = Laagfilterinstellingen(
  fltr.empty(),
  true,
  totaalOpTeHalen()
);

/// /////////////////////////
// Manipulatie en inspectie
//

export namespace ToegevoegdeLaag {
  export const setoidToegevoegdeLaagByTitel: eq.Eq<ToegevoegdeLaag> = eq.contramap<
    string,
    ToegevoegdeLaag
  >((tl) => tl.titel)(eq.eqString);
}

export namespace ToegevoegdeVectorLaag {
  export const titelGetter = Lens.fromProp<ToegevoegdeVectorLaag>()(
    "titel"
  ).asGetter();

  export const stijlSelBronLens: Optional<
    ToegevoegdeVectorLaag,
    AwvV0StyleSpec
  > = Optional.fromOptionProp<ToegevoegdeVectorLaag>()("stijlSelBron");

  export const veldInfosMapLens: Lens<
    ToegevoegdeVectorLaag,
    Map<string, VeldInfo>
  > = Lens.fromPath<ToegevoegdeVectorLaag>()(["bron", "velden"]);

  export const veldInfosLens: Lens<
    ToegevoegdeVectorLaag,
    VeldInfo[]
  > = veldInfosMapLens.composeIso(
    new Iso(
      (map) => Array.from(map.values()), //
      (infos) => maps.toMapByKey(infos, (info) => info.naam)
    )
  );

  export const veldInfoOpNaamOptional: (
    veldnaam: string
  ) => Optional<ToegevoegdeVectorLaag, VeldInfo> = (veldnaam) =>
    Lens.fromPath<ToegevoegdeVectorLaag>()(["bron", "velden"]).composeOptional(
      mapToOptionalByKey(veldnaam)
    );

  export const noSqlFsSourceFold: Fold<
    ToegevoegdeVectorLaag,
    NosqlFsSource
  > = Lens.fromPath<ToegevoegdeVectorLaag>()(["bron", "source"])
    .asGetter()
    .composePrism(Prism.fromPredicate(isNoSqlFsSource));

  export const opTitelSetoid: eq.Eq<ToegevoegdeVectorLaag> = eq.contramap<
    string,
    ToegevoegdeVectorLaag
  >((laag) => laag.titel)(eq.eqString);

  export const featuresChanged$: (
    vlg: ToegevoegdeVectorLaag
  ) => rx.Observable<null> = (vlg) =>
    observableFromOlEvents(
      vlg.layer.getSource(),
      "addfeature",
      "removefeature",
      "clear"
    ).pipe(debounceTime(100), mapTo(null));
}

export namespace VeldInfo {
  export const setoidVeldOpNaam: eq.Eq<VeldInfo> = eq.contramap<
    string,
    VeldInfo
  >((vi) => vi.naam)(eq.eqString);
  export const ordVeldOpBasisVeld: ord.Ord<VeldInfo> = ord.contramap<
    boolean,
    VeldInfo
  >((vi) => vi.isBasisVeld)(ord.ordBoolean);
  export const veldnaamLens: Lens<VeldInfo, string> = Lens.fromProp<VeldInfo>()(
    "naam"
  );
  export const veldlabelLens: Lens<
    VeldInfo,
    string | undefined
  > = Lens.fromProp<VeldInfo>()("label");
  export const isBasisveldLens: Lens<VeldInfo, boolean> = Lens.fromProp<
    VeldInfo
  >()("isBasisVeld");
  // Als er geen of een leeg label is, gebruiken we de naam
  export const veldGuaranteedLabelGetter: Getter<VeldInfo, string> = new Getter(
    (vi) => vi.label || vi.naam
  );

  export const veldInfoOpNaam: (
    naam: string,
    veldinfos: Map<string, VeldInfo>
  ) => option.Option<VeldInfo> = (naam, veldinfos) =>
    maps.findFirst(veldinfos, (vi) => vi.naam === naam);

  export const matchWithFallback: <A>(
    _: matchers.FallbackMatcher<VeldInfo, A, VeldType>
  ) => (m: VeldInfo) => A = (m) =>
    matchers.matchWithFallback(m)((veldinfo) => veldinfo.type);
}

export namespace LayerProperties {
  export const Selecteerbaar = "selecteerbaar";
  export const Hover = "hover";
  export const Titel = "titel";
}
