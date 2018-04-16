import { Component, Input, OnDestroy, OnInit } from "@angular/core";

import { KaartInternalMsg, KaartInternalSubMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { FormControl } from "@angular/forms";
import { KaartCmdDispatcher, VacuousDispatcher } from "../kaart/kaart-event-dispatcher";
import { none, Option } from "fp-ts/lib/Option";
import { KaartCmdValidation } from "../kaart/kaart-protocol";
import { Subscription } from "rxjs/Subscription";
import * as ke from "../kaart/kaart-elementen";
import * as ol from "openlayers";
import { MapIcons } from "./mapicons/mapicons";
import { ZoekResultaat } from "./abstract-zoeker";
import * as prt from "../kaart/kaart-protocol";
import { ZoekResultaten } from "./index";
import { Observable } from "rxjs/Observable";
import { List } from "immutable";
import { SubscriptionResult } from "../kaart";

const ZoekerLaagNaam = "Zoeker";

@Component({
  selector: "awv-zoeker",
  templateUrl: "./zoeker.component.html",
  styleUrls: ["./zoeker.component.scss"]
})
export class ZoekerComponent implements OnInit, OnDestroy {
  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;
  @Input() internalMessage$: Observable<KaartInternalSubMsg> = Observable.never();

  zoekVeld = new FormControl();
  alleZoekResultaten: ZoekResultaten[] = [];
  toonHelp = false;
  toonResultaat = true;

  private subscription: Option<Subscription> = none;
  private imageStyles: ol.style.Style[] = [];

  constructor() {}

  ngOnInit(): void {
    this.zoekVeld.valueChanges
      .debounceTime(800)
      .distinctUntilChanged()
      .subscribe(value => {
        this.toonResultaat = true;
        this.dispatcher.dispatch({ type: "Zoek", input: value, wrapper: kaartLogOnlyWrapper });
      });
    this.dispatcher.dispatch({
      type: "VoegLaagToe",
      positie: 1,
      laag: this.createLayer(),
      magGetoondWorden: true,
      laaggroep: "Tools",
      wrapper: kaartLogOnlyWrapper
    });
    this.dispatcher.dispatch({
      type: "Subscription",
      subscription: prt.ZoekerSubscription(r => this.processZoekerAntwoord(r)),
      wrapper: v => this.subscribed(v)
    });
  }

  ngOnDestroy(): void {
    this.subscription.map(subscription =>
      this.dispatcher.dispatch({
        type: "Unsubscription",
        subscription: subscription
      })
    );
    this.dispatcher.dispatch(prt.VerwijderLaagCmd(ZoekerLaagNaam, kaartLogOnlyWrapper));
  }

  toggleResultaat() {
    this.toonResultaat = !this.toonResultaat;
  }

  toggleHelp() {
    this.toonHelp = !this.toonHelp;
  }

  processZoekerAntwoord(nieuweResultaten: ZoekResultaten): KaartInternalMsg {
    this.alleZoekResultaten = this.alleZoekResultaten
      .filter(resultaat => resultaat.zoeker !== nieuweResultaten.zoeker)
      .concat(nieuweResultaten);

    const features: List<ol.Feature> = nieuweResultaten.resultaten.reduce(
      (list, resultaat) => list.push(...this.maakNieuwFeature(resultaat)),
      List<ol.Feature>()
    );
    const extent: ol.Extent = features
      .map(feature => feature!.getGeometry().getExtent())
      .reduce((maxExtent, huidigeExtent) => ol.extent.extend(maxExtent!, huidigeExtent!), ol.extent.createEmpty());

    this.dispatcher.dispatch(prt.VervangFeaturesCmd(ZoekerLaagNaam, features, kaartLogOnlyWrapper));
    if (!ol.extent.isEmpty(extent)) {
      this.dispatcher.dispatch(prt.VeranderExtentCmd(extent));
    }

    return {
      type: "KaartInternal",
      payload: none
    };
  }

  maakNieuwFeature(resultaat: ZoekResultaat): ol.Feature[] {
    const feature = new ol.Feature({ data: resultaat, geometry: resultaat.geometry, name: resultaat.omschrijving });
    feature.setId(resultaat.index);
    feature.setStyle(this.styleFunction(feature));

    let middlePoint: ol.geom.Point | undefined = undefined;
    if (resultaat.locatie.type === "MultiLineString") {
      // voeg een puntelement toe ergens op de linestring om een icoon met nummer te tonen
      const lineStrings = resultaat.geometry.getLineStrings();
      const lineString = lineStrings[Math.floor(lineStrings.length / 2)];
      middlePoint = new ol.geom.Point(lineString.getCoordinateAt(0.5));
    } else if (resultaat.locatie.type === "Polygon" || resultaat.locatie.type === "MultiPolygon") {
      // in midden van gemeente polygon
      const extent = resultaat.geometry.getExtent();
      middlePoint = new ol.geom.Point([(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]);
    }
    if (middlePoint !== undefined) {
      const middelpuntFeature = new ol.Feature({
        data: resultaat,
        geometry: middlePoint,
        name: resultaat.omschrijving
      });
      middelpuntFeature.setStyle(this.styleFunction(middelpuntFeature));
      return [feature, middelpuntFeature];
    } else {
      return [feature];
    }
  }

  private styleFunction(feature: ol.Feature | ol.render.Feature): ol.style.Style {
    const data: ZoekResultaat = feature.get("data");
    if (!this.imageStyles[data.index]) {
      this.imageStyles[data.index] = new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: "red",
          width: 1
        }),
        fill: new ol.style.Fill({
          color: [255, 0, 0, 0.2]
        }),
        image: new ol.style.Icon({
          src: this.image(data),
          anchor: [0.5, 1.0]
        })
      });
    }
    return this.imageStyles[data.index];
  }

  subscribed(v: KaartCmdValidation<SubscriptionResult>): KaartInternalMsg {
    this.subscription = v.toOption();
    return {
      type: "KaartInternal",
      payload: none
    };
  }

  image(resultaat: ZoekResultaat) {
    return MapIcons.get("./" + (resultaat.partialMatch ? "partial/" : "") + "number_" + resultaat.index + ".png");
  }

  baseimage(partialMatch: boolean) {
    return MapIcons.get("./" + (partialMatch ? "partial/" : "") + "number_" + 1 + ".png");
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: ZoekerLaagNaam,
      source: new ol.source.Vector(),
      styleSelector: none,
      selecteerbaar: true,
      minZoom: 2,
      maxZoom: 15
    };
  }
}
