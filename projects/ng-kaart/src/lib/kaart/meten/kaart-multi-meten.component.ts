import { Component, NgZone } from "@angular/core";
import { Function1, identity } from "fp-ts/lib/function";
import { fromPredicate, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, startWith, switchMapTo, tap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { distance, matchGeometryType } from "../../util/geometries";
import { ofType } from "../../util/operators";
import { tekenInfoboodschapGeslotenMsgWrapper, VerwijderTekenFeatureMsg, verwijderTekenFeatureWrapper } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { DrawOpsCmd } from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";
import { StartDrawing, StopDrawing } from "../tekenen/tekenen-model";

export const MultiMetenUiSelector = "MultiMeten";

export interface MultiMetenOpties {
  readonly markColour: clr.Kleur;
  readonly useRouting: boolean;
  readonly toonInfoBoodschap: boolean;
}

interface Measure {
  readonly length: Option<number>;
  readonly area: Option<number>;
}

const formatNumber: Function1<number, string> = n =>
  n.toLocaleString(["nl-BE"], { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

const format: Function1<Measure, string> = measure => {
  const formatArea: Function1<number, string> = area => {
    if (area > 1000000) {
      return `${formatNumber(area / 1000000)} km²`;
    } else if (area > 10000) {
      return `${formatNumber(area / 10000)} ha`;
    } else if (area > 100) {
      return `${formatNumber(area / 100)} a`;
    } else {
      return `${formatNumber(area)} m²`;
    }
  };

  const formatLength: Function1<number, string> = length => {
    if (length > 1000) {
      return `${formatNumber(length / 1000)} km`;
    } else {
      return `${formatNumber(length)} m`;
    }
  };

  return (
    measure.length.map(l => `Totale afstand ${formatLength(l)}`).getOrElse("") +
    measure.area.map(a => `<br>Totale oppervlakte ${formatArea(a)}`).getOrElse("")
  );
};

const InfoBoodschapId = "multi-meten-resultaat";
@Component({
  selector: "awv-kaart-multi-meten",
  templateUrl: "./kaart-multi-meten.component.html",
  styleUrls: ["./kaart-multi-meten.component.scss"]
})
export class KaartMultiMetenComponent extends KaartModusComponent {
  private metenOpties: MultiMetenOpties = {
    markColour: clr.zwart, // Wschl beter ineens een stijl, dan kan het helemaal gecustomiseerd worden
    useRouting: false,
    toonInfoBoodschap: true
  };

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    const options$ = this.modusOpties$<MultiMetenOpties>();
    const toonInfoBoodschap$ = options$.pipe(
      startWith(this.metenOpties), // de defaults
      map(o => o.toonInfoBoodschap),
      distinctUntilChanged()
    );
    const measure$: rx.Observable<Measure> = this.modelChanges.getekendeGeometry$.pipe(
      map(geom => {
        const length = fromPredicate<number>(length => length > 0)(ol.Sphere.getLength(geom));
        const area = matchGeometryType(geom, {
          lineString: line => {
            const coords = line.getCoordinates();
            // Er moeten minstens 3 punten zijn om een niet-0 oppervlakte te hebben
            if (coords.length >= 3) {
              const begin = line.getFirstCoordinate();
              const end = line.getLastCoordinate();
              // Wanneer de punten dicht genoeg bij elkaar liggen, sluiten we de geometrie
              if (distance(begin, end) < 250) {
                return ol.Sphere.getArea(new ol.geom.Polygon([coords]));
              }
            }
            return 0;
          }
        }).chain(fromPredicate<number>(area => area > 0)); // flatten had ook gekund, maar dit is analoog aan lengte
        return { length: length, area: area };
      })
    );

    const boodschap$ = toonInfoBoodschap$.pipe(
      filter(identity), // enkel indien true
      switchMapTo(measure$)
    );

    const legeBoodschap$ = boodschap$.pipe(
      filter(measure => measure.area.isNone() && measure.length.isNone()),
      distinctUntilChanged()
    );

    const verwijder$ = this.internalMessage$.pipe(ofType<VerwijderTekenFeatureMsg>("TekenInfoboodschapGesloten"));

    this.runInViewReady(
      rx.merge(
        options$.pipe(tap(opties => (this.metenOpties = opties))), //
        boodschap$.pipe(
          tap(measures =>
            this.dispatch(
              prt.ToonInfoBoodschapCmd({
                id: InfoBoodschapId,
                type: "InfoBoodschapAlert",
                titel: "Meten",
                sluit: "VANZELF",
                bron: some("multi-meten"),
                message: format(measures),
                iconName: some("straighten"),
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
  }

  deactiveer() {
    this.stopMetenEnVerbergBoodschapen();
  }

  private startMetMeten(): void {
    this.dispatch(DrawOpsCmd(StartDrawing(this.metenOpties.markColour, this.metenOpties.useRouting)));
  }

  private stopMeten(): void {
    this.dispatch(DrawOpsCmd(StopDrawing()));
  }

  private stopMetenEnVerbergBoodschapen(): void {
    this.stopMeten();
    this.verbergBoodschappen();
  }

  private verbergBoodschappen(): void {
    this.dispatch(prt.VerbergInfoBoodschapCmd(InfoBoodschapId));
  }
}
