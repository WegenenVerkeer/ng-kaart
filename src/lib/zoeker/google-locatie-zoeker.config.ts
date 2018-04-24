import { InjectionToken } from "@angular/core";

export const GOOGLE_LOCATIE_ZOEKER_CFG = new InjectionToken<GoogleLocatieZoekerConfigData>("GoogleLocatieZoekerCfg");

export interface GoogleLocatieZoekerConfigData {
  readonly url?: string;
  readonly maxAantal?: number;
  readonly kleur?: [number, number, number, number];
  readonly apiKey?: string;
}

export class GoogleLocatieZoekerConfig {
  readonly url: string = "/locatiezoeker";
  readonly maxAantal: number = 10;
  readonly kleur: [number, number, number, number] = [247, 144, 45, 1.0];
  readonly apiKey: string | undefined = undefined;

  constructor(data: GoogleLocatieZoekerConfigData) {
    if (data.url) {
      this.url = data.url;
    }
    if (data.maxAantal) {
      this.maxAantal = data.maxAantal;
    }
    if (data.kleur) {
      this.kleur = data.kleur;
    }
    if (data.apiKey) {
      this.apiKey = data.apiKey;
    }
  }

  lichtereKleur(): [number, number, number, number] {
    return [this.kleur[0], this.kleur[1], this.kleur[2], this.kleur[3] / 5.0];
  }
}
