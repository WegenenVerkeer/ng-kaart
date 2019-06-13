export interface GoogleWdbLocatieZoekerConfigData {
  readonly url?: string;
  readonly maxAantal?: number;
  readonly kleur?: [number, number, number, number];
  readonly apiKey?: string;
  readonly gebruiktPubliekeLocatieZoeker?: boolean;
}

export class ZoekerConfigGoogleWdbConfig {
  readonly url: string = "/locatiezoeker";
  readonly maxAantal: number = 10;
  readonly kleur: [number, number, number, number] = [247, 144, 45, 1.0];
  readonly apiKey: string | undefined = undefined;
  readonly gebruiktPubliekeLocatieZoeker: boolean = false;

  constructor(data?: GoogleWdbLocatieZoekerConfigData) {
    if (data) {
      this.url = data.url || this.url;
      this.maxAantal = data.maxAantal || this.maxAantal;
      this.kleur = data.kleur || this.kleur;
      this.apiKey = data.apiKey || this.apiKey;
      this.gebruiktPubliekeLocatieZoeker = data.gebruiktPubliekeLocatieZoeker || this.gebruiktPubliekeLocatieZoeker;
    }
  }
}
