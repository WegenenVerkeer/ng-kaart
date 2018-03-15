import { List } from "immutable";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { StyleSelector } from "./kaart-elementen";

export enum KaartMessageTypes {
  // Commands
  VOEG_LAAG_TOE,
  VERWIJDER_LAAG,
  VERPLAATS_LAAG,
  VOEG_SCHAAL_TOE,
  VERWIJDER_SCHAAL,
  VOEG_VOLLEDIGSCHERM_TOE,
  VERWIJDER_VOLLEDIGSCHERM,
  VOEG_STANDAARDINTERACTIES_TOE,
  VERWIJDER_STANDAARDINTERACTIES,
  VERANDER_MIDDELPUNT,
  VERANDER_ZOOMNIVEAU,
  VERANDER_EXTENT,
  VERANDER_VIEWPORT,
  FOCUS_OP_KAART,
  VERLIES_FOCUS_OP_KAART,
  VERVANG_FEATURES,
  TOON_ACHTERGROND_KEUZE,
  VERBERG_ACHTERGROND_KEUZE,
  KIES_ACHTERGROND,
  MAAK_LAAG_ZICHTBAAR,
  MAAK_LAAG_ONZICHTBAAR,
  ZET_STIJL_VOOR_LAAG,

  // Events
  ZOOMNIVEAU_VERANDERD,
  ZOOMMINMAX_VERANDERD
}

export interface KaartMessage {
  readonly type: KaartMessageTypes;
}

export class VoegLaagToe implements KaartMessage {
  readonly type = KaartMessageTypes.VOEG_LAAG_TOE;

  constructor(readonly positie: number, readonly laag: ke.Laag, readonly magGetoondWorden: boolean) {}
}

export class VerwijderLaag implements KaartMessage {
  readonly type = KaartMessageTypes.VERWIJDER_LAAG;

  constructor(readonly titel: string) {}
}

export class VerplaatsLaag implements KaartMessage {
  readonly type = KaartMessageTypes.VERPLAATS_LAAG;

  constructor(readonly titel: string, readonly doelPositie: number) {}
}

export class VoegSchaalToe implements KaartMessage {
  readonly type = KaartMessageTypes.VOEG_SCHAAL_TOE;

  constructor() {}
}

export class VerwijderSchaal implements KaartMessage {
  readonly type = KaartMessageTypes.VERWIJDER_SCHAAL;

  constructor() {}
}

export class VoegVolledigschermToe implements KaartMessage {
  readonly type = KaartMessageTypes.VOEG_VOLLEDIGSCHERM_TOE;

  constructor() {}
}

export class VerwijderVolledigscherm implements KaartMessage {
  readonly type = KaartMessageTypes.VERWIJDER_VOLLEDIGSCHERM;

  constructor() {}
}

export class VoegStandaardinteractiesToe implements KaartMessage {
  readonly type = KaartMessageTypes.VOEG_STANDAARDINTERACTIES_TOE;

  constructor(readonly scrollZoomOnFocus = false) {}
}

export class VerwijderStandaardinteracties implements KaartMessage {
  readonly type = KaartMessageTypes.VERWIJDER_STANDAARDINTERACTIES;

  constructor() {}
}

export class VeranderMiddelpunt implements KaartMessage {
  readonly type = KaartMessageTypes.VERANDER_MIDDELPUNT;

  constructor(readonly coordinate: ol.Coordinate) {}
}

export class VeranderZoomniveau implements KaartMessage {
  readonly type = KaartMessageTypes.VERANDER_ZOOMNIVEAU;

  constructor(readonly zoom: number) {}
}

export class ZoomniveauVeranderd implements KaartMessage {
  readonly type = KaartMessageTypes.ZOOMNIVEAU_VERANDERD;

  constructor(readonly zoom: number) {}
}

export class ZoomminmaxVeranderd implements KaartMessage {
  readonly type = KaartMessageTypes.ZOOMMINMAX_VERANDERD;

  constructor(readonly minZoom: number, readonly maxZoom: number) {}
}

export class VeranderExtent implements KaartMessage {
  readonly type = KaartMessageTypes.VERANDER_EXTENT;

  constructor(readonly extent: ol.Extent) {}
}

export class VeranderViewport implements KaartMessage {
  readonly type = KaartMessageTypes.VERANDER_VIEWPORT;

  constructor(readonly size: ol.Size) {}
}

export class FocusOpKaart implements KaartMessage {
  readonly type = KaartMessageTypes.FOCUS_OP_KAART;

  constructor() {}
}

export class VerliesFocusOpKaart implements KaartMessage {
  readonly type = KaartMessageTypes.VERLIES_FOCUS_OP_KAART;

  constructor() {}
}

export class VervangFeatures implements KaartMessage {
  readonly type = KaartMessageTypes.VERVANG_FEATURES;

  constructor(readonly titel: string, readonly features: List<ol.Feature>) {}
}

export class ToonAchtergrondKeuze implements KaartMessage {
  readonly type = KaartMessageTypes.TOON_ACHTERGROND_KEUZE;

  constructor(readonly backgrounds: List<ke.WmsLaag | ke.BlancoLaag>) {}
}

export const VerbergAchtergrondKeuze = {
  type: KaartMessageTypes.VERBERG_ACHTERGROND_KEUZE
};

export class KiesAchtergrond implements KaartMessage {
  readonly type = KaartMessageTypes.KIES_ACHTERGROND;

  constructor(readonly titel: string) {}
}

export class MaakLaagZichtbaar implements KaartMessage {
  readonly type = KaartMessageTypes.MAAK_LAAG_ZICHTBAAR;

  constructor(readonly titel: string) {}
}

export class MaakLaagOnzichtbaar implements KaartMessage {
  readonly type = KaartMessageTypes.MAAK_LAAG_ONZICHTBAAR;

  constructor(readonly titel: string) {}
}

export class ZetStijlVoorLaag implements KaartMessage {
  readonly type = KaartMessageTypes.ZET_STIJL_VOOR_LAAG;

  constructor(readonly titel: string, readonly stijl: StyleSelector) {}
}
