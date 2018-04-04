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

  constructor(private zoeker: string, error?: string) {
    if (error != null) {
      this.fouten.push(error);
    }
  }
}

export interface AbstractZoeker {
  naam(): string;
  zoek(zoekterm: string): Observable<ZoekResultaten>;
}
