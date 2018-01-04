import * as ol from "openlayers";
import * as ke from "./kaart-elementen";

export enum KaartEvntTypes {
  ADDED_LAAG_ON_TOP,
  REMOVED_LAAG,
  ADDED_SCHAAL,
  REMOVED_SCHAAL,
  ADDED_FULL_SCREEN,
  REMOVED_FULL_SCREEN,
  ADDED_STD_INT,
  REMOVED_STD_INT,
  MIDDELPUNT_CHANGED,
  ZOOM_CHANGED,
  EXTENT_CHANGED,
  VIEWPORT_CHANGED,
  FOCUS_ON_MAP,
  LOSE_FOCUS_ON_MAP
}

export interface KaartEvnt {
  readonly type: KaartEvntTypes;
}

export class AddedLaagOnTop implements KaartEvnt {
  readonly type = KaartEvntTypes.ADDED_LAAG_ON_TOP;

  constructor(readonly laag: ke.VectorLaag | ke.WmsLaag) {}
}

export class RemovedLaag implements KaartEvnt {
  readonly type = KaartEvntTypes.REMOVED_LAAG;

  constructor(readonly titel: string) {}
}

export class AddedSchaal implements KaartEvnt {
  readonly type = KaartEvntTypes.ADDED_SCHAAL;

  constructor() {}
}

export class RemovedSchaal implements KaartEvnt {
  readonly type = KaartEvntTypes.REMOVED_SCHAAL;

  constructor() {}
}

export class AddedFullScreen implements KaartEvnt {
  readonly type = KaartEvntTypes.ADDED_FULL_SCREEN;

  constructor() {}
}

export class RemovedFullScreen implements KaartEvnt {
  readonly type = KaartEvntTypes.REMOVED_FULL_SCREEN;

  constructor() {}
}

export class AddedStandaardInteracties implements KaartEvnt {
  readonly type = KaartEvntTypes.ADDED_STD_INT;

  constructor(readonly scrollZoomOnFocus = false) {}
}

export class RemovedStandaardInteracties implements KaartEvnt {
  readonly type = KaartEvntTypes.REMOVED_STD_INT;

  constructor() {}
}

export class MiddelpuntChanged implements KaartEvnt {
  readonly type = KaartEvntTypes.MIDDELPUNT_CHANGED;

  constructor(readonly coordinate: ol.Coordinate) {}
}

export class ZoomChanged implements KaartEvnt {
  readonly type = KaartEvntTypes.ZOOM_CHANGED;

  constructor(readonly zoom: number) {}
}

export class ExtentChanged implements KaartEvnt {
  readonly type = KaartEvntTypes.EXTENT_CHANGED;

  constructor(readonly extent: ol.Extent) {}
}

export class ViewportChanged implements KaartEvnt {
  readonly type = KaartEvntTypes.VIEWPORT_CHANGED;

  constructor(readonly size: ol.Size) {}
}

export class FocusOnMap implements KaartEvnt {
  readonly type = KaartEvntTypes.FOCUS_ON_MAP;

  constructor() {}
}

export class LoseFocusOnMap implements KaartEvnt {
  readonly type = KaartEvntTypes.LOSE_FOCUS_ON_MAP;

  constructor() {}
}
