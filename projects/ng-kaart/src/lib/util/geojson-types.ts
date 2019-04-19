import * as ol from "openlayers";

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

// Een record zoals we dat krijgen over HTTP. Bevat enkel de essentiële GeoJson velden.
export interface GeoJsonCore {
  readonly id: GeoJsonKeyType;
  readonly properties: any;
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
  collection: string;
  count: number;
}
