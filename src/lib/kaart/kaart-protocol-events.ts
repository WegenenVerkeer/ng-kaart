import * as ke from "./kaart-elementen";

export enum KaartEvntTypes {
  ADDED_LAAG_ON_TOP,
  REMOVED_LAAG,
  ADDED_SCHAAL,
  REMOVED_SCHAAL,
  ADDED_STD_INT,
  REMOVED_STD_INT
}

export interface KaartEvnt {
  readonly type: KaartEvntTypes;
}

export class AddedLaagOnTop implements KaartEvnt {
  readonly type = KaartEvntTypes.ADDED_LAAG_ON_TOP;

  constructor(readonly laag: ke.Laag) {}
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

export class AddedStandaardInteracties implements KaartEvnt {
  readonly type = KaartEvntTypes.ADDED_STD_INT;

  constructor() {}
}

export class RemovedStandaardInteracties implements KaartEvnt {
  readonly type = KaartEvntTypes.REMOVED_STD_INT;

  constructor() {}
}
