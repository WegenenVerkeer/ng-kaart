import { Directive, Injector, Input, OnChanges, SimpleChanges } from "@angular/core";
import { option } from "fp-ts";
import * as rx from "rxjs";

import { forChangedValue } from "../../kaart/kaart-base.directive";
import * as ke from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import * as ss from "../../kaart/stijl-selector";
import { getDefaultHoverStyleFunction, getDefaultSelectionStyleFunction, getDefaultStyleFunction } from "../../kaart/styles";
import * as arrays from "../../util/arrays";
import { Consumer1 } from "../../util/function";
import * as ol from "../../util/openlayers-compat";
import { forEach, fromValidation } from "../../util/option";
import { TypedRecord } from "../../util/typed-record";
import { logOnlyWrapper } from "../messages";
import * as val from "../webcomponent-support/params";

import { ClassicLaagDirective } from "./classic-laag.directive";

@Directive()
export abstract class ClassicVectorLaagLikeDirective extends ClassicLaagDirective implements OnChanges {
  @Input()
  style?: ol.style.Style = undefined; // heeft voorrang op styleFunction
  @Input()
  styleFunction?: ol.style.StyleFunction = getDefaultStyleFunction(); // TODO combineren met style tot type Stylish
  @Input()
  clusterStyleFunction?: ol.style.StyleFunction = undefined;
  @Input()
  selectieStyle?: ss.Stylish = getDefaultSelectionStyleFunction();
  @Input()
  hoverStyle?: ss.Stylish = getDefaultHoverStyleFunction();
  private refreshTriggerSub: rx.Subscription = new rx.Subscription();
  @Input()
  set refreshTrigger(obs: rx.Observable<void>) {
    this.refreshTriggerSub.unsubscribe();
    this.refreshTriggerSub = this.bindToLifeCycle(obs).subscribe(() => {
      forEach(this.laag.chain(ke.asVectorLaag), laag => {
        forEach(ke.asNosqlSource(laag.source), source => source.clearPrevExtent());
        laag.source.clear();
        laag.source.refresh();
      });
    });
  }

  _stijlSpec: option.Option<ss.AwvV0StyleSpec> = option.none; // heeft voorrang op style
  _clusterDistance: option.Option<number> = option.none;
  _clusterMinSize = 15;
  _clusterSizeFactor = 0;
  _clusterTextColor = "black";
  _clusterCircleColor = "yellow";
  _clusterCircleStrokeColor = "black";
  _zichtbaar = true;
  _selecteerbaar = true;
  _hover = false;
  _offsetveld: option.Option<string> = option.none;
  _minZoom = 7;
  _maxZoom = 15;

  @Input()
  set stijlSpec(param: ss.AwvV0StyleSpec) {
    this._stijlSpec = val.optStyleSpec(param);
  }

  @Input()
  set clusterDistance(param: number) {
    this._clusterDistance = val.optNum(param);
  }

  @Input()
  set clusterMinSize(param: number) {
    this._clusterMinSize = option.fromNullable(param).getOrElse(this._clusterMinSize);
  }

  @Input()
  set clusterSizeFactor(param: number) {
    this._clusterSizeFactor = option.fromNullable(param).getOrElse(this._clusterSizeFactor);
  }

  @Input()
  set clusterTextColor(param: string) {
    this._clusterTextColor = option.fromNullable(param).getOrElse(this._clusterTextColor);
  }

  @Input()
  set clusterCircleColor(param: string) {
    this._clusterCircleColor = option.fromNullable(param).getOrElse(this._clusterCircleColor);
  }

  @Input()
  set clusterCircleStrokeColor(param: string) {
    this._clusterCircleStrokeColor = option.fromNullable(param).getOrElse(this._clusterCircleStrokeColor);
  }

  @Input()
  set zichtbaar(param: boolean) {
    this._zichtbaar = val.bool(param, this._zichtbaar);
  }

  @Input()
  set selecteerbaar(param: boolean) {
    this._selecteerbaar = val.bool(param, this._selecteerbaar);
  }

  @Input()
  set hover(param: boolean) {
    this._hover = val.bool(param, this._hover);
  }

  @Input()
  set offsetveld(param: string) {
    this._offsetveld = val.optStr(param);
  }

  constructor(injector: Injector) {
    super(injector);
  }

  laaggroep(): ke.Laaggroep {
    return "Voorgrond.Hoog";
  }

  protected getMaybeStyleSelectorBron(): option.Option<ss.AwvV0StyleSpec> {
    return this._stijlSpec;
  }

  protected getMaybeStyleSelector(): option.Option<ss.StyleSelector> {
    return option
      .fromNullable(this.clusterStyleFunction)
      .map(ss.DynamicStyle)
      .orElse(() => {
        const maybeUnclusteredStyleSelector = this._stijlSpec
          .chain(spec => fromValidation(ss.validateAwvV0StyleSpec(spec)))
          .orElse(() => option.fromNullable(this.style))
          .orElse(() => option.fromNullable(this.styleFunction))
          .chain(ss.asStyleSelector);

        const maybeClusterStyleSelector = this._clusterDistance.chain(_ =>
          maybeUnclusteredStyleSelector.map(unclusteredStylish => ss.DynamicStyle(this.clusterStyle(unclusteredStylish)))
        );
        return maybeClusterStyleSelector.orElse(() => maybeUnclusteredStyleSelector);
      });
  }

  /** @ignore */
  ngOnChanges(changes: SimpleChanges) {
    const dispatch: Consumer1<prt.Command<TypedRecord>> = cmd => this.kaart.dispatch(cmd);
    forChangedValue<boolean, boolean>(
      changes,
      "zichtbaar",
      zichtbaar =>
        dispatch(
          zichtbaar ? prt.MaakLaagZichtbaarCmd(this._titel, logOnlyWrapper) : prt.MaakLaagOnzichtbaarCmd(this._titel, logOnlyWrapper)
        ),
      (value: boolean) => val.bool(value, this._zichtbaar)
    );
    forChangedValue<boolean, boolean>(
      changes,
      "selecteerbaar",
      selecteerbaar => dispatch(prt.ZetLaagSelecteerbaarCmd(this._titel, selecteerbaar, logOnlyWrapper)),
      (value: boolean) => val.bool(value, this._selecteerbaar)
    );
  }

  clusterStyle(defaultStyleSelector: ss.StyleSelector): ol.style.StyleFunction {
    return (feature, resolution) => {
      return option
        .fromNullable(feature.get("features"))
        .filter(arrays.isArray)
        .filter(arrays.isNonEmpty)
        .map(features => {
          const size = features.length;

          if (size > 1) {
            return new ol.style.Style({
              image: new ol.style.Circle({
                radius: Math.max(this._clusterMinSize, this._clusterSizeFactor * size),
                stroke: new ol.style.Stroke({
                  color: this._clusterCircleStrokeColor,
                  width: 1.5
                }),
                fill: new ol.style.Fill({
                  color: this._clusterCircleColor
                })
              }),
              text: new ol.style.Text({
                text: size.toString(),
                fill: new ol.style.Fill({
                  color: this._clusterTextColor
                })
              })
            });
          } else {
            return ss.matchStyleSelector(s => s.style, s => s.styleFunction(features[0], resolution), s => s.styles)(defaultStyleSelector);
          }
        })
        .getOrElseL(() => {
          throw new Error("Voor cluster stijl hebben we geclusterde features nodig");
        });
    };
  }

  voegLaagToe() {
    super.voegLaagToe();

    forEach(this.getMaybeStyleSelector(), styleselector => {
      this.dispatch(
        prt.ZetStijlVoorLaagCmd(
          this._titel,
          styleselector,
          option.fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
          logOnlyWrapper
        )
      );
    });
  }
}
