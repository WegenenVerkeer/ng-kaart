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

  constructor(error?: string) {
    if (error != null) {
      this.fouten.push(error);
    }
  }

  merge(ander: ZoekResultaten): ZoekResultaten {
    const resultaat: ZoekResultaten = new ZoekResultaten();
    resultaat.resultaten = this.resultaten.concat(ander.resultaten);
    resultaat.fouten = this.fouten.concat(ander.fouten);
    return resultaat;
  }
}

export interface AbstractZoeker {
  zoek(zoekterm: string): Observable<ZoekResultaten>;
}
