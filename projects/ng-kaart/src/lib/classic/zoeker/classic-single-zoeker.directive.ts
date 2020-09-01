import { Directive, ElementRef, Injector, Input, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { tap } from "rxjs/operators";

import { KaartBaseDirective } from "../../kaart";
import { Zoeker, zoekerMetPrioriteiten } from "../../zoeker/zoeker";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";
import * as val from "../webcomponent-support/params";

import { ClassicZoekerComponent } from "./classic-zoeker.component";

/**
 * Basisklasse voor de specifieke zoeker child tags.
 */
@Directive()
export abstract class ClassicSingleZoekerDirective extends KaartBaseDirective {
  private static nextVolledigePrioriteit = 0;
  private static nextSuggestiesPrioriteit = 0;

  private _toonIcoon = true;
  private _toonGeometrie = true;
  private _suggestiesPrioriteit = ClassicSingleZoekerDirective.nextSuggestiesPrioriteit++;
  private _volledigeZoekPrioriteit = ClassicSingleZoekerDirective.nextVolledigePrioriteit++;

  /**
   * Bepaalt of het icoontje dat in de stijl van de zoeker zit getoond wordt.
   */
  @Input()
  set toonIcoon(param: boolean) {
    this._toonIcoon = val.bool(param, this._toonIcoon);
  }

  /**
   * Bepaalt of de geometrie van een zoekresultaat (als dat er één heeft) getoond wordt.
   */
  @Input()
  public set toonGeometrie(param: boolean) {
    this._toonGeometrie = val.bool(param, this._toonGeometrie);
  }

  /**
   * De prioriteit/volgorde van deze zoeker in de suggestieresultaten? Let op: moet oplopen van 0 zonder gaten voor alle
   * zoekers. Een negatief getal betekent dat er geen suggesties opgevraagd worden.
   */
  @Input()
  public set suggestiesPrioriteit(param: number) {
    this._suggestiesPrioriteit = val.num(param, this._suggestiesPrioriteit);
  }
  /**
   * De prioriteit/volgorde van deze zoeker in de zoekresultaten. Let op: moet oplopen van 0 zonder gaten voor alle
   * zoekers. Een negatief getal betekent dat er geen zoekresultaten opgevraagd worden. Als de prioriteiten niet
   * expliciet gezet worden, dan wordt de volgorde zoals ze voorkomen in de HTML/template gebruikt. Als er voor één
   * zoeker een prioriteit ingesteld is, dan moet dat voor alle zoekers zo zijn.
   */
  @Input()
  public set volledigeZoekPrioriteit(param: number) {
    this._volledigeZoekPrioriteit = val.num(
      param,
      this._volledigeZoekPrioriteit
    );
  }

  constructor(injector: Injector, zoeker: Zoeker) {
    super(injector.get(NgZone));

    const locatorService = injector.get(
      KaartClassicLocatorService
    ) as KaartClassicLocatorService<ClassicZoekerComponent>;
    const el: ElementRef<Element> = injector.get(ElementRef);
    const zoekerComponent = locatorService.getComponent(
      injector,
      ClassicZoekerComponent,
      el
    );

    this.bindToLifeCycle(
      rx.merge(
        this.initialising$.pipe(
          tap(() =>
            zoekerComponent.addZoeker(
              zoekerMetPrioriteiten(
                zoeker,
                this._volledigeZoekPrioriteit,
                this._suggestiesPrioriteit,
                this._toonIcoon,
                this._toonGeometrie
              )
            )
          )
        ),
        this.destroying$.pipe(tap(() => zoekerComponent.removeZoeker(zoeker)))
      )
    ).subscribe();
  }
}
