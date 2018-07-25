import { Component, EventEmitter, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { none, some } from "fp-ts/lib/Option";
import { Set } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, startWith, takeUntil } from "rxjs/operators";

import { dimensieBeschrijving } from "../../util/geometries";
import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { TekenSettings } from "../kaart-elementen";
import {
  actieveModusGezetWrapper,
  GeometryChangedMsg,
  InfoBoodschappenMsg,
  KaartInternalMsg,
  tekenResultaatWrapper,
  verwijderTekenFeatureWrapper
} from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";
import { internalMsgSubscriptionCmdOperator } from "../subscription-helper";

export const MetenUiSelector = "Meten";

export interface MetenOpties {
  toonInfoBoodschap: boolean;
  meerdereGeometrieen: boolean;
}

@Component({
  selector: "awv-kaart-meten",
  templateUrl: "./kaart-meten.component.html",
  styleUrls: ["./kaart-meten.component.scss"]
})
export class KaartMetenComponent extends KaartModusComponent implements OnInit, OnDestroy {
  @Output() getekendeGeom: EventEmitter<ol.geom.Geometry> = new EventEmitter();

  private toonInfoBoodschap = true;
  private meerdereGeometrieen = true;
  private stopTekenenSubj: rx.Subject<void> = new rx.Subject<void>();
  private openBoodschappen: Set<string> = Set();

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  modus(): string {
    return MetenUiSelector;
  }

  isDefaultModus() {
    return false;
  }

  activeer(active: boolean) {
    if (active) {
      this.startMetMeten();
    } else {
      this.stopMetenEnVerbergBoodschapen();
    }
  }

  public get isMetenActief(): boolean {
    return this.actief;
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.bindToLifeCycle(
      this.modelChanges.uiElementOpties$.pipe(
        filter(optie => optie.naam === MetenUiSelector),
        map(o => o.opties),
        startWith({
          toonInfoBoodschap: true,
          meerdereGeometrieen: true
        })
      )
    ).subscribe(opties => {
      this.toonInfoBoodschap = opties.toonInfoBoodschap;
      this.meerdereGeometrieen = opties.meerdereGeometrieen;
    });
  }

  ngOnDestroy(): void {
    this.stopMetenEnVerbergBoodschapen();
    super.ngOnDestroy();
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper)];
  }

  toggleMeten(): void {
    if (this.actief) {
      this.stopMetenEnVerbergBoodschapen();
      this.publiceerDeactivatie();
    } else {
      this.startMetMeten();
      this.publiceerActivatie();
    }
  }

  private startMetMeten(): void {
    const boodschapVanMeten = boodschap => boodschap.bron.exists(bron => bron === "meten");

    this.actief = true;

    this.bindToLifeCycle(
      this.internalMessage$.lift(
        internalMsgSubscriptionCmdOperator(
          this.kaartComponent.internalCmdDispatcher,
          prt.GeometryChangedSubscription(TekenSettings("Polygon", none, none, this.meerdereGeometrieen), tekenResultaatWrapper)
        )
      )
    )
      .pipe(takeUntil(this.stopTekenenSubj))
      .subscribe(
        err => kaartLogger.error("De meten subscription gaf een logische fout", err),
        err => kaartLogger.error("De meten subscription gaf een technische fout", err),
        () => kaartLogger.debug("De meten source is gestopt")
      );

    // Wanneer alle info-boxen van meten gesloten zijn, kan je stoppen met meten.
    this.bindToLifeCycle(
      this.internalMessage$.pipe(
        ofType<InfoBoodschappenMsg>("InfoBoodschappen"), //
        map(msg =>
          msg.infoBoodschappen
            .valueSeq()
            .filter(boodschapVanMeten)
            .isEmpty()
        ),
        distinctUntilChanged(),
        filter(value => value)
      )
    ).subscribe(() => this.stopMeten());

    // Hou de ids van de meten infoboxen bij, we hebben die later nodig om ze allemaal te sluiten.
    this.bindToLifeCycle(
      this.internalMessage$.pipe(
        ofType<InfoBoodschappenMsg>("InfoBoodschappen"), //
        map(msg => msg.infoBoodschappen.filter(boodschapVanMeten).keySeq())
      )
    ).subscribe(boodschappen => {
      this.openBoodschappen = boodschappen.toSet();
    });

    // Update de informatie van de geometrie.
    this.internalMessage$
      .pipe(
        ofType<GeometryChangedMsg>("GeometryChanged"), //
        observeOnAngular(this.zone)
      )
      .subscribe(msg => {
        const infoSluitCallback = () => some(verwijderTekenFeatureWrapper(msg.featureId));

        this.getekendeGeom.next(msg.geometry);
        if (this.toonInfoBoodschap) {
          this.dispatch(
            prt.ToonInfoBoodschapCmd({
              id: "meten-resultaat-" + msg.volgnummer,
              type: "InfoBoodschapAlert",
              titel: "Meten " + msg.volgnummer + ":",
              sluit: "VANZELF",
              bron: some("meten"),
              message: this.helpText(msg.geometry),
              verbergMsgGen: infoSluitCallback
            })
          );
        }
      });
  }

  private stopMeten(): void {
    this.actief = false;

    this.stopTekenenSubj.next(); // zorg dat de unsubscribe gebeurt
    this.stopTekenenSubj = new rx.Subject(); // en maak ons klaar voor de volgende ronde
  }

  private stopMetenEnVerbergBoodschapen(): void {
    this.stopMeten();

    // Sluit alle meten infoboxen.
    this.openBoodschappen.forEach(boodschap => this.dispatch(prt.VerbergInfoBoodschapCmd(boodschap!)));
  }

  helpText(geometry: ol.geom.Geometry): string {
    return dimensieBeschrijving(geometry);
  }
}
