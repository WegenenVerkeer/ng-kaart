import { AfterContentInit, Directive, ElementRef, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";
import { ClassicLaagDirective } from "../lagen/classic-laag.directive";
import * as val from "../webcomponent-support/params";

/**
 * Basisklasse voor de legende items.
 */
@Directive()
export abstract class ClassicLegendeItemDirective implements AfterContentInit {
  _beschrijving: string;

  /**
   * De tekst die bij het item hoort: de omschrijving van een type van elementen op de laag.
   */
  @Input()
  set beschrijving(param: string) {
    this._beschrijving = val.str(param, this._beschrijving);
  }

  constructor(private injector: Injector) {}

  ngAfterContentInit(): void {
    const locatorService = this.injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<ClassicLaagDirective>;
    const el: ElementRef<Element> = this.injector.get(ElementRef);
    const laag = locatorService.getComponent(this.injector, ClassicLaagDirective, el);
    laag.addLegendeItem(this);
  }

  abstract maakLegendeItem(): LegendeItem;
}
