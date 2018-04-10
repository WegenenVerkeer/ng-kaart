import { Observable } from "rxjs/Observable";

export interface ZoekResultaat {
  partialMatch: boolean;
  index: number;
  omschrijving: string;
  bron: string;
  geometry: any;
  locatie: any;
  selected: boolean;
}

export class ZoekResultaten {
  resultaten: ZoekResultaat[] = [];
  fouten: string[] = [];
  zoeker: string;

  constructor(zoeker: string, error?: string) {
    this.zoeker = zoeker;
    if (error != null) {
      this.fouten.push(error);
    }
  }
}

export interface AbstractZoeker {
  naam(): string;
  zoek(zoekterm: string): Observable<ZoekResultaten>;
}
