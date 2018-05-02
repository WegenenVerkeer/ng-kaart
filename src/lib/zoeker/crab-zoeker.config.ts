export interface CrabZoekerConfigData {
  readonly url?: string;
  readonly maxAantal?: number;
  readonly kleur?: [number, number, number, number];
}

export class CrabZoekerConfig {
  readonly url: string = "/locatorzoeker";
  readonly maxAantal: number = 10;
  readonly kleur: [number, number, number, number] = [247, 144, 45, 1.0];

  constructor(data?: CrabZoekerConfigData) {
    if (data) {
      this.url = data.url || this.url;
      this.maxAantal = data.maxAantal || this.maxAantal;
      this.kleur = data.kleur || this.kleur;
    }
  }
}
