import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import { array, setoid } from "fp-ts";
import { Setoid } from "fp-ts/lib/Setoid";
import * as rx from "rxjs";
import { distinctUntilChanged, map, observeOn, scan, share, shareReplay, switchMap, take, takeUntil, tap } from "rxjs/operators";

import { subSpy } from "../../util";
import { Consumer1 } from "../../util/function";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";

import { LaagModel, SyncUpdate, TableModel, Update } from "./model";

export const FeatureTabelUiSelector = "FeatureTabel";

const equalTitels: Setoid<ke.ToegevoegdeVectorLaag[]> = array.getSetoid(ke.ToegevoegdeLaag.setoidToegevoegdeLaagByTitel);

/**
 * Dit is de hoofdcomponent van feature tabel. Deze component zorgt voor het raamwerk waar alle andere componenten in
 * passen en voor het beheer van het model onderliggend aan de tabel.
 */
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
  public readonly laagTitels$: rx.Observable<string[]>;
  public readonly toonFilters$: rx.Observable<boolean>;

  // Voor de child components (Op DOM niveau. Access via Angular injection).
  public readonly model$: rx.Observable<TableModel>;
  public readonly updater: Consumer1<Update>;

  constructor(kaart: KaartComponent, ngZone: NgZone) {
    super(kaart, ngZone);

    const voorgrondLagen$ = this.modelChanges.lagenOpGroep["Voorgrond.Hoog"].pipe(
      map(array.filter(ke.isToegevoegdeVectorLaag)),
      share()
    );

    const updateLagen$ = voorgrondLagen$.pipe(
      map(lagen => lagen.filter(laag => laag.magGetoondWorden).filter(ke.isToegevoegdeVectorLaag)),
      map(TableModel.updateLagen)
    );

    const updateZoomAndExtent$ = this.modelChanges.viewinstellingen$.pipe(map(vi => TableModel.updateZoomAndExtent(vi)));

    // De volgende combinatie zet Updates die asynchroon gegenereerd zijn om in toekomstige synchrone updates
    const asyncUpdatesSubj: rx.Subject<SyncUpdate> = new rx.Subject();
    const delayedUpdates$ = asyncUpdatesSubj.pipe(map(TableModel.syncUpdateOnly));

    // Voor de view als filter kunnen we gewoon de zichtbare features volgen. Het model zal de updates neutraliseren als
    // het niet in de view als filter mode is.
    const directPageUpdates$: rx.Observable<Update> = subSpy("****directPageUpdates$")(
      rx
        .combineLatest(
          voorgrondLagen$.pipe(distinctUntilChanged(equalTitels.equals)),
          this.modelChanges.viewinstellingen$, // OL past collectie niet aan voor elke zoom/pan, dus moeten we update forceren
          (vectorlagen, _) => vectorlagen
        )
        .pipe(
          switchMap(vectorLagen =>
            rx.concat(
              rx.from(vectorLagen.map(TableModel.featuresUpdate)), // Dit is de "geforceerde" update
              rx.merge(...vectorLagen.map(TableModel.followViewFeatureUpdates))
            )
          )
        )
    );

    const clientUpdateSubj: rx.Subject<Update> = new rx.Subject();
    this.updater = (update: Update) => clientUpdateSubj.next(update);

    const modelUpdate$: rx.Observable<Update> = rx.merge(
      delayedUpdates$,
      updateLagen$,
      updateZoomAndExtent$,
      directPageUpdates$,
      clientUpdateSubj
    );

    // Dit is het zenuwcenter van de hele component en zijn afhankelijke componenten. Alle andere observables moeten
    // hier van aftakken. Dit is het alternatief voor alles in de kaartreducer te steken. Dat is niet aangewezen, want
    // de state is enkel hier nodig. Bovendien hebben we het hier opgelost met pure functies ipv messages + lookup.
    this.model$ = this.viewReady$.pipe(
      switchMap(() =>
        this.modelChanges.viewinstellingen$.pipe(
          take(1), // We hebben een enkele zoom, etc nodig om te bootstrappen. Daarna volgen we via Updates
          switchMap(vi =>
            modelUpdate$.pipe(
              scan((model: TableModel, update: Update) => {
                console.log("***origineel model", model, update);
                const newModel = update.syncUpdate(model);
                console.log("***aangepast model", newModel);
                update
                  .asyncUpdate(newModel)
                  .pipe(
                    observeOn(rx.asapScheduler), // voer eerst de rest van de ketting uit
                    tap(page => console.log("***page", page)),
                    takeUntil(rx.timer(6000)) // Om helemaal zeker te zijn dat de observable ooit unsubscribed wordt
                  )
                  .subscribe({
                    next: syncUpdate => asyncUpdatesSubj.next(syncUpdate),
                    error: err => kaartLogger.error("Probleem bij async model update", err) // Moet ook in UI komen. Evt retry
                  });
                return newModel;
              }, TableModel.empty(vi))
            )
          )
        )
      ),
      shareReplay(1) // ook late subscribers moet toestand van model kennen
    );

    // Het is belangrijk dat deze (en soortgelijke) observable maar emit op het moment dat het echt nodig is. Zeker niet
    // elke keer dat het model update. Bij een update worden immers alle childcomponents opnieuw aangemaakt. Wat dus
    // verlies van DOM + state betekent.
    this.laagTitels$ = this.model$.pipe(
      map(model => model.laagData.map(LaagModel.titelLens.get)),
      distinctUntilChanged(array.getSetoid(setoid.setoidString).equals)
    );
  }
}
