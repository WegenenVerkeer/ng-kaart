import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import { array, setoid } from "fp-ts";
import { Function1 } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { delay, distinctUntilChanged, map, observeOn, scan, share, shareReplay, switchMap, take, takeUntil, tap } from "rxjs/operators";

import { collectOption } from "../../util";
import { Consumer1 } from "../../util/function";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";

import { LaagModel } from "./laag-model";
import { TableModel } from "./table-model";
import { Update } from "./update";

export const FeatureTabelUiSelector = "FeatureTabel";

interface TemplateData {
  readonly laagTitles: string[];
  readonly visible: boolean;
}

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
  public readonly templateData$: rx.Observable<TemplateData>;

  // Voor de child components (Op DOM niveau. Access via Angular injection).
  public readonly tableModel$: rx.Observable<TableModel>;
  public readonly laagModel$: Function1<string, rx.Observable<LaagModel>>;
  public readonly tableUpdater: Consumer1<TableModel.TableModelUpdate>;
  public readonly laagUpdater: Function1<string, Consumer1<LaagModel.LaagModelUpdate>>;

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

    const updateZoomAndExtent$ = this.modelChanges.viewinstellingen$.pipe(map(TableModel.updateZoomAndExtent));

    const zichtbareFeatures$ = this.modelChanges.zichtbareFeaturesPerLaag$.pipe(map(TableModel.updateZichtbareFeatures));

    const featureSelection$ = this.modelChanges.geselecteerdeFeatures$.pipe(map(TableModel.updateSelectedFeatures));

    const filterGezet$ = this.modelChanges.laagfilterGezet$.pipe(map(TableModel.updateFilterSettings));

    // De volgende combinatie zet Updates die asynchroon gegenereerd zijn om in toekomstige synchrone updates
    const asyncUpdatesSubj: rx.Subject<TableModel.TableModelSyncUpdate> = new rx.Subject();
    const delayedUpdates$: rx.Observable<TableModel.TableModelUpdate> = asyncUpdatesSubj.pipe(map(Update.createSync));

    const clientUpdateSubj: rx.Subject<TableModel.TableModelUpdate> = new rx.Subject();
    this.tableUpdater = (update: TableModel.TableModelUpdate) => clientUpdateSubj.next(update);
    this.laagUpdater = (titel: string) => (update: LaagModel.LaagModelUpdate) =>
      clientUpdateSubj.next(TableModel.liftLaagUpdate(titel)(update));
    const laagInTablesUpdate$: rx.Observable<TableModel.TableModelUpdate> = clientUpdateSubj;

    // Naast het zetten van geselecteerde lagen en sorteringen intern in de FeatureTabelDataComponent, kan dit ook
    // extern gebeuren via messages naar de reducer. In de praktijk is dat tijdens het laden van een laag. We luisteren
    // ook op de changes die daardoor gegeneerd zijn. Het is uiteraard belangrijk dat we geen oneindige lus maken. Dit
    // zou kunnen omdat wijzingen ook gedispatched worden en dus ook via de modelchanges terug binnen komen. De
    // distintUntilChanged in veranderLaagInstellingenCmd$ is dus onontbeerlijk.
    const externeInstellingUpdate$ = this.modelChanges.tabelLaagInstellingen$.pipe(map(TableModel.updateLaagInstellingen));

    const modelUpdate$: rx.Observable<TableModel.TableModelUpdate> = rx.merge(
      delayedUpdates$,
      updateLagen$,
      updateZoomAndExtent$,
      filterGezet$,
      featureSelection$,
      zichtbareFeatures$,
      laagInTablesUpdate$,
      externeInstellingUpdate$
    );

    // Dit is het zenuwcenter van de hele component en zijn afhankelijke componenten. Alle andere observables moeten
    // hier van aftakken. Dit is het alternatief voor alles in de kaartreducer te steken. Dat is niet aangewezen, want
    // de state is enkel hier nodig. Bovendien hebben we het hier opgelost met pure functies ipv messages + lookup.
    this.tableModel$ = this.viewReady$.pipe(
      switchMap(() =>
        this.modelChanges.viewinstellingen$.pipe(
          take(1), // We hebben een enkele zoom, etc nodig om te bootstrappen. Daarna volgen we via Updates
          switchMap(vi =>
            modelUpdate$.pipe(
              scan((model: TableModel, update: TableModel.TableModelUpdate) => {
                const newModel = update.syncUpdate(model);
                console.log("***aangepast model", newModel);
                update
                  .asyncUpdate(newModel)
                  .pipe(
                    observeOn(rx.asapScheduler), // voer eerst de rest van de ketting uit
                    tap(delayed => console.log("***delayed", delayed)),
                    takeUntil(rx.timer(60000)) // Om helemaal zeker te zijn dat de observable ooit unsubscribed wordt
                  )
                  .subscribe({
                    next: syncUpdate => asyncUpdatesSubj.next(syncUpdate),
                    error: err => kaartLogger.error("Probleem bij async model update", err) // Moet ook in UI komen. Evt retry
                  });
                return newModel;
              }, TableModel.empty(vi, kaart.config))
            )
          )
        )
      ),
      shareReplay(1) // ook late subscribers moeten toestand van model kennen
    );

    this.laagModel$ = titel => this.tableModel$.pipe(collectOption(TableModel.laagForTitel(titel)));

    // Het is belangrijk dat deze (en soortgelijke) observable maar emit op het moment dat het echt nodig is. Zeker niet
    // elke keer dat het model update. Bij een update worden immers alle childcomponents opnieuw aangemaakt. Wat dus
    // verlies van DOM + state betekent.
    const laagTitles$ = this.tableModel$.pipe(
      map(model => model.laagData.map(LaagModel.titelLens.get)),
      distinctUntilChanged(array.getSetoid(setoid.setoidString).equals)
    );

    const tabelVisible$ = this.modelChanges.tabelActiviteit$.pipe(
      delay(200), // Omdat helemaal in het begin van de animatie het icoontje anders onder de kaart valt (wegens abs pos)
      map(activiteit => activiteit === "Opengeklapt")
    );

    this.templateData$ = rx.combineLatest(laagTitles$, tabelVisible$).pipe(
      map(([laagTitles, visible]) => ({
        laagTitles,
        visible
      }))
    );
  }
}
