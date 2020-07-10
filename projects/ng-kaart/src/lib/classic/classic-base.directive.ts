import { Directive, ElementRef, Injector, NgZone } from "@angular/core";

import { KaartBaseDirective } from "../kaart/kaart-base.directive";

import { KaartClassicLocatorService } from "./kaart-classic-locator.service";
import { KaartClassicComponent } from "./kaart-classic.component";

@Directive()
export class ClassicBaseDirective extends KaartBaseDirective {
  protected readonly kaart: KaartClassicComponent;

  constructor(injector: Injector) {
    super(injector.get(NgZone));
    const locatorService = injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<KaartClassicComponent>;
    const el: ElementRef<Element> = injector.get(ElementRef);
    this.kaart = locatorService.getComponent(injector, KaartClassicComponent, el);
  }
}
