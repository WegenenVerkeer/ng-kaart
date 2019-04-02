import { ElementRef, Injector, NgZone } from "@angular/core";

import { KaartComponentBase } from "../kaart/kaart-component-base";

import { KaartClassicLocatorService } from "./kaart-classic-locator.service";
import { KaartClassicComponent } from "./kaart-classic.component";

export class ClassicBaseComponent extends KaartComponentBase {
  protected readonly kaart: KaartClassicComponent;

  constructor(injector: Injector) {
    super(injector.get(NgZone));
    const kaartService = injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<KaartClassicComponent>;
    const el: ElementRef<Element> = injector.get(ElementRef);
    this.kaart = kaartService.getComponent(injector, KaartClassicComponent, el, "awv-kaart-element");
  }
}
