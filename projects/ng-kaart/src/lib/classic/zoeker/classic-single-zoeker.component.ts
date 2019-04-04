import { ElementRef, Injector, Input, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { tap } from "rxjs/operators";

import { KaartComponentBase } from "../../kaart";
import { Zoeker, zoekerMetPrioriteiten } from "../../zoeker/zoeker";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";

import { ClassicZoekerComponent } from "./classic-zoeker.component";

export abstract class ClassicSingleZoekerComponentBase extends KaartComponentBase {
  private static nextVolledigePrioriteit = 0;
  private static nextSuggestiesPrioriteit = 0;

  // Moet het icoontje dat in de stijl van de zoeker zit getoond worden?
  @Input()
  toonIcoon = true;
  // Moet de geometrie van het zoekresultaat (als dat er is) getoond worden?
  @Input()
  toonGeometrie = true;
  // Wat is de prioriteit/volgorde van deze zoeker in de suggestieresultaten? Let op: moet oplopen van 0 zonder gaten voor alle zoekers.
  // undefined betekent dat er geen suggesties opgevraagd worden.
  @Input()
  suggestiesPrioriteit?: number = ClassicSingleZoekerComponentBase.nextSuggestiesPrioriteit++;
  // Wat is de prioriteit/volgorde van deze zoeker in de zoekresultaten?  Let op: moet oplopen van 0 zonder gaten voor alle zoekers.
  @Input()
  volledigeZoekPrioriteit: number = ClassicSingleZoekerComponentBase.nextVolledigePrioriteit++;

  constructor(injector: Injector, zoeker: Zoeker) {
    super(injector.get(NgZone));

    const locatorService = injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<ClassicZoekerComponent>;
    const el: ElementRef<Element> = injector.get(ElementRef);
    const zoekerComponent = locatorService.getComponent(injector, ClassicZoekerComponent, el);

    rx.merge(
      this.initialising$.pipe(
        tap(() =>
          zoekerComponent.addZoeker(
            zoekerMetPrioriteiten(zoeker, this.volledigeZoekPrioriteit, this.suggestiesPrioriteit, this.toonIcoon, this.toonGeometrie)
          )
        )
      ),
      this.destroying$.pipe(tap(() => zoekerComponent.removeZoeker(zoeker)))
    ).subscribe();
  }
}
