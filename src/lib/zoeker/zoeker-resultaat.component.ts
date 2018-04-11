import { Component, Input, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "../kaart/kaart-classic.component";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { none, Option, some } from "fp-ts/lib/Option";
import { ZoekResultaten } from "./index";
import { Subscription } from "rxjs/Subscription";
import { KaartCmdValidation } from "../kaart/kaart-protocol";
import { SubscriptionResult } from "../kaart/kaart-protocol";
import { ZoekResultaat } from "./abstract-zoeker";
import * as ol from "openlayers";
import * as ke from "../kaart/kaart-elementen";
import { List, Map } from "immutable";
import { MapIcons } from "./mapicons/mapicons";

const ZoekerLaagNaam = "Zoeker";

@Component({
  selector: "awv-zoeker-resultaat",
  templateUrl: "./zoeker-resultaat.component.html",
  styleUrls: ["./zoeker-resultaat.component.scss"]
})
export class ZoekerResultaatComponent implements OnInit, OnDestroy {
  subscription: Option<Subscription> = none;
  alleZoekResultaten: ZoekResultaten[] = [];

  private imageStyles: ol.style.Style[] = [];

  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    // Moet delayed worden, anders wordt de laagselector niet getoond!
    setTimeout(
      () =>
        this.kaart.dispatch({
          type: "VoegLaagToe",
          positie: 1,
          laag: this.createLayer(),
          magGetoondWorden: true,
          laaggroep: "Tools",
          wrapper: kaartLogOnlyWrapper
        }),
      0
    );
    this.kaart.dispatch({
      type: "Subscription",
      subscription: prt.ZoekerSubscription(r => this.processZoekerAntwoord(r)),
      wrapper: v => this.subscribed(v)
    });
  }

  ngOnDestroy(): void {
    this.subscription.map(subscription =>
      this.kaart.dispatch({
        type: "Unsubscription",
        subscription: subscription
      })
    );
    this.kaart.dispatch(prt.VerwijderLaagCmd(ZoekerLaagNaam, kaartLogOnlyWrapper));
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

    this.kaart.dispatch(prt.VervangFeaturesCmd(ZoekerLaagNaam, features, kaartLogOnlyWrapper));
    if (!ol.extent.isEmpty(extent)) {
      this.kaart.dispatch(prt.VeranderExtentCmd(extent));
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
