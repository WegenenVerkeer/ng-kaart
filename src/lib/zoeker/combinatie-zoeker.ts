import { AbstractZoeker, ZoekResultaten } from "./abstract-zoeker";
import { Observable } from "rxjs/Observable";
import { combineLatest, map } from "rxjs/operators";
import { of } from "rxjs/observable/of";

export class CombinatieZoeker implements AbstractZoeker {
  private static combineer(resultaten: Array<ZoekResultaten>): ZoekResultaten {
    return resultaten.reduce(CombinatieZoeker.merge, new ZoekResultaten());
  }

  private static merge(vorige: ZoekResultaten, nieuwe: ZoekResultaten): ZoekResultaten {
    return vorige.merge(nieuwe);
  }

  constructor(private zoekers: AbstractZoeker[]) {}

  zoek(zoekterm: string): Observable<ZoekResultaten> {
    const zoekresultaten = this.zoekers.map(zoeker => zoeker.zoek(zoekterm));
    const primary = zoekresultaten.shift();
    if (primary) {
      return primary.pipe(combineLatest(...zoekresultaten), map(CombinatieZoeker.combineer));
    } else {
      // Er waren geen zoekers geregistreerd.
      return of(new ZoekResultaten());
    }
  }
}
