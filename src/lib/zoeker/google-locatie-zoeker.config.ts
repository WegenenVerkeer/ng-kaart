import { Injectable } from "@angular/core";

export interface GoogleLocatieZoekerConfigData {
  url?: string;
  maxAantal?: number;
  kleur?: [number, number, number, number];
  apiKey?: string;
}

@Injectable()
export class GoogleLocatieZoekerConfig {
  url = "/locatiezoeker";
  maxAantal = 10;
  kleur: [number, number, number, number] = [247, 144, 45, 1.0];
  apiKey: string | undefined = undefined;

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
