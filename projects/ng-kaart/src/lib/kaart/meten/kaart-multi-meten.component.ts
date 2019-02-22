import { Component, NgZone } from "@angular/core";
import { fromPredicate, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, share, startWith, switchMap, tap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { distance, geometryLength, matchGeometryType, toLineString } from "../../util/geometries";
import { ofType } from "../../util/operators";
import { tekenInfoboodschapGeslotenMsgWrapper, VerwijderTekenFeatureMsg } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { DrawOpsCmd } from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";
import { EndDrawing, RedrawRoute, StartDrawing } from "../tekenen/tekenen-model";

export const MultiMetenUiSelector = "MultiMeten";

export interface MultiMetenOpties {
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
@Component({
  selector: "awv-kaart-multi-meten",
  templateUrl: "./kaart-multi-meten.component.html",
  styleUrls: ["./kaart-multi-meten.component.scss"]
})
export class KaartMultiMetenComponent extends KaartModusComponent {
  private metenOpties: MultiMetenOpties = defaultOptions;

  optionsVisible = false;
  inStateStraight = true;
  inStateViaRoad = false;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    const options$ = this.modusOpties$<MultiMetenOpties>(defaultOptions);
    const toonInfoBoodschap$ = options$.pipe(
      map(o => o.showInfoMessage),
      distinctUntilChanged()
    );
    const measure$: rx.Observable<Measure> = this.modelChanges.getekendeGeometry$.pipe(
      map(geom => {
        const length = some(geometryLength(geom));
        const area = matchGeometryType(geom, {
          geometryCollection: collection => {
            if (collection.getGeometries().length >= 2) {
              return toLineString(collection)
                .map(line => {
                  const begin = line.getFirstCoordinate();
                  const end = line.getLastCoordinate();
                  // Wanneer de punten dicht genoeg bij elkaar liggen, sluiten we de geometrie
                  if (distance(begin, end) < 250) {
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
    );

    const boodschap$ = toonInfoBoodschap$.pipe(
      switchMap(toon => (toon ? measure$ : rx.empty())),
      share()
    );

    const legeBoodschap$ = boodschap$.pipe(
      filter(measure => measure.area.isNone() && measure.length.isNone()),
      distinctUntilChanged()
    );

    const verwijder$ = this.internalMessage$.pipe(ofType<VerwijderTekenFeatureMsg>("TekenInfoboodschapGesloten"));

    this.runInViewReady(
      rx.merge(
        options$.pipe(
          tap(opties => {
            this.metenOpties = opties;
            this.inStateStraight = !opties.useRouting;
            this.inStateViaRoad = opties.useRouting;
          })
        ),
        boodschap$.pipe(
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
        ),
        legeBoodschap$.pipe(tap(() => this.verbergBoodschappen())),
        verwijder$.pipe(
          tap(() => {
            this.zetModeAf();
          })
        )
      )
    );
    this.destroying$.subscribe(() => this.stopMetenEnVerbergBoodschapen());
  }

  modus(): string {
    return MultiMetenUiSelector;
  }

  activeer() {
    this.startMetMeten();
    if (this.metenOpties.connectionSelectable) {
      this.toonOpties();
    }
  }

  deactiveer() {
    this.stopMetenEnVerbergBoodschapen();
    this.verbergOpties();
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
    this.dispatch(DrawOpsCmd(StartDrawing(this.metenOpties.markColour, this.metenOpties.useRouting)));
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
