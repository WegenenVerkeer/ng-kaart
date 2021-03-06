import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import { option } from "fp-ts";
import * as rx from "rxjs";
import { map, takeUntil, tap } from "rxjs/operators";

import { dimensieBeschrijving } from "../../util/geometries";
import * as maps from "../../util/maps";
import { observeOnAngular } from "../../util/observe-on-angular";
import * as ol from "../../util/openlayers-compat";
import { ofType } from "../../util/operators";
import * as sets from "../../util/sets";
import { TekenSettings } from "../kaart-elementen";
import {
  GeometryChangedMsg,
  InfoBoodschappenMsg,
  tekenResultaatWrapper,
  verwijderTekenFeatureWrapper,
} from "../kaart-internal-messages";
import { KaartModusDirective } from "../kaart-modus.directive";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";
import { internalMsgSubscriptionCmdOperator } from "../subscription-helper";
import { OptiesRecord } from "../ui-element-opties";

export const MetenUiSelector = "Meten";

export interface MetenOpties extends OptiesRecord {
  toonInfoBoodschap: boolean;
  meerdereGeometrieen: boolean;
}

const defaultOpties: MetenOpties = {
  toonInfoBoodschap: true,
  meerdereGeometrieen: true,
};

/**
 * Deze component is hier enkel nog voor de Elisa use case van het tekenen van geometrieën.
 *
 * @deprecated gebruik de KaartMultiMetenComponent
 */
@Component({
  selector: "awv-kaart-meten",
  templateUrl: "./kaart-meten.component.html",
  styleUrls: ["./kaart-meten.component.scss"],
})
export class KaartMetenComponent
  extends KaartModusDirective
  implements OnInit, OnDestroy {
  @Output()
  getekendeGeom: EventEmitter<ol.geom.Geometry> = new EventEmitter();

  private toonInfoBoodschap = true;
  private meerdereGeometrieen = true;
  private stopTekenenSubj: rx.Subject<void> = new rx.Subject<void>();
  private openBoodschappen: Set<string> = new Set();
  private eersteIsGetekend = false;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    this.runInViewReady(
      rx.merge(
        this.wordtActief$.pipe(tap(() => this.startMetMeten())), //
        this.wordtInactief$.pipe(tap(() => this.stopMeten()))
      )
    );
  }

  modus(): string {
    return MetenUiSelector;
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.bindToLifeCycle(this.modusOpties$(defaultOpties)).subscribe(
      (opties) => {
        this.toonInfoBoodschap = opties.toonInfoBoodschap;
        this.meerdereGeometrieen = opties.meerdereGeometrieen;
      }
    );
  }

  ngOnDestroy(): void {
    this.stopMetenEnVerbergBoodschapen();
    super.ngOnDestroy();
  }

  private startMetMeten(): void {
    const boodschapVanMeten = (boodschap) =>
      boodschap.bron.exists((bron) => bron === "meten");

    this.eersteIsGetekend = false;

    this.bindToLifeCycle(
      this.internalMessage$.lift(
        internalMsgSubscriptionCmdOperator(
          this.kaartComponent.internalCmdDispatcher,
          prt.GeometryChangedSubscription(
            TekenSettings(
              ol.geom.GeometryType.POLYGON,
              option.none,
              option.none,
              option.none,
              this.meerdereGeometrieen
            ),
            tekenResultaatWrapper
          )
        )
      )
    )
      .pipe(takeUntil(this.stopTekenenSubj))
      .subscribe(
        (err) =>
          kaartLogger.error("De meten subscription gaf een logische fout", err),
        (err) =>
          kaartLogger.error(
            "De meten subscription gaf een technische fout",
            err
          ),
        () => kaartLogger.debug("De meten source is gestopt")
      );

    // Hou de ids van de meten infoboxen bij, we hebben die later nodig om ze allemaal te sluiten.
    this.bindToLifeCycle(
      this.internalMessage$.pipe(
        ofType<InfoBoodschappenMsg>("InfoBoodschappen"), //
        map((msg) =>
          Array.from(
            maps.filter(msg.infoBoodschappen, boodschapVanMeten).keys()
          )
        )
      )
    ).subscribe((boodschappen) => {
      this.openBoodschappen = new Set(boodschappen);
      if (this.eersteIsGetekend && sets.isEmpty(this.openBoodschappen)) {
        // Wanneer alle info-boxen van meten gesloten zijn, kan je stoppen met meten.
        // Maar dit mag alleen als we al eens 1 info-box van meten gehad hebben.
        this.stopMeten();
        this.eersteIsGetekend = false;
        this.zetModeAf();
      } else if (sets.isNonEmpty(this.openBoodschappen)) {
        this.eersteIsGetekend = true;
      }
    });

    // Update de informatie van de geometrie.
    this.internalMessage$
      .pipe(
        ofType<GeometryChangedMsg>("GeometryChanged"), //
        observeOnAngular(this.zone)
      )
      .subscribe((msg) => {
        const infoSluitCallback = () =>
          option.some(verwijderTekenFeatureWrapper(msg.featureId));

        this.getekendeGeom.next(msg.geometry);
        if (this.toonInfoBoodschap) {
          this.dispatch(
            prt.ToonInfoBoodschapCmd({
              id: "meten-resultaat-" + msg.volgnummer,
              type: "InfoBoodschapAlert",
              titel: "Meten " + msg.volgnummer + ":",
              sluit: "VANZELF",
              bron: option.some("meten"),
              message: this.helpText(msg.geometry),
              iconName: option.some("straighten"),
              verbergMsgGen: infoSluitCallback,
            })
          );
        }
      });
  }

  private stopMeten(): void {
    this.stopTekenenSubj.next(); // zorg dat de unsubscribe gebeurt
    this.stopTekenenSubj = new rx.Subject(); // en maak ons klaar voor de volgende ronde
  }

  private stopMetenEnVerbergBoodschapen(): void {
    this.stopMeten();

    // Sluit alle meten infoboxen.
    this.openBoodschappen.forEach((boodschap) =>
      this.dispatch(prt.VerbergInfoBoodschapCmd(boodschap!))
    );
  }

  helpText(geometry: ol.geom.Geometry): string {
    return dimensieBeschrijving(geometry);
  }
}
