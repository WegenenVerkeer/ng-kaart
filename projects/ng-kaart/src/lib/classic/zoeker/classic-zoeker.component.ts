import { Component, ElementRef, Injector, Input } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { concat } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";
import { delay } from "rxjs/operators";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { forEach, toArray } from "../../util/option";
import { ZoekerUiSelector } from "../../zoeker/box/zoeker-box.component";
import { ZoekerCrabService } from "../../zoeker/crab/zoeker-crab.service";
import { ZoekerGoogleWdbService } from "../../zoeker/google-wdb/zoeker-google-wdb.service";
import { ZoekerPerceelService } from "../../zoeker/perceel/zoeker-perceel.service";
import { Zoeker, zoekerMetPrioriteiten, ZoekerMetWeergaveopties } from "../../zoeker/zoeker";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";

@Component({
  selector: "awv-kaart-zoeker",
  template: "<ng-content></ng-content>"
})
export class ClassicZoekerComponent extends ClassicUIElementSelectorComponentBase {
  /**
   * Stel één enkele zoeker in.
   *
   * Niet bruikbaar in webcomponent mode.
   */
  @Input()
  zoeker: ZoekerMetWeergaveopties;

  /**
   * Stel een aantal zoekers in. Als ook <code>zoeker</code> gezet is, wordt deze ook meegenomen.
   *
   * Niet bruikbaar in webcomponent mode. Gebruik daarvoor de specifieke child tags (e.g.
   * <code>awv-kaart-crab-zoeker</code>).
   */
  @Input()
  zoekers: ZoekerMetWeergaveopties[] = [];

  private registered: ZoekerMetWeergaveopties[] = [];
  private isInitialised = false;

  constructor(
    injector: Injector,
    crabZoeker: ZoekerCrabService,
    googleZoeker: ZoekerGoogleWdbService,
    perceelZoeker: ZoekerPerceelService
  ) {
    super(ZoekerUiSelector, injector);

    const locatorService = injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<ClassicZoekerComponent>;
    const el: ElementRef<Element> = injector.get(ElementRef);
    locatorService.registerComponent(this, el);

    // We hebben hier een kleine delay nodig om de subtags de kans te geven om zich te registreren. Wanneer we webcomponents hebben,
    // weten we niet in welke volgorde ze geïnstantieerd zullen worden.
    this.initialising$.pipe(delay(100)).subscribe(() => {
      // Een beetje een ingewikkelde constructie, maar we willen dat we zowel met deze tag alleen kunnen werken (backwards compatibility)
      // als met deze tag + child tags
      const inputZoekers = concat(toArray(fromNullable(this.zoeker)), this.zoekers);
      const stdZoekers: ZoekerMetWeergaveopties[] = [
        zoekerMetPrioriteiten(googleZoeker, 1, 1, true, true),
        zoekerMetPrioriteiten(crabZoeker, 2, 2, true, true),
        zoekerMetPrioriteiten(perceelZoeker, 3, -1, true, true)
      ];
      this.registered = array.isEmpty(inputZoekers) ? stdZoekers : inputZoekers;
      this.registered.forEach(zoeker => this.registerZoeker(zoeker));
      this.isInitialised = true;
    });
    this.destroying$.subscribe(() => this.registered.forEach(zmp => this.deregisterZoeker(zmp)));
  }

  addZoeker(zoekerOpties: ZoekerMetWeergaveopties): void {
    if (!this.isInitialised) {
      this.zoekers.push(zoekerOpties);
    } else {
      this.registerZoeker(zoekerOpties);
      this.registered.push(zoekerOpties);
    }
  }

  removeZoeker(zoeker: Zoeker): void {
    forEach(array.findFirst(this.registered, zmw => zmw.zoeker === zoeker), toDelete => {
      this.registered = this.registered.filter(zmw => zmw !== toDelete);
      this.deregisterZoeker(toDelete);
    });
  }

  private registerZoeker(zoekerOpties: ZoekerMetWeergaveopties) {
    this.kaart.dispatch({
      type: "VoegZoekerToe",
      zoekerPrioriteit: zoekerOpties,
      wrapper: kaartLogOnlyWrapper
    });
  }

  private deregisterZoeker(zoekerOpties: ZoekerMetWeergaveopties) {
    this.kaart.dispatch({
      type: "VerwijderZoeker",
      zoekerNaam: zoekerOpties.zoeker.naam(),
      wrapper: kaartLogOnlyWrapper
    });
  }
}
