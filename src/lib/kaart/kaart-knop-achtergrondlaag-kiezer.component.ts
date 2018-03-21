import { Component, OnDestroy, OnInit, ViewEncapsulation, NgZone, Input } from "@angular/core";
import { map, debounceTime, distinctUntilChanged, scan } from "rxjs/operators";
import { Set, List } from "immutable";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import { isBlancoLaag, isWmsLaag, WmsLaag } from "./kaart-elementen";
import { none } from "fp-ts/lib/Option";
import { forgetWrapper } from "./kaart-internal-messages";

@Component({
  selector: "awv-kaart-knop-achtergrondlaag-kiezer",
  template: "<awv-kaart-achtergrond-selector></awv-kaart-achtergrond-selector>",
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopAchtergrondLaagKiezerComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @Input() titels: Array<string> = [""];

  constructor(private readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    // Dit commando mag maar verstuurd worden als de achtergrondlagen al in het model zitten. Dat is zo als de
    // tag in de html na de lagen tags komt.
    this.kaart.dispatch({
      type: "ToonAchtergrondKeuze",
      achtergrondTitels: List(this.titels),
      geselecteerdeLaagTitel: none,
      wrapper: forgetWrapper
    });
    // this.kaart.model$
    //   .pipe(
    //     map(model =>
    //       model.lagen
    //         .filter(isWmsLaag)
    //         .filter(laag => this.titels.indexOf((laag as WmsLaag).titel) > -1)
    //         .concat(model.lagen.filter(isBlancoLaag))
    //         .toSet()
    //     ), // Luister naar lagen die beschikbaar komen
    //     debounceTime(100), // maar geef het model wat tijd om te stabiliseren
    //     distinctUntilChanged((l1, l2) => l1.equals(l2)), // na een map is er geen referential equality meer
    //     scan((alleLagenOoit: Set<WmsLaag>, lagen: Set<WmsLaag>) => alleLagenOoit.union(lagen), Set<WmsLaag>()),
    //     obs => this.bindToLifeCycle(obs) // zorg ervoor dat de subscription afgesloten wordt op het gepaste moment
    //   )
    //   .subscribe(lagen => /*this.kaart.dispatch(new ToonAchtergrondKeuze(lagen.toList(), none))*/ {
    //   });
  }

  ngOnDestroy(): void {
    this.kaart.dispatch({
      type: "VerbergAchtergrondKeuze",
      wrapper: forgetWrapper
    });
    super.ngOnDestroy();
  }
}
