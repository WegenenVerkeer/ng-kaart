export type Accept = "application/json";

export interface Bezig extends Validatiestatus {
  type: "Bezig";
}

export interface Crs {
  type: string;
  properties: NamedCrsProperty;
}

export interface Failure {
  message: string;
}

export interface FeatureCollection<T> {
  type: string;
  features: Array<T>;
}

export interface Feedback {
  message: string;
}

export interface Gefaald extends Validatiestatus {
  reden: string;
  type: "Gefaald";
}

export interface Gemeente {
  naam: string;
  niscode: number;
}

export interface GeocodeInfo {
  relatieveLocatie?: RelatieveLocatie;
  punten?: GeocodePunten;
  beheerder?: WegsegmentBeheerder;
  gemeente?: Gemeente;
  wegsegmentId?: number;
}

export interface GeocodePunten {
  lambert72: Point;
  wgs84: Point;
}

export interface GeojsonReferentiepuntAsset {
  type: string;
  properties: GeojsonReferentiepuntAssetProperties;
  geometry: Point;
  id: string;
}

export interface GeojsonReferentiepuntAssetProperties {
  creatiedatum?: string;
  wijzigingsdatum?: string;
  opschrift: string;
  opnamedatum?: string;
  bijkomendewegnummers: Array<string>;
  opmerking: string;
  materiaalPaal: string;
  begindatum?: string;
  wegnummer: string;
  gebruiker: string;
  locatie: PuntLocatie;
}

export interface Geometry {
  bbox?: Array<number>;
  crs?: Crs;
  type:
    | "Geometry"
    | "Polygon"
    | "GeometryCollection"
    | "MultiPoint"
    | "MultiLineString"
    | "Point"
    | "LineString"
    | "MultiPolygon";
}

export interface GeometryCollection extends Geometry {
  geometries: Array<Geometry>;
  type: "GeometryCollection";
}

export interface Geslaagd extends Validatiestatus {
  boodschap: string;
  type: "Geslaagd";
}

export interface GpxResponse {
  kruispunten?: Array<Kruising>;
  lijnlocaties: Array<LijnLocatie>;
}

export interface IngelogdeGebruiker {
  admin: boolean;
  voId: string;
  organisatie?: string;
  editor: boolean;
  naam: string;
  voornaam: string;
}

export interface KantVanDeWeg {
  van: Wegnummer;
  kant: string;
}

export interface Kruising {
  aanliggendeSegmenten: Array<Wegsegment>;
  type: "Kruising" | "Kruispunt" | "Rotonde";
}

export interface Kruispunt extends Kruising {
  wegknoop: WegenregisterWegknoop;
  type: "Kruispunt";
}

export interface LijnLocatie {
  punten: Array<PuntLocatie>;
  geometry: MultiLineString;
}

export interface LineString extends Geometry {
  coordinates: Array<Array<number>>;
  type: "LineString";
}

export interface MultiLineString extends Geometry {
  coordinates: Array<Array<Array<number>>>;
  type: "MultiLineString";
}

export interface MultiPoint extends Geometry {
  coordinates: Array<Array<number>>;
  type: "MultiPoint";
}

export interface MultiPolygon extends Geometry {
  coordinates: Array<Array<Array<Array<number>>>>;
  type: "MultiPolygon";
}

export interface NamedCrsProperty {
  name: string;
}

export interface Onbekend extends Validatiestatus {
  type: "Onbekend";
}

export interface PagedList<T> {
  total: number;
  elements: Array<T>;
}

export interface Point extends Geometry {
  coordinates: Array<number>;
  type: "Point";
}

export interface Polygon extends Geometry {
  coordinates: Array<Array<Array<number>>>;
  type: "Polygon";
}

export interface PuntLocatie {
  geometry: Point;
  type:
    | "PuntLocatie"
    | "VrijePuntLocatie"
    | "WegsegmentPuntLocatie"
    | "VerbindingsPuntLocatie";
}

export interface PuntLocatieReferentie {
  afstand?: number;
  wegsegmentId?: number;
  wegnummer?: Wegnummer;
  referentiepunt?: ReferentiepuntRef;
  geometry?: Point;
}

export interface PuntLocatieReferentiesOpWeg {
  beginPunt: Point;
  opschriftWegnummer: Wegnummer;
  eindPunt: Point;
}

export interface Referentiepunt {
  wegnummer: Wegnummer;
  opschrift: string;
  bijkomendeWegnummers: Array<Wegnummer>;
  locatie: VrijePuntLocatie;
}

export interface ReferentiepuntAsset {
  creatiedatum?: string;
  wijzigingsdatum?: string;
  opnamedatum?: string;
  opmerking: string;
  gebruikerVoId: string;
  materiaalPaal: string;
  begindatum?: string;
  referentiepunt: Referentiepunt;
}

export interface ReferentiepuntRef {
  wegnummer: Wegnummer;
  opschrift: string;
}

export interface RelatieveLocatie {
  wegnummer: Wegnummer;
  afstand: number;
  referentiepunt: ReferentiepuntRef;
}

export interface ResultMessage {
  success: boolean;
  message: string;
}

export interface Rotonde extends Kruising {
  wegknopen: Array<WegenregisterWegknoop>;
  type: "Rotonde";
}

export interface Seed {
  sleutel: string;
}

export interface Validatiestatus {
  sleutel: string;
  type: "Validatiestatus" | "Onbekend" | "Geslaagd" | "Gefaald" | "Bezig";
}

export interface Validation<T> {
  feedback?: Feedback;
  failure?: Failure;
  success?: T;
}

export interface VerbindingsPuntLocatie extends PuntLocatie {
  relatief?: RelatieveLocatie;
  wegknoopId: WegknoopId;
  wegsegmentId: WegsegmentId;
  type: "VerbindingsPuntLocatie";
}

export interface VrijePuntLocatie extends PuntLocatie {
  type: "VrijePuntLocatie";
}

export interface WDBLocatie {
  opschrift: number;
  ident8: string;
  positie: number;
  bron: string;
  afstand: number;
  geometry: Geometry;
}

export interface WDBMateriaalPaal {
  naam: string;
  key: number;
  actief: boolean;
}

export interface WDBReferentiepuntAsset {
  creatiedatum?: string;
  wijzigingsdatum?: string;
  opschrift: string;
  opnamedatum?: string;
  ident8: string;
  materiaalpaal: WDBMateriaalPaal;
  opmerking: string;
  id: string;
  bijkomendeWegnummers: Array<Wegnummer>;
  begindatum?: string;
  gebruiker: string;
  locatie: WDBLocatie;
}

export interface Weg {
  wegnummer: Wegnummer;
  geometry: MultiLineString;
}

export interface WegenregisterWegknoop {
  oidn: number;
  geometry: Point;
}

export interface WegenregisterWegsegment {
  oidn: number;
  wegnummers: Array<Wegnummer>;
  beginknoop: WegknoopId;
  eindknoop: WegknoopId;
  geometry: LineString;
}

export interface WegknoopId {
  uidn: string;
  oidn: number;
}

export interface Wegnummer {
  nummer: string;
}

export interface Wegsegment {
  wegcategorie: string;
  beginKnoop: WegknoopId;
  rechterStraatnaam: string;
  wegnummers: Array<Wegnummer>;
  beheerder: string;
  morfologie: string;
  linkerStraatnaam: string;
  wegsegmentId: WegsegmentId;
  eindKnoop: WegknoopId;
  type: "Wegsegment" | "WegsegmentMetGeometry";
}

export interface WegsegmentBeheerder {
  label: string;
  id: string;
}

export interface WegsegmentId {
  uidn: string;
  gidn: string;
  oidn: number;
}

export interface WegsegmentMetGeometry extends Wegsegment {
  geometry: LineString;
  type: "WegsegmentMetGeometry";
}

export interface WegsegmentPuntLocatie extends PuntLocatie {
  relatief?: RelatieveLocatie;
  wegsegmentId: WegsegmentId;
  projectie: Point;
  type: "WegsegmentPuntLocatie";
}

export interface WegsegmentTemplate {
  wegcategorie?: string;
  beginKnoop?: WegknoopId;
  rechterStraatnaam?: string;
  beheerder?: string;
  morfologie?: string;
  linkerStraatnaam?: string;
  wegsegmentId?: WegsegmentId;
  eindKnoop?: WegknoopId;
  geometry?: LineString;
}

export interface XYLocatie {
  y: number;
  x: number;
  crsId: number;
}
