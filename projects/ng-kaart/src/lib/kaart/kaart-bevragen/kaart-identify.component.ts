import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { array, option } from "fp-ts";
import { flow } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { ofType } from "../../util";
import { Feature } from "../../util/feature";
import { KaartChildDirective } from "../kaart-child.directive";
import { IdentifyInfoBoodschapGeslotenMsg, identifyInfoBoodschapGeslotenMsgGen } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

import { IdentifyOpties, IdentifyUiSelector } from "./kaart-identify-opties";

// Deze component genereert infoboodschappen wanneer features geselecteerd worden. Het kan gaan om 1 of meerdere
// geselecteerde features.
@Component({
  selector: "awv-identify",
  template: ""
})
export class KaartIdentifyComponent extends KaartChildDirective implements OnInit, OnDestroy {
  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    this.dispatch(prt.InitUiElementOpties(IdentifyUiSelector, { identifyOnderdrukt: false }));
    const options$ = this.accumulatedOpties$<IdentifyOpties>(IdentifyUiSelector);
    const geselecteerdeFeatures$ = this.modelChanges.geselecteerdeFeatures$;

    const verwijderdMsgs$ = geselecteerdeFeatures$.pipe(
      map(
        flow(
          gf => gf.verwijderd,
          array.filterMap(Feature.featureWithIdAndLaagnaam), // OK voor alle features uit geselecteerdeFeatures$
          array.map(feature => prt.VerbergInfoBoodschapCmd(feature.id))
        )
      ),
      switchMap(msgs => rx.scheduled(msgs, rx.asapScheduler)) // convert Obs<array> to Array<obs>
    );
    const toegevoegdMsgs$ = options$.pipe(
      switchMap(options =>
        options.identifyOnderdrukt
          ? rx.EMPTY
          : geselecteerdeFeatures$.pipe(
              map(
                flow(
                  gf => gf.toegevoegd,
                  array.filterMap(Feature.featureWithIdAndLaagnaam), // OK voor alle features uit geselecteerdeFeatures$
                  array.map(feature =>
                    prt.ToonInfoBoodschapCmd({
                      id: feature.id,
                      type: "InfoBoodschapIdentify" as "InfoBoodschapIdentify",
                      titel: feature.laagnaam,
                      feature: feature.feature,
                      bron: option.none,
                      laag: option.none,
                      sluit: "DOOR_APPLICATIE",
                      verbergMsgGen: () => option.some(identifyInfoBoodschapGeslotenMsgGen(feature.feature))
                    })
                  )
                )
              ),
              switchMap(msgs => rx.scheduled(msgs, rx.asapScheduler)) // convert Obs<array> to Array<obs>
            )
      )
    );

    const deselecteerCmd$ = this.internalMessage$.pipe(
      ofType<IdentifyInfoBoodschapGeslotenMsg>("IdentifyInfoBoodschapGesloten"),
      map(msg => prt.DeselecteerFeatureCmd([msg.feature]))
    );

    this.dispatchCmdsInViewReady(verwijderdMsgs$, toegevoegdMsgs$, deselecteerCmd$);
  }
}
