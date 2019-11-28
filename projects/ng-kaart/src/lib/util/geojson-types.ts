import * as ol from "openlayers";

import { ValueType } from "../kaart/feature-tabel/row-model";

export interface Geometry {
  readonly bbox?: ol.Extent;
  readonly coordinates: number[];
  readonly crs: any;
  readonly type: string;
}

export interface Metadata {
  readonly minx: number;
  readonly miny: number;
  readonly maxx: number;
  readonly maxy: number;
  readonly toegevoegd: string; // De ISO-stringvoorstelling van de datum van toevoeging
}

export type GeoJsonKeyType = string | number;

// Zou kunen new-type zijn. Afwachten of er nog properties nuttig zijn
export interface Properties {
  readonly [key: string]: ValueType | Properties;
}

// Een record zoals we dat krijgen over HTTP. Bevat enkel de essentiële GeoJson velden.
export interface GeoJsonCore {
  readonly id: GeoJsonKeyType;
  readonly properties: Properties;
  readonly geometry: Geometry;
}

// Een record zoals we dat opslaan in de IndexedDB. De eigenlijke velden uitegebreid met metadata waar we
// indices kunnen met opbouwen
export interface GeoJsonLike extends GeoJsonCore {
  // index values from bbox
  readonly metadata: Metadata;
}

export interface FeatureCollection {
  total: number;
  features: GeoJsonLike[];
}

export interface CollectionSummary {
  count: number;
}

export type GeoJsonFeatures = GeoJsonFeatureCollection | GeoJsonFeature;

export interface GeoJsonFeature {
  readonly type: "Feature";
  readonly id: GeoJsonKeyType;
  readonly properties: any;
  readonly geometry: ol.format.GeoJSONGeometry;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  readonly geometry: ol.format.GeoJSONFeatureCollection;
  readonly features: Array<GeoJsonFeature>;
}
