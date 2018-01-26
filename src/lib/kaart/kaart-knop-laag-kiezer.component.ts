import { Component, Input, OnDestroy, OnInit, ViewEncapsulation, NgZone } from "@angular/core";
import { map, debounceTime, distinctUntilChanged, scan } from "rxjs/operators";
import { List, Set } from "immutable";

import { KaartComponent } from "./kaart.component";
import { ShowBackgroundSelector, HideBackgroundSelector } from "./kaart-protocol-events";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import { isWmsLaag, WmsLaag } from "./kaart-elementen";

@Component({
  selector: "awv-kaart-knop-laag-kiezer",
  template: "<awv-kaart-achtergrond-selector></awv-kaart-achtergrond-selector>",
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopLaagKiezerComponent extends KaartComponentBase implements OnInit, OnDestroy {
  constructor(private readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    this.kaart.kaartModel$
      .pipe(
        map(model =>
          model.lagen
            .filter(isWmsLaag)
            .map(laag => laag as WmsLaag)
            .filter(laag => laag.dekkend)
            .toSet()
        ), // Luister naar lagen die beschikbaar komen
        debounceTime(100), // maar geef het model wat tijd om te stabiliseren
        distinctUntilChanged((l1, l2) => l1.equals(l2)), // na een map is er geen referential equality meer
        scan((alleLagenOoit: Set<WmsLaag>, lagen: Set<WmsLaag>) => alleLagenOoit.union(lagen), Set<WmsLaag>()),
        obs => this.bindToLifeCycle(obs) // zorg ervoor dat de subscription afgesloten wordt op het gepaste moment
      )
      .subscribe(lagen => this.kaart.dispatch(new ShowBackgroundSelector(lagen.toList())));
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(HideBackgroundSelector);
    super.ngOnDestroy();
  }
}
