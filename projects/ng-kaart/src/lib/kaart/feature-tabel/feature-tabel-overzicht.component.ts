import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { Endomorphism } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { distinctUntilChanged, map, observeOn, scan, shareReplay, switchMap, takeUntil, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";

import { TableHeader, TableModel, Update } from "./model";

export const FeatureTabelUiSelector = "FeatureTabel";

interface FeatureTabelUiOpties {
  readonly filterbareLagen: boolean;
}

const DefaultOpties: FeatureTabelUiOpties = {
  filterbareLagen: true
};

@Component({
  selector: "awv-feature-tabel-overzicht",
  templateUrl: "./feature-tabel-overzicht.component.html",
  styleUrls: ["./feature-tabel-overzicht.component.scss"],
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ opacity: 0, "max-height": 0 }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 1, "max-height": "400px" }))
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "400px" }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 0, "max-height": 0 }))
      ])
    ])
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush // Omdat angular anders veel te veel change detection uitvoert
})
export class FeatureTabelOverzichtComponent extends KaartChildComponentBase {
  public readonly zichtbaar$: rx.Observable<boolean> = rx.of(true);
  public readonly laagHeaders$: rx.Observable<TableHeader[]>;
  public readonly toonFilters$: rx.Observable<boolean>;

  // Voor de child components (Op DOM niveau. Access via Angular injection).
  public readonly opties$: rx.Observable<FeatureTabelUiOpties>;
  public readonly model$: rx.Observable<TableModel>;

  constructor(kaart: KaartComponent, ngZone: NgZone) {
    super(kaart, ngZone);

    const voorgrondLagen$ = this.modelChanges.lagenOpGroep["Voorgrond.Hoog"];

    this.opties$ = this.accumulatedOpties$(FeatureTabelUiSelector, DefaultOpties);

    const pasLagenAan$ = voorgrondLagen$.pipe(
      map(lagen => lagen.filter(laag => laag.magGetoondWorden)),
      map(TableModel.pasLagenAan)
    );

    const asyncUpdatesSubj: rx.Subject<Endomorphism<TableModel>> = new rx.Subject();
    const asyncUpdates$ = asyncUpdatesSubj.pipe(map(TableModel.syncUpdateOnly));
    const modelUpdate$: rx.Observable<Update> = rx.merge(asyncUpdates$, pasLagenAan$);

    // Dit is het zenuwcenter van de hele component en zijn afhankelijke componenten. Alle andere observables moeten
    // hier van aftakken. Dit is het alternatief voor alles in de kaartreducer te steken. Dat is niet aangewezen, want
    // de state is enkel hier nodig. Bovendien hebben we het hier opgelost met pure functies ipv messages + lookup.
    this.model$ = this.viewReady$.pipe(
      switchMap(() =>
        modelUpdate$.pipe(
          scan((model, update) => {
            console.log("***origineel model", model, update);
            const newModel = update.syncUpdate(model);
            console.log("***aangepast model", newModel);
            update
              .asyncUpdate(newModel)
              .pipe(
                observeOn(rx.asapScheduler), // voer eerst de rest van de ketting uit
                tap(page => console.log("***page", page)),
                takeUntil(rx.timer(6000))
              )
              .subscribe({
                next: page => asyncUpdatesSubj.next(page),
                error: err => kaartLogger.error("Probleem bij ophalen van gegevens", err) // Moet ook in UI komen. Evt retry
              });
            return newModel;
          }, TableModel.empty())
        )
      ),
      shareReplay(1) // ook late subscribers moet toestand van model kennen
    );

    // Het is belangrijk dat deze (en soortgelijke) observable maar emit op het moment dat het echt nodig is. Zeker niet
    // elke keer dat het model update. Bij een update worden immers alle childcomponents opnieuw aangemaakt. Wat dus
    // verlies van DOM + state betekent.
    this.laagHeaders$ = this.model$.pipe(
      map(model => model.laagData.map(TableHeader.toHeader)),
      distinctUntilChanged(array.getSetoid(TableHeader.setoidTableHeader).equals)
    );
  }

  public onTitelChanged(titel: string) {
    console.log("titel", titel);
  }
}
