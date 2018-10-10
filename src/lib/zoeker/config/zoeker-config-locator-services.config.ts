export interface LocatorServicesConfigData {
  readonly url?: string;
  readonly maxAantal?: number;
  readonly kleur?: [number, number, number, number];
}

export class ZoekerConfigLocatorServicesConfig {
  readonly url: string = "https://apps-dev.mow.vlaanderen.be/locatorservices";
  readonly maxAantal: number = 10;
  readonly kleur: [number, number, number, number] = [247, 144, 45, 1.0];

  constructor(data?: LocatorServicesConfigData) {
    if (data) {
      this.url = data.url || this.url;
      this.maxAantal = data.maxAantal || this.maxAantal;
      this.kleur = data.kleur || this.kleur;
    }
  }
}
