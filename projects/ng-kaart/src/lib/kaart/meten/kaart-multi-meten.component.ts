import { Component, NgZone } from "@angular/core";
import { Predicate } from "fp-ts/lib/function";
import { fromPredicate, none, Option, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, filter, map, share, startWith, switchMap, tap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import * as arrays from "../../util/arrays";
import { distance, geometryLength, matchGeometryType, toLineString } from "../../util/geometries";
import * as ol from "../../util/openlayers-compat";
import { ofType, select } from "../../util/operators";
import { tekenInfoboodschapGeslotenMsgWrapper, VerwijderTekenFeatureMsg } from "../kaart-internal-messages";
import { KaartModusDirective } from "../kaart-modus.directive";
import * as prt from "../kaart-protocol";
import { DrawOpsCmd } from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";
import { EndDrawing, RedrawRoute, StartDrawing } from "../tekenen/tekenen-model";
import { OptiesRecord } from "../ui-element-opties";

export const MultiMetenUiSelector = "MultiMeten";

export interface MultiMetenOpties extends OptiesRecord {
  readonly markColour: clr.Kleur;
  readonly useRouting: boolean;
  readonly showInfoMessage: boolean;
  readonly connectionSelectable: boolean;
}

const defaultOptions: MultiMetenOpties = {
  markColour: clr.zwart, // Wschl beter ineens een stijl, dan kan het helemaal gecustomiseerd worden
  useRouting: false,
  showInfoMessage: true,
  connectionSelectable: false
};

interface Measure {
  readonly length: Option<number>;
  readonly area: Option<number>;
}

const InfoBoodschapId = "multi-meten-resultaat";

const hasAtleastTwoPoints: Predicate<ol.geom.Geometry> = geom =>
  toLineString(geom)
    .map(line => line.getCoordinates())
    .exists(arrays.hasAtLeastLength(2));

@Component({
  selector: "awv-kaart-multi-meten",
  templateUrl: "./kaart-multi-meten.component.html",
  styleUrls: ["./kaart-multi-meten.component.scss"]
})
export class KaartMultiMetenComponent extends KaartModusDirective {
  private metenOpties: MultiMetenOpties = defaultOptions;
  private metingGestartSubj: rx.Subject<void> = new rx.Subject();

  optionsVisible = false;
  inStateStraight = true;
  inStateViaRoad = false;
  viaRoadAvailable = false;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    const options$ = this.modusOpties$<MultiMetenOpties>(defaultOptions);
    const toonInfoBoodschap$ = options$.pipe(
      map(o => o.showInfoMessage),
      distinctUntilChanged()
    );
    const scale$ = this.isActief$.pipe(
      select({
        ifTrue: this.modelChanges.viewinstellingen$.pipe(
          debounceTime(250),
          map(vi => vi.resolution * 64), // arbitrair, komt ongeveer overeen met 1 cm op mijn scherm
          distinctUntilChanged()
        )
      })
    );

    const measure$: rx.Observable<Measure> = this.wordtActief$.pipe(
      switchMap(() =>
        rx.combineLatest(this.modelChanges.getekendeGeometry$, scale$).pipe(
          map(([geom, scale]) => {
            const length = some(geometryLength(geom));
            const area = matchGeometryType(geom, {
              geometryCollection: collection => {
                if (collection.getGeometries().length >= 2) {
                  return toLineString(collection)
                    .map(line => {
                      const begin = line.getFirstCoordinate();
                      const end = line.getLastCoordinate();
                      // Wanneer de punten dicht genoeg bij elkaar liggen, sluiten we de geometrie en berekenen we een oppervlakte.
                      // Dicht genoeg hangt af van de schaal van de kaart.
                      if (distance(begin, end) < scale && arrays.isNonEmpty(line.getCoordinates())) {
                        return ol.Sphere.getArea(new ol.geom.Polygon([line.getCoordinates()]));
                      } else {
                        return 0;
                      }
                    })
                    .getOrElse(0);
                } else {
                  return 0;
                }
              }
            }).chain(fromPredicate<number>(area => area > 0)); // flatten had ook gekund, maar dit is analoog aan lengte
            return { length: length, area: area };
          })
        )
      )
    );

    const boodschap$ = toonInfoBoodschap$.pipe(
      switchMap(toon => (toon ? measure$ : rx.EMPTY)),
      share()
    );

    const legeBoodschap$ = boodschap$.pipe(
      filter(measure => measure.area.isNone() && measure.length.isNone()),
      distinctUntilChanged()
    );

    const verwijder$ = this.internalMessage$.pipe(ofType<VerwijderTekenFeatureMsg>("TekenInfoboodschapGesloten"));

    const modeSwitchMogelijk$ = this.metingGestartSubj.pipe(
      switchMap(() =>
        this.modelChanges.getekendeGeometry$.pipe(
          map(hasAtleastTwoPoints),
          startWith(false)
        )
      )
    );

    this.runInViewReady(
      rx.merge(
        options$.pipe(
          tap(opties => {
            this.metenOpties = opties;
            this.inStateStraight = !opties.useRouting;
            this.inStateViaRoad = opties.useRouting;
          })
        ),
        this.isActief$.pipe(
          switchMap(isActief =>
            isActief
              ? boodschap$.pipe(
                  tap(measures =>
                    this.dispatch(
                      prt.ToonInfoBoodschapCmd({
                        id: InfoBoodschapId,
                        type: "InfoBoodschapMeten",
                        titel: "Meten",
                        sluit: "VANZELF",
                        bron: some("multi-meten"),
                        length: measures.length,
                        area: measures.area,
                        verbergMsgGen: () => some(tekenInfoboodschapGeslotenMsgWrapper())
                      })
                    )
                  )
                )
              : rx.EMPTY
          )
        ),
        legeBoodschap$.pipe(tap(() => this.verbergBoodschappen())),
        verwijder$.pipe(
          tap(() => {
            this.zetModeAf();
          })
        ),
        modeSwitchMogelijk$.pipe(tap(m => (this.viaRoadAvailable = m))),
        this.metingGestartSubj.pipe(tap(() => this.rechteLijn())),
        this.wordtActief$.pipe(
          tap(() => {
            this.startMetMeten();
            if (this.metenOpties.connectionSelectable) {
              this.toonOpties();
            }
          })
        ),
        this.wordtInactief$.pipe(
          tap(() => {
            this.stopMetenEnVerbergBoodschapen();
            this.verbergOpties();
          })
        )
      )
    );
    this.destroying$.subscribe(() => this.stopMetenEnVerbergBoodschapen());
  }

  modus(): string {
    return MultiMetenUiSelector;
  }

  rechteLijn() {
    if (!this.inStateStraight) {
      this.inStateStraight = true;
      this.inStateViaRoad = false;
      this.dispatch(DrawOpsCmd(RedrawRoute(false)));
    }
  }

  viaWeg() {
    if (!this.inStateViaRoad) {
      this.inStateStraight = false;
      this.inStateViaRoad = true;
      this.dispatch(DrawOpsCmd(RedrawRoute(true)));
    }
  }

  private startMetMeten(): void {
    this.dispatch(DrawOpsCmd(StartDrawing(this.metenOpties.markColour, this.metenOpties.useRouting, none)));
    this.metingGestartSubj.next();
  }

  private stopMeten(): void {
    this.dispatch(DrawOpsCmd(EndDrawing()));
  }

  private stopMetenEnVerbergBoodschapen(): void {
    this.stopMeten();
    this.verbergBoodschappen();
  }

  private verbergBoodschappen(): void {
    this.dispatch(prt.VerbergInfoBoodschapCmd(InfoBoodschapId));
  }

  private toonOpties() {
    this.optionsVisible = true;
  }

  private verbergOpties() {
    this.optionsVisible = false;
  }
}
