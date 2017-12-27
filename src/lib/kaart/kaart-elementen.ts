import { List } from "immutable";
import * as ol from "openlayers";

// tslint:disable-next-line:no-shadowed-variable
export abstract class Laag {
  constructor(readonly titel: string) {}
}

export class WmsLaag extends Laag {
  constructor(
    readonly titel: string,
    readonly naam: string,
    readonly extent: ol.Extent,
    readonly urls: List<string>,
    readonly versie: string
  ) {
    super(titel);
  }
}

export class WdbLaag extends Laag {
  constructor(readonly titel: string, readonly naam: string, readonly extent: ol.Extent, readonly url: string, readonly versie: string) {
    super(titel);
  }
}

export class VectorLaag extends Laag {
  constructor(readonly titel: string, readonly source: ol.source.Vector, readonly style: ol.style.Style, readonly selecteerbaar: boolean) {
    super(titel);
  }
}

export class SchaalLijn {}
