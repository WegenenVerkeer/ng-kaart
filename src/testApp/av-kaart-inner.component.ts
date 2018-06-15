import { Component, Input, OnChanges, SimpleChanges, ViewEncapsulation } from "@angular/core";

import { animate, style, transition, trigger } from "@angular/animations";
import * as ol from "openlayers";

@Component({
  selector: "awv-av-kaart-inner",
  templateUrl: "./av-kaart-inner.component.html",
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ opacity: 0, "max-height": 0 }),
        animate("1.5s cubic-bezier(.25, .8, .25, 1)", style({ opacity: 1, "max-height": "1000px" }))
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "1000px" }),
        animate("0.5s cubic-bezier(.25, .8, .25, 1)", style({ opacity: 0, "max-height": 0 }))
      ])
    ])
  ],
  encapsulation: ViewEncapsulation.None
})
export class AvKaartInnerComponent implements OnChanges {
  @Input() adressen: any[];
  @Input() percelen: any[];
  @Input() weglocaties: any[];
  @Input() breedte: number;
  @Input() hoogte: number;

  wktFormat = new ol.format.WKT();
  adresFeatures: ol.Feature[] = [];
  percelenFeatures: ol.Feature[] = [];
  weglocatieFeatures: ol.Feature[] = [];
  features: ol.Feature[] = [];
  extent: ol.Extent = ol.extent.createEmpty();
  adresStyle = this.maakLayerStijl("#F7902D");
  perceelStyle = this.maakLayerStijl("#68A527");
  weglocatieStyle = this.maakLayerStijl("#24A3C9");

  private static propertyAangepast(property) {
    return property && property.previousValue !== property.currentValue;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      AvKaartInnerComponent.propertyAangepast(changes.adressen) ||
      AvKaartInnerComponent.propertyAangepast(changes.percelen) ||
      AvKaartInnerComponent.propertyAangepast(changes.weglocaties)
    ) {
      this.features = [];

      this.adresFeatures = [];
      if (this.adressen) {
        this.adressen
          .filter(adres => adres.geometrie)
          .map(adres => {
            const adresFeature = this.wktFormat.readFeature(adres.geometrie);
            adresFeature.setStyle(this.adresStyle);
            return adresFeature;
          })
          .forEach(feature => this.adresFeatures.push(feature));
      }

      this.percelenFeatures = [];
      if (this.percelen) {
        this.percelen
          .filter(perceel => perceel.geometrie)
          .map(perceel => {
            const perceelFeature = this.wktFormat.readFeature(perceel.geometrie);
            perceelFeature.setStyle(this.perceelStyle);
            return perceelFeature;
          })
          .forEach(feature => this.percelenFeatures.push(feature));
      }

      this.weglocatieFeatures = [];
      if (this.weglocaties) {
        this.weglocaties
          .filter(weglocatie => weglocatie.geometrie)
          .map(weglocatie => {
            const weglocatieFeature = this.wktFormat.readFeature(weglocatie.geometrie);
            weglocatieFeature.setStyle(this.weglocatieStyle);
            return weglocatieFeature;
          })
          .forEach(feature => this.weglocatieFeatures.push(feature));
      }

      this.features = this.features
        .concat(this.adresFeatures)
        .concat(this.percelenFeatures)
        .concat(this.weglocatieFeatures);
      const extents = this.features.map(feature => feature.getGeometry()).map(geometry => geometry.getExtent());

      this.extent = extents.reduceRight(
        (previousValue, currentValue) => ol.extent.extend(previousValue, currentValue),
        ol.extent.createEmpty()
      );
    }
  }

  maakLayerStijl(kleur: string): ol.style.Style {
    const fill = new ol.style.Fill({
      color: this.zetOpacity(ol.color.asArray(kleur), 0.2)
    });
    const stroke = new ol.style.Stroke({
      color: this.zetOpacity(ol.color.asArray(kleur), 1),
      width: 2
    });
    return new ol.style.Style({
      fill: fill,
      stroke: stroke,
      image: new ol.style.RegularShape({
        fill: fill,
        stroke: stroke,
        points: 5,
        radius: 10,
        radius2: 4,
        angle: 0
      })
      // image: new ol.style.Icon({
      //   anchor: [0.5, 1],
      //   anchorXUnits: "fraction",
      //   anchorYUnits: "fraction",
      //   scale: 1,
      //   opacity: 1,
      //   src: "./material-design-icons/maps/svg/production/ic_place_48px.svg"
      // })
    });
  }

  zetOpacity(kleur: ol.Color, opacity): ol.Color {
    // copy, want ol.color.asArray() gebruikt cache
    return [kleur[0], kleur[1], kleur[2], opacity];
  }
}
