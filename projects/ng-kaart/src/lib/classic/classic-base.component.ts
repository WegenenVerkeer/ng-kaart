import { ElementRef, Injector, NgZone } from "@angular/core";

import { KaartComponentBase } from "../kaart/kaart-component-base";

import { KaartClassicLocatorService } from "./kaart-classic-locator.service";
import { KaartClassicComponent } from "./kaart-classic.component";

export class ClassicBaseComponent extends KaartComponentBase {
  protected readonly kaart: KaartClassicComponent;

  constructor(injector: Injector) {
    super(injector.get(NgZone));
    const locatorService = injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<KaartClassicComponent>;
    const el: ElementRef<Element> = injector.get(ElementRef);
    this.kaart = locatorService.getComponent(injector, KaartClassicComponent, el);
  }
}
