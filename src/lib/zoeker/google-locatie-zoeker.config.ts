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

  constructor(data?: GoogleLocatieZoekerConfigData) {
    if (data) {
      this.url = data.url || this.url;
      this.maxAantal = data.maxAantal || this.maxAantal;
      this.kleur = data.kleur || this.kleur;
      this.apiKey = data.apiKey || this.apiKey;
    }
  }

  lichtereKleur(): [number, number, number, number] {
    return [this.kleur[0], this.kleur[1], this.kleur[2], this.kleur[3] / 5.0];
  }
}
