/**
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 Agentschap Wegen & Verkeer
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

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

export interface Feedback {
  message: string;
}

export interface Gefaald extends Validatiestatus {
  reden: string;
  type: "Gefaald";
}

export interface Geometry {
  bbox?: Array<number>;
  crs?: Crs;
  type: "Geometry" | "Polygon" | "GeometryCollection" | "MultiPolygon" | "MultiLineString" | "MultiPoint" | "LineString" | "Point";
}

export interface GeometryCollection extends Geometry {
  geometries: Array<Geometry>;
  type: "GeometryCollection";
}

export interface Geslaagd extends Validatiestatus {
  type: "Geslaagd";
}

export interface IngelogdeGebruiker {
  admin: boolean;
  voId: string;
  organisatie?: string;
  editor: boolean;
  naam: string;
  voornaam: string;
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
  type: "PuntLocatie" | "VrijePuntLocatie" | "WegsegmentPuntLocatie" | "VerbindingsPuntLocatie";
}

export interface PuntLocatieReferentie {
  afstand?: number;
  wegsegmentId?: number;
  wegnummer?: Wegnummer;
  referentiepunt?: Referentiepunt;
  geometry?: Point;
}

export interface PuntLocatieReferentieOpWeg {
  afstand?: number;
  opschriftWegnummer?: Wegnummer;
  geometry?: Point;
  referentiepunt?: Referentiepunt;
}

export interface Referentiepunt {
  geldigBeideRichtingen: boolean;
  wegnummer: Wegnummer;
  opschrift: string;
  locatie: VrijePuntLocatie;
}

export interface RelatieveLocatie {
  wegnummer: Wegnummer;
  afstand: number;
  referentiepunt: Referentiepunt;
}

export interface Seed {
  sleutel: string;
  tabellen: Array<string>;
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

export interface Weg {
  wegnummer: Wegnummer;
  locatie: Array<LijnLocatie>;
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
  beheerder: string;
  morfologie: string;
  linkerStraatnaam: string;
  wegsegmentId: WegsegmentId;
  eindKnoop: WegknoopId;
  geometry: LineString;
}

export interface WegsegmentId {
  uidn: string;
  gidn: string;
  oidn: number;
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
