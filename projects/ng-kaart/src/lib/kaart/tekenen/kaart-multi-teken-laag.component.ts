import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { Endomorphism, Function1, Function2, Function3, identity, Lazy, pipe, Predicate, Refinement } from "fp-ts/lib/function";
import { fromNullable, fromPredicate, none, Option, option, some } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import { List, OrderedMap } from "immutable";
import { Lens } from "monocle-ts";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { filter, map, scan, startWith, switchMap, switchMapTo, take } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { disc, solidLine } from "../../stijl/common-shapes";
import { isEmpty } from "../../util/arrays";
import { asap } from "../../util/asap";
import { Consumer, PartialFunction1, ReduceFunction } from "../../util/function";
import { subSpy } from "../../util/operators";
import { forEach } from "../../util/option";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { Command, VerwijderLaagCmd } from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";
import * as ss from "../stijl-selector";

import {
  AddPoint,
  AddWaypoint,
  DeletePoint,
  DraggingPoint,
  DrawOps,
  makeRoute,
  MovePoint,
  RemoveWaypoint,
  RouteSegmentOps,
  Waypoint,
  WaypointOps
} from "./tekenen-model";

export const MultiTekenenUiSelector = "MultiKaarttekenen";

const PuntLaagNaam = "MultiTekenPuntLaag"; // De naam van de laag waar de bolletjes, aka Waypoints, geplaatst worden
const SegmentLaagNaam = "MultiTekenSegmentLaag"; // De naam van de laag waar de lijntjes, aka RouteSegments, geplaatst worden

interface DrawState {
  readonly map: ol.Map; // Misschien moeten we de interacties via dispatchCmd op de OL map zetten, dan hebbenn we ze hier niet nodig
  readonly drawInteractions: ol.interaction.Interaction[];
  readonly pointFeatures: ol.Feature[];
  readonly firstPointFeature: Option<ol.Feature>;
  readonly nextId: number;
  readonly dragFeature: Option<ol.Feature>;
  readonly listeners: ol.GlobalObject[];
}

interface WaypointProperties {
  readonly type: "Waypoint";
  readonly previous: Option<ol.Feature>; // Het vorige punt in de dubbelgelinkte lijst van punten
  readonly next: Option<ol.Feature>; // Het volgende punt in de dubbelgelinkte lijst van punten
}

// Onze state is wel immutable, maar de features zelf worden beheerd door OL en die is helemaal niet immutable dus de features
// in pointFeature worden achter onze rug aangepast.
const initialState: Function1<ol.Map, DrawState> = olMap => ({
  map: olMap,
  drawInteractions: [],
  pointFeatures: [],
  firstPointFeature: none,
  nextId: 0,
  dragFeature: none,
  listeners: []
});

const WaypointProperties: Function2<Option<ol.Feature>, Option<ol.Feature>, WaypointProperties> = (previous, next) => ({
  type: "Waypoint",
  next: next,
  previous: previous
});

type DrawLens<A> = Lens<DrawState, A>;
const drawInteractionsLens: DrawLens<ol.interaction.Interaction[]> = Lens.fromProp("drawInteractions");
const pointFeaturesLens: DrawLens<ol.Feature[]> = Lens.fromProp("pointFeatures");
const nextIdLens: DrawLens<number> = Lens.fromProp("nextId");
const incrementNextId: Endomorphism<DrawState> = nextIdLens.modify(n => n + 1);
const dragFeatureLens: DrawLens<Option<ol.Feature>> = Lens.fromProp("dragFeature");
const firstPointFeatureLens: DrawLens<Option<ol.Feature>> = Lens.fromProp("firstPointFeature");
const listenersLens: DrawLens<ol.GlobalObject[]> = Lens.fromProp("listeners");

type PointFeaturePropertyLens<A> = Lens<WaypointProperties, A>;
const nextLens: PointFeaturePropertyLens<Option<ol.Feature>> = Lens.fromProp("next");
const previousLens: PointFeaturePropertyLens<Option<ol.Feature>> = Lens.fromProp("previous");
const replaceNext: Function1<Option<ol.Feature>, Endomorphism<WaypointProperties>> = nextLens.set;
const replacePrevious: Function1<Option<ol.Feature>, Endomorphism<WaypointProperties>> = previousLens.set;

// Een (endo)functie die alle (endo)functies na elkaar uitvoert. Lijkt heel sterk op pipe.
type Combine<S> = Function1<Endomorphism<S>[], Endomorphism<S>>;
const applySequential: Combine<DrawState> = fas => s => fas.reduce((s, fa) => fa(s), s);

const createMarkerStyle: Function1<clr.Kleur, ss.Stylish> = kleur => disc.stylish(kleur, clr.wit, 3, 5);

const createLineStyle: Lazy<ss.Stylish> = () => solidLine.stylish(clr.zwart, 2);

const createLayer: Function2<string, ol.source.Vector, ke.VectorLaag> = (titel, source) => {
  source.set("laagTitel", titel);
  return {
    type: ke.VectorType,
    titel: titel,
    source: source,
    styleSelector: none,
    styleSelectorBron: none,
    selectieStyleSelector: none,
    hoverStyleSelector: none,
    selecteerbaar: false,
    hover: false,
    minZoom: 2,
    maxZoom: 15,
    offsetveld: none, // veel ruis
    velden: OrderedMap<string, ke.VeldInfo>(),
    verwijderd: false,
    rijrichtingIsDigitalisatieZin: false
  };
};

const isTekenLayer: Predicate<ol.layer.Layer> = layer =>
  fromNullable(layer.getSource())
    .chain(source => fromNullable(source.get("laagTitel")))
    .contains(setoidString, PuntLaagNaam);

type FeaturePicker = PartialFunction1<[number, number], ol.Feature>;
const featurePicker: Function1<ol.Map, FeaturePicker> = map => pixel => {
  const featuresAtPixel = map.getFeaturesAtPixel(pixel, { layerFilter: isTekenLayer }) as ol.Feature[];
  return fromNullable(featuresAtPixel).chain(array.head);
};

const isPoint: Refinement<ol.geom.Geometry, ol.geom.Point> = (geom): geom is ol.geom.Point => geom instanceof ol.geom.Point;
const isNumber: Refinement<any, number> = (value): value is number => typeof value === "number";
const isWaypointProperties: Refinement<any, WaypointProperties> = (value): value is WaypointProperties =>
  typeof value === "object" && fromNullable(value.type).exists(type => type === "Waypoint");

const extractCoordinate: PartialFunction1<ol.Feature, ol.Coordinate> = feature =>
  fromPredicate(isPoint)(feature.getGeometry()).map(point => point.getCoordinates());

const extractId: PartialFunction1<ol.Feature, number> = feature => fromNullable(feature.getId()).chain(fromPredicate(isNumber));

const extractWaypointProperties: PartialFunction1<ol.Feature, WaypointProperties> = feature =>
  fromPredicate(isWaypointProperties)(feature.getProperties());

const toWaypoint: PartialFunction1<ol.Feature, Waypoint> = feature =>
  extractId(feature).chain(id => extractCoordinate(feature).map(coordinate => Waypoint(id, coordinate)));

const findPreviousFeature: PartialFunction1<ol.Feature, ol.Feature> = feature => extractWaypointProperties(feature).chain(previousLens.get);

const findNextFeature: PartialFunction1<ol.Feature, ol.Feature> = feature => extractWaypointProperties(feature).chain(nextLens.get);

const findPreviousWaypoint: PartialFunction1<ol.Feature, Waypoint> = feature => findPreviousFeature(feature).chain(toWaypoint);

const selectFilter: ol.SelectFilterFunction = feature => isWaypointProperties(feature.getProperties());

const updatePointProperties: Function1<Endomorphism<WaypointProperties>, Consumer<ol.Feature>> = f => feature =>
  forEach(extractWaypointProperties(feature), props => feature.setProperties(f(props)));

function drawStateTransformer(
  dispatchDrawOps: Consumer<DrawOps>,
  dispatchWaypointOps: Consumer<WaypointOps>,
  dispatchCmd: Consumer<Command<KaartInternalMsg>>,
  state: DrawState,
  ops: DrawOps
): Endomorphism<DrawState> {
  const handleAdd: Consumer<ol.events.Event> = event => {
    forEach(extractCoordinate((event as ol.interaction.Draw.Event).feature), coordinate => dispatchDrawOps(AddPoint(coordinate)));
  };

  // Jammer genoeg hebben we in het move event hieronder geen informatie over welke feature er precies van plaats veranderd is.
  // Daarom maken we een tussentijds event waarin we deze informatie wel hebben. In principe zouden we ook een heleboel move
  // events kunnen genereren, maar dat zou belastend zijn voor de server en flikkeren aan de client.
  const handleFeatureDrag: Consumer<ol.events.Event> = evt => {
    const feature: ol.Feature = evt.target as ol.Feature;
    dispatchDrawOps(DraggingPoint(feature));
  };

  // We krijgen in het event enkel alle features samen. Er is wel een revision methode op een feature, maar om die te gebruiken
  // zouden we ergens de versies van alle features moeten bijhouden. En bovendien zouden we dan alle soorten interacties met die
  // features die de versie ophogen moeten opvangen.
  const handleFeatureMove: Consumer<ol.events.Event> = () => dispatchDrawOps(MovePoint());

  const handleSelect: Consumer<ol.events.Event> = evt => {
    const selectEvent = evt as ol.interaction.Select.Event;
    forEach(
      array.head(selectEvent.selected),
      pipe(
        DeletePoint,
        dispatchDrawOps
      )
    );
  };

  const handlePointermove: Function2<FeaturePicker, ol.source.Vector, Consumer<ol.events.Event>> = (featurePicker, source) => evt => {
    const moveEvent = evt as ol.MapBrowserEvent;
    if (!moveEvent.dragging) {
      forEach(featurePicker(moveEvent.pixel), selectedFeature => {
        array.head(source.getFeatures()).foldL(
          () => source.addFeature(selectedFeature),
          movedFeature => {
            if (movedFeature !== selectedFeature) {
              console.log("****replacing feature");
              source.clear();
              source.addFeature(selectedFeature);
            }
          }
        );
      });
    }
  };

  const sendFullGeometry: Consumer<ol.Feature[]> = features => {
    console.log("****ids", features.map(feature => feature.getId()));
    const maybeLine = array
      .traverse(option)(features, extractCoordinate)
      .map(coordinates => {
        console.log("***coords", coordinates);
        return new ol.geom.LineString(coordinates);
      });
    forEach(maybeLine, line => {
      console.log("***lengte", ol.Sphere.getLength(line));
      dispatchCmd(prt.ZetGetekendeGeometryCmd(line));
    });
  };

  switch (ops.type) {
    case "StartDrawing": {
      const drawSource = new ol.source.Vector();
      const modifySource = new ol.source.Vector();
      const puntStijl = disc.stylish(ops.pointColour, clr.transparant, 1, 5);
      const drawInteraction = new ol.interaction.Draw({
        type: "Point",
        freehandCondition: ol.events.condition.never,
        style: puntStijl
      });
      const modifyInteraction = new ol.interaction.Modify({
        source: modifySource,
        style: disc.stylish(clr.transparant, clr.transparant, 0, 0),
        deleteCondition: ol.events.condition.never
      });
      const selectInteraction = new ol.interaction.Select({
        condition: ol.events.condition.click,
        filter: selectFilter,
        multi: false
      });
      const drawInteractions = [drawInteraction, modifyInteraction, selectInteraction];
      drawInteraction.on("drawend", handleAdd);
      modifyInteraction.on("modifyend", handleFeatureMove);
      selectInteraction.on("select", handleSelect);
      dispatchCmd({
        type: "VoegLaagToe",
        positie: 0,
        laag: createLayer(SegmentLaagNaam, new ol.source.Vector()),
        magGetoondWorden: true,
        laaggroep: "Tools",
        legende: none,
        stijlInLagenKiezer: none,
        wrapper: kaartLogOnlyWrapper
      });
      dispatchCmd({
        type: "VoegLaagToe",
        positie: 1,
        laag: createLayer(PuntLaagNaam, drawSource),
        magGetoondWorden: true,
        laaggroep: "Tools",
        legende: none,
        stijlInLagenKiezer: none,
        wrapper: kaartLogOnlyWrapper
      });
      drawInteractions.forEach(inter => state.map.addInteraction(inter));
      const moveKey = state.map.on("pointermove", handlePointermove(featurePicker(state.map), modifySource)) as ol.GlobalObject;
      return applySequential([drawInteractionsLens.set(drawInteractions), listenersLens.set([moveKey])]);
    }

    case "StopDrawing": {
      dispatchCmd(VerwijderLaagCmd(PuntLaagNaam, kaartLogOnlyWrapper));
      dispatchCmd(VerwijderLaagCmd(SegmentLaagNaam, kaartLogOnlyWrapper));
      state.drawInteractions.forEach(inter => state.map.removeInteraction(inter));
      state.listeners.forEach(key => ol.Observable.unByKey(key));
      return identity; // Hierna gooien we onze state toch weg -> mag corrupt zijn
    }

    case "AddPoint": {
      const currentFeatures = pointFeaturesLens.get(state);
      const lastFeature = array.last(currentFeatures);
      const feature = new ol.Feature(new ol.geom.Point(ops.coordinate));
      feature.setId(state.nextId);
      feature.setStyle(createMarkerStyle(clr.zwartig));
      feature.setProperties(WaypointProperties(lastFeature, none));
      forEach(lastFeature, updatePointProperties(replaceNext(some(feature))));
      feature.on("change", handleFeatureDrag);
      const newFeatures = array.snoc(currentFeatures, feature);
      dispatchWaypointOps(AddWaypoint(lastFeature.chain(toWaypoint), Waypoint(state.nextId, ops.coordinate)));
      dispatchCmd(prt.VervangFeaturesCmd(PuntLaagNaam, List(newFeatures), kaartLogOnlyWrapper));
      sendFullGeometry(newFeatures);
      return applySequential([
        pointFeaturesLens.set(newFeatures),
        firstPointFeatureLens.modify(fp => fp.orElse(() => some(feature))), // als er geen eerste punt was, dan is het huidige het eerste
        incrementNextId
      ]);
    }

    case "DraggingPoint": {
      // Deze operatie is hier omdat we in de move event anders niet weten welk punt er verplaatst is.
      // Er is nog een bijkomende complicatie: wanneer 2 of meer features over elkaar liggen, dan worden die door de Modify
      // interaction allemaal verplaatst. Dat willen we niet. We kunnen dit opvangen door maar 1 drag toe te laten. We krijgen
      // immers een event voor elk punt. Elk punt na het eerste dat we zien, zetten we terug op zijn originele plaats.
      return dragFeatureLens.set(some(ops.feature));
    }

    case "MovePoint": {
      console.log("***moved", ops);
      return dragFeatureLens
        .get(state)
        .chain(draggedFeature =>
          toWaypoint(draggedFeature).map(current => {
            // laat onze subscriber weten dat er een punt verplaatst is
            const previous = findPreviousWaypoint(draggedFeature);
            dispatchWaypointOps(RemoveWaypoint(current));
            dispatchWaypointOps(AddWaypoint(previous, current));
            sendFullGeometry(pointFeaturesLens.get(state));
            return dragFeatureLens.set(none);
          })
        )
        .getOrElse(identity);
    }

    case "DeletePoint": {
      console.log("***te verwijderen", ops.feature, ops.feature.getId());
      const maybePrevious = findPreviousFeature(ops.feature);
      const maybeNext = findNextFeature(ops.feature);
      // Het eerste punt mag niet verwijderd worden. Een klik op het eerste punt zal daarentegen een punt toevoegen zodat de polygon quasi
      // gesloten is. Het eerste punt is, uiteraard, het enige punt dat geen vorig punt heeft.
      return maybePrevious
        .map(previous => {
          updatePointProperties(replaceNext(maybeNext))(previous);
          forEach(maybeNext, updatePointProperties(replacePrevious(maybePrevious)));
          const newFeatures = array.filter(state.pointFeatures, f => f.getId() !== ops.feature.getId());
          (state.drawInteractions[2] as ol.interaction.Select).getFeatures().clear(); // Hack. Beter: select interactie afzonderlijk opslaan
          dispatchCmd(prt.VervangFeaturesCmd(PuntLaagNaam, List(newFeatures), kaartLogOnlyWrapper));
          sendFullGeometry(newFeatures);
          return applySequential([
            pointFeaturesLens.set(newFeatures),
            firstPointFeatureLens.modify(fp => (isEmpty(newFeatures) ? none : fp))
          ]);
        })
        .getOrElseL(() => {
          // Maak een Add command obv de coordinaten van de geklikte feature.
          forEach(extractCoordinate(ops.feature), coords => dispatchDrawOps(AddPoint(coords)));
          return identity;
        });
    }
  }
}

const drawOpsReducer: Function3<
  Consumer<DrawOps>,
  Consumer<WaypointOps>,
  Consumer<Command<KaartInternalMsg>>,
  ReduceFunction<DrawState, DrawOps>
> = (dispatchDrawOps, dispatchWaypointOps, dispatchCmd) => (state, ops) =>
  drawStateTransformer(dispatchDrawOps, dispatchWaypointOps, dispatchCmd, state, ops)(state);

interface RouteSegmentState {
  readonly [id: number]: ol.Feature;
}

const featuresIn: Function1<RouteSegmentState, List<ol.Feature>> = state => List(Object.values(state));

const addFeature: Function3<RouteSegmentState, number, ol.Feature, RouteSegmentState> = (state, id, feature) => {
  const cloned = { ...state };
  cloned[id] = feature;
  return cloned;
};

const removeFeature: Function2<RouteSegmentState, number, RouteSegmentState> = (state, id) => {
  const cloned = { ...state };
  delete cloned[id];
  return cloned;
};

const routeSegementReducer: Function1<
  Consumer<prt.Command<KaartInternalMsg>>,
  ReduceFunction<RouteSegmentState, RouteSegmentOps>
> = dispatchCmd => (state, ops) => {
  function handleOps(): RouteSegmentState {
    switch (ops.type) {
      case "AddRouteSegment":
        const line = new ol.Feature(ops.geom);
        line.setStyle(createLineStyle());
        return addFeature(state, ops.id, line);
      case "RemoveRouteSegment":
        return removeFeature(state, ops.id);
    }
  }

  // In dit geval is er een 1-op-1 mapping tussen de state en de commands die we moeten sturen.
  // De state is nl gewoon de set van features die getekend moeten worden.
  const newState = handleOps();
  dispatchCmd(prt.VervangFeaturesCmd(SegmentLaagNaam, featuresIn(newState), kaartLogOnlyWrapper));
  return newState;
};

@Component({
  selector: "awv-kaart-multi-teken-laag",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-teken-laag.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartMultiTekenLaagComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private readonly internalDrawOpsSubj: rx.Subject<DrawOps> = new rx.Subject();

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    // Trek de OL map binnen, zodat we niet voor alles een boodschap naar de globale kaart reducer moeten dispatchen.
    // We moeten er dan wel voor zorgen dat we alle resources mooi opkuisen.
    const olMap$ = this.kaartModel$.pipe(
      map(m => m.map),
      take(1)
    );

    // breng de externe DrawOps (start & stop) samen met de interne DrawOps
    const drawEffects$ = rx.merge(this.modelChanges.tekenenOps$, this.internalDrawOpsSubj);

    // Een event dat helpt om alle state te resetten
    const drawingStarts$ = drawEffects$.pipe(filter(ops => ops.type === "StartDrawing"));

    // Maak een subject waar de drawReducer kan in schrijven
    const waypointObsSubj: rx.Subject<WaypointOps> = new rx.Subject();

    // vorm een state + een event om tot een nieuwe state en wat side-effects op de OL map
    const drawReducer$ = olMap$.pipe(
      switchMap(olMap =>
        drawingStarts$.pipe(
          switchMap(startCmd =>
            subSpy("***drawEffects")(drawEffects$).pipe(
              startWith(startCmd), // We mogen ons startcommando niet verliezen omdat daar configuratie in zit
              scan(
                drawOpsReducer(
                  ops => asap(() => this.internalDrawOpsSubj.next(ops)),
                  ops => asap(() => waypointObsSubj.next(ops)),
                  cmd => this.dispatch(cmd)
                ),
                initialState(olMap)
              )
            )
          )
        )
      )
    );

    // Laat de segmenten berekenen
    const routeSegmentOps$: rx.Observable<RouteSegmentOps> = subSpy("***waypointOps")(waypointObsSubj).pipe(makeRoute);
    const routeSegmentReducer$ = drawingStarts$.pipe(
      switchMapTo(subSpy("***routeSegmentOps")(routeSegmentOps$).pipe(scan(routeSegementReducer(cmd => this.dispatch(cmd)), {})))
    );

    // Zorg er voor dat de operaties verwerkt worden vanaf het moment dat de component geïnitialiseerd is.
    this.viewReady$.pipe(switchMap(() => rx.merge(drawReducer$, routeSegmentReducer$))).subscribe();
  }
}
