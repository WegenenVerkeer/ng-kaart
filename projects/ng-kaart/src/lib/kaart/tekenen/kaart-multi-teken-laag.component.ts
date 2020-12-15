import { HttpClient } from "@angular/common/http";
import {
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";
import { array, eq, option, ord } from "fp-ts";
import {
  Endomorphism,
  flow,
  identity,
  Predicate,
  Refinement,
} from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import { Lens, Optional } from "monocle-ts";
import * as rx from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  pairwise,
  sample,
  scan,
  share,
  startWith,
  switchMap,
  take,
  tap,
  timeInterval,
  withLatestFrom,
} from "rxjs/operators";

import { Coordinates } from "../../coordinaten";
import * as clr from "../../stijl/colour";
import { disc, solidLine } from "../../stijl/common-shapes";
import { Transparantie } from "../../transparantieeditor/transparantie";
import { eqCoordinate } from "../../util";
import { asap } from "../../util/asap";
import {
  applySequential,
  Consumer1,
  PartialFunction1,
  ReduceFunction,
} from "../../util/function";
import {
  numberMapOptional,
  NumberMapped,
  removeFromNumberMap,
  removeFromStringMap,
  stringMapOptional,
  StringMapped,
} from "../../util/lenses";
import * as ol from "../../util/openlayers-compat";
import { forEach } from "../../util/option";
import {
  BevraagKaartOpties,
  BevraagKaartUiSelector,
} from "../kaart-bevragen/kaart-bevragen-opties";
import { KaartChildDirective } from "../kaart-child.directive";
import * as ke from "../kaart-elementen";
import {
  KaartInternalMsg,
  kaartLogOnlyWrapper,
} from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import {
  Command,
  DrawOpsCmd,
  VerwijderLaagCmd,
} from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";
import * as ss from "../stijl-selector";

import { RouteEvent, RouteEventId } from "./route.msg";
import { RoutingService } from "./routing-service";
import {
  GetekendeRoute,
  getekendeRoute,
  routingRapport,
  RoutingRapport,
} from "./teken.api";
import {
  AddPoint,
  DeletePoint,
  DraggingPoint,
  DrawOps,
  isRedrawRoute,
  isStartDrawing,
  MovePoint,
  RedrawRoute,
  SnapWaypoint,
  StartDrawing,
  StopDrawing,
} from "./tekenen-model";
import {
  customRoutes,
  directeRoutes,
  routesViaRoutering,
} from "./waypoint-ops";
import {
  AddWaypoint,
  RemoveWaypoint,
  Waypoint,
  WaypointId,
  WaypointOperation,
} from "./waypoint.msg";

export const MultiTekenenUiSelector = "MultiKaarttekenen";

const PuntLaagNaam = "MultiTekenPuntLaag"; // De naam van de laag waar de bolletjes, aka Waypoints, geplaatst worden
const SegmentLaagNaam = "MultiTekenSegmentLaag"; // De naam van de laag waar de lijntjes, aka RouteSegments, geplaatst worden

interface DrawState {
  readonly map: ol.Map; // Misschien moeten we de interacties via dispatchCmd op de OL map zetten, dan hebbenn we ze hier niet nodig
  readonly featureColour: clr.Kleur;
  readonly drawInteractions: ol.interaction.Interaction[];
  readonly selectInteraction: option.Option<ol.interaction.Select>;
  readonly pointFeatures: ol.Feature[];
  readonly nextId: number;
  readonly dragFeature: option.Option<ol.Feature>;
  readonly listeners: ol.events.EventsKey[];
}

interface PointProperties {
  readonly type: "Waypoint";
  readonly previous: option.Option<ol.Feature>; // Het vorige punt in de dubbelgelinkte lijst van punten
  readonly next: option.Option<ol.Feature>; // Het volgende punt in de dubbelgelinkte lijst van punten
}

// Onze state is wel immutable, maar de features zelf worden beheerd door OL en die is helemaal niet immutable dus de features
// in pointFeature worden achter onze rug aangepast.
const initialState: (arg: ol.Map) => DrawState = (olMap) => ({
  map: olMap,
  featureColour: clr.zwartig,
  drawInteractions: [],
  selectInteraction: option.none,
  pointFeatures: [],
  nextId: 0,
  dragFeature: option.none,
  listeners: [],
});

const PointProperties: (
  arg1: option.Option<ol.Feature>,
  arg2: option.Option<ol.Feature>
) => PointProperties = (previous, next) => ({
  type: "Waypoint",
  next: next,
  previous: previous,
});

type DrawLens<A> = Lens<DrawState, A>;
const drawInteractionsLens: DrawLens<
  ol.interaction.Interaction[]
> = Lens.fromProp<DrawState>()("drawInteractions");
const selectInteractionLens: DrawLens<option.Option<
  ol.interaction.Select
>> = Lens.fromProp<DrawState>()("selectInteraction");
const pointFeaturesLens: DrawLens<ol.Feature[]> = Lens.fromProp<DrawState>()(
  "pointFeatures"
);
const nextIdLens: DrawLens<number> = Lens.fromProp<DrawState>()("nextId");
const incrementNextId: Endomorphism<DrawState> = nextIdLens.modify(
  (n) => n + 1
);
const dragFeatureLens: DrawLens<option.Option<ol.Feature>> = Lens.fromProp<
  DrawState
>()("dragFeature");
const listenersLens: DrawLens<ol.events.EventsKey[]> = Lens.fromProp<
  DrawState
>()("listeners");
const featureColourLens: DrawLens<clr.Kleur> = Lens.fromProp<DrawState>()(
  "featureColour"
);

type PointFeaturePropertyLens<A> = Lens<PointProperties, A>;
const nextLens: PointFeaturePropertyLens<option.Option<
  ol.Feature
>> = Lens.fromProp<PointProperties>()("next");
const previousLens: PointFeaturePropertyLens<option.Option<
  ol.Feature
>> = Lens.fromProp<PointProperties>()("previous");
const replaceNext: (
  arg: option.Option<ol.Feature>
) => Endomorphism<PointProperties> = nextLens.set;
const replacePrevious: (
  arg: option.Option<ol.Feature>
) => Endomorphism<PointProperties> = previousLens.set;

const createMarkerStyle: (arg: clr.Kleur) => ss.Stylish = (colour) =>
  disc.stylish(colour, clr.wit, 3, 5);

const createLineStyle: (arg: clr.Kleur) => ss.Stylish = (colour) =>
  solidLine.stylish(colour, 2);

const createLayer: (arg1: string, arg2: ol.source.Vector) => ke.VectorLaag = (
  titel,
  source
) => {
  source.set("laagTitel", titel);
  return {
    type: ke.VectorType,
    titel: titel,
    source: source,
    clusterDistance: option.none,
    styleSelector: option.none,
    styleSelectorBron: option.none,
    selectieStyleSelector: option.none,
    hoverStyleSelector: option.none,
    selecteerbaar: false,
    hover: false,
    minZoom: 2,
    maxZoom: 15,
    offsetveld: option.none, // veel ruis
    velden: new Map<string, ke.VeldInfo>(),
    verwijderd: false,
    rijrichtingIsDigitalisatieZin: false,
    filter: option.none,
  };
};

const isTekenLayer: Predicate<ol.layer.Layer> = (layer) =>
  pipe(
    option.fromNullable(ke.underlyingSource(layer)),
    option.chain((source) => option.fromNullable(source.get("laagTitel"))),
    (ma) => option.elem(eq.eqString)(PuntLaagNaam, ma)
  );

type FeaturePicker = PartialFunction1<ol.Pixel, ol.Feature>;
const featurePicker: (arg: ol.Map) => FeaturePicker = (map) => (pixel) => {
  const featuresAtPixel = map.getFeaturesAtPixel(pixel, {
    layerFilter: isTekenLayer,
  }) as ol.Feature[];
  return pipe(option.fromNullable(featuresAtPixel), option.chain(array.head));
};

const isPoint: Refinement<ol.geom.Geometry, ol.geom.Point> = (
  geom
): geom is ol.geom.Point => geom instanceof ol.geom.Point;
const isNumber: Refinement<any, number> = (value): value is number =>
  typeof value === "number";
const isWaypointProperties: Refinement<any, PointProperties> = (
  value
): value is PointProperties =>
  typeof value === "object" &&
  pipe(
    option.fromNullable(value.type),
    option.exists((type) => type === "Waypoint")
  );

const extractCoordinate: PartialFunction1<ol.Feature, ol.Coordinate> = (
  feature
) =>
  pipe(
    feature.getGeometry(),
    option.fromNullable,
    option.filter(isPoint),
    option.map((point) => point.getFirstCoordinate())
  );

const extractId: PartialFunction1<ol.Feature, number> = (feature) =>
  pipe(
    option.fromNullable(feature.getId()),
    option.chain(option.fromPredicate(isNumber))
  );

const extractPointProperties: PartialFunction1<ol.Feature, PointProperties> = (
  feature
) => option.fromPredicate(isWaypointProperties)(feature.getProperties());

const toWaypoint: PartialFunction1<ol.Feature, Waypoint> = (feature) =>
  pipe(
    extractId(feature),
    option.chain((id) =>
      pipe(
        extractCoordinate(feature),
        option.map((coordinate) => Waypoint(id, coordinate))
      )
    )
  );

const findPreviousFeature: PartialFunction1<ol.Feature, ol.Feature> = (
  feature
) => pipe(extractPointProperties(feature), option.chain(previousLens.get));

const findNextFeature: PartialFunction1<ol.Feature, ol.Feature> = (feature) =>
  pipe(extractPointProperties(feature), option.chain(nextLens.get));

const findPreviousWaypoint: PartialFunction1<ol.Feature, Waypoint> = (
  feature
) => pipe(findPreviousFeature(feature), option.chain(toWaypoint));

const selectFilter: ol.interaction.SelectFilterFunction = (feature) =>
  isWaypointProperties(feature.getProperties());

const updatePointProperties: (
  arg: Endomorphism<PointProperties>
) => Consumer1<ol.Feature> = (f) => (feature) =>
  forEach(extractPointProperties(feature), (props) =>
    feature.setProperties(f(props))
  );

function drawStateTransformer(
  dispatchDrawOps: Consumer1<DrawOps>,
  dispatchWaypointOps: Consumer1<WaypointOperation>,
  dispatchCmd: Consumer1<Command<KaartInternalMsg>>,
  state: DrawState,
  ops: DrawOps
): Endomorphism<DrawState> {
  const handleAdd: Consumer1<ol.events.Event> = (event) => {
    const drawEvent = event as ol.interaction.DrawEvent;
    const maybeCurrentCoordinate = extractCoordinate(drawEvent.feature);
    forEach(maybeCurrentCoordinate, (coordinate) =>
      dispatchDrawOps(AddPoint(coordinate))
    );
  };

  // Jammer genoeg hebben we in het move event hieronder geen informatie over welke feature er precies van plaats veranderd is.
  // Daarom maken we een tussentijds event waarin we deze informatie wel hebben. In principe zouden we ook een heleboel move
  // events kunnen genereren, maar dat zou belastend zijn voor de server en flikkeren aan de client.
  const handleFeatureDrag: Consumer1<ol.events.Event> = (evt) => {
    const feature: ol.Feature = evt.target as ol.Feature;
    dispatchDrawOps(DraggingPoint(feature));
  };

  // We krijgen in het event enkel alle features samen. Er is wel een revision methode op een feature, maar om die te gebruiken
  // zouden we ergens de versies van alle features moeten bijhouden. En bovendien zouden we dan alle soorten interacties met die
  // features die de versie ophogen moeten opvangen.
  const handleFeatureMove: Consumer1<ol.events.Event> = () =>
    dispatchDrawOps(MovePoint());

  const handleDoubleClick: Consumer1<ol.events.Event> = () =>
    dispatchCmd(DrawOpsCmd(StopDrawing()));

  const handleSelect: Consumer1<ol.events.Event> = (evt) => {
    const selectEvent = evt as ol.interaction.SelectEvent;
    forEach(
      array.head(selectEvent.selected),
      flow(DeletePoint, dispatchDrawOps)
    );
  };

  const handlePointermove: (
    arg1: FeaturePicker,
    arg2: ol.source.Vector
  ) => Consumer1<ol.events.Event> = (featurePicker, source) => (evt) => {
    const moveEvent = evt as ol.MapBrowserEvent;
    if (!moveEvent.dragging) {
      forEach(featurePicker(moveEvent.pixel), (selectedFeature) => {
        pipe(
          array.head(source.getFeatures()),
          option.fold(
            () => source.addFeature(selectedFeature),
            (movedFeature) => {
              if (movedFeature !== selectedFeature) {
                source.clear();
                source.addFeature(selectedFeature);
              }
            }
          )
        );
      });
    }
  };

  switch (ops.type) {
    case "StartDrawing": {
      const drawSource = new ol.source.Vector();
      const modifySource = new ol.source.Vector();
      const puntStijl = disc.stylish(ops.featureColour, clr.transparant, 1, 5);
      const drawInteraction = new ol.interaction.Draw({
        type: ol.geom.GeometryType.POINT,
        freehandCondition: ol.events.condition.never,
        style: puntStijl,
        snapTolerance: 5,
      });
      const modifyInteraction = new ol.interaction.Modify({
        source: modifySource,
        style: disc.stylish(clr.transparant, clr.transparant, 0, 0),
        deleteCondition: ol.events.condition.never,
      });
      const selectInteraction = new ol.interaction.Select({
        condition: ol.events.condition.click,
        filter: selectFilter,
        multi: false,
      });
      const drawInteractions = [drawInteraction, modifyInteraction];
      drawInteraction.on("drawend", handleAdd);
      modifyInteraction.on("modifyend", handleFeatureMove);
      selectInteraction.on("select", handleSelect);
      dispatchCmd({
        type: "VoegLaagToe",
        positie: 0,
        laag: createLayer(SegmentLaagNaam, new ol.source.Vector()),
        magGetoondWorden: true,
        transparantie: Transparantie.opaak,
        laaggroep: "Tools",
        legende: option.none,
        stijlInLagenKiezer: option.none,
        filterinstellingen: option.none,
        laagtabelinstellingen: option.none,
        wrapper: kaartLogOnlyWrapper,
      });
      dispatchCmd({
        type: "VoegLaagToe",
        positie: 1,
        laag: createLayer(PuntLaagNaam, drawSource),
        magGetoondWorden: true,
        transparantie: Transparantie.opaak,
        laaggroep: "Tools",
        legende: option.none,
        stijlInLagenKiezer: option.none,
        filterinstellingen: option.none,
        laagtabelinstellingen: option.none,
        wrapper: kaartLogOnlyWrapper,
      });
      drawInteractions.forEach((inter) => state.map.addInteraction(inter));
      state.map.addInteraction(selectInteraction);
      state.map.on("dblclick", handleDoubleClick);
      const moveKey = state.map.on(
        "pointermove",
        handlePointermove(featurePicker(state.map), modifySource)
      );
      return applySequential([
        drawInteractionsLens.set(drawInteractions),
        selectInteractionLens.set(option.some(selectInteraction)),
        listenersLens.set([moveKey]),
        featureColourLens.set(ops.featureColour),
      ]);
    }

    case "EndDrawing": {
      dispatchCmd(VerwijderLaagCmd(PuntLaagNaam, kaartLogOnlyWrapper));
      dispatchCmd(VerwijderLaagCmd(SegmentLaagNaam, kaartLogOnlyWrapper));
      state.drawInteractions.forEach((inter) =>
        state.map.removeInteraction(inter)
      );
      forEach(state.selectInteraction, (inter) =>
        state.map.removeInteraction(inter)
      );
      state.listeners.forEach((key) => ol.observable.unByKey(key));
      return identity; // Hierna gooien we onze state toch weg -> mag corrupt zijn
    }

    case "StopDrawing": {
      state.drawInteractions.forEach((inter) =>
        state.map.removeInteraction(inter)
      );
      forEach(state.selectInteraction, (inter) =>
        state.map.removeInteraction(inter)
      );
      state.listeners.forEach((key) => ol.observable.unByKey(key));
      return applySequential([
        drawInteractionsLens.set([]),
        listenersLens.set([]),
      ]);
    }

    case "RedrawRoute": {
      // De bedoeling is om alle waypoints te behouden, maar de route opnieuw te laten tekenen.
      // Wat we doen is een klein beetje tricky. We sturen alle waypoints opnieuw naar de observer
      // die de route tekent. We rekenen erop dat die observer gereset is vooraleer hij die waypoints
      // binnen krijgt. Dat is zo omdat de dispatch asynchroon gebeurt.
      state.pointFeatures.forEach((feature) => {
        const maybePointProperties = extractPointProperties(feature);
        const maybePreviousPoint: option.Option<Waypoint> = pipe(
          maybePointProperties,
          option.chain((p) => p.previous),
          option.chain(toWaypoint)
        );
        const maybeCurrentWaypoint = toWaypoint(feature);
        forEach(maybeCurrentWaypoint, (currentWaypoint) =>
          dispatchWaypointOps(AddWaypoint(maybePreviousPoint, currentWaypoint))
        );
      });
      return identity; // geen state changes
    }

    case "AddPoint": {
      const currentFeatures = pointFeaturesLens.get(state);
      const lastFeature = array.last(currentFeatures);
      const coordinate = ops.coordinate;
      const feature = new ol.Feature(new ol.geom.Point(coordinate));

      const maybePreviousCoordinate = option.chain(extractCoordinate)(
        lastFeature
      );
      const sameLocationAsPrevious = pipe(
        maybePreviousCoordinate,
        option.exists((p) => p[0] === coordinate[0] && p[1] === coordinate[1])
      );

      // Openlayers (in elk geval zoals wij het gebruiken) heeft de vervelende eigenschap dat het een drawend genereert bij
      // een klik als de muispointer nog niet bewogen is. We voegen dan maw. Nog een extra punt toe opdezelfde locatie. En
      // tegelijkertijd wissen we het punt dat er net voor gezet was. Dat is niet wat we willen. Dat extra punt moet nl. niet
      // toegevoegd worden
      if (!sameLocationAsPrevious) {
        feature.setId(state.nextId);
        feature.setStyle(createMarkerStyle(state.featureColour));
        feature.setProperties(PointProperties(lastFeature, option.none));
        forEach(
          lastFeature,
          updatePointProperties(replaceNext(option.some(feature)))
        );
        feature.on("change", handleFeatureDrag);
        const newFeatures = array.snoc(currentFeatures, feature);
        dispatchWaypointOps(
          AddWaypoint(
            pipe(lastFeature, option.chain(toWaypoint)),
            Waypoint(state.nextId, coordinate)
          )
        );
        dispatchCmd(
          prt.VervangFeaturesCmd(PuntLaagNaam, newFeatures, kaartLogOnlyWrapper)
        );
        return applySequential([
          pointFeaturesLens.set(newFeatures),
          incrementNextId,
        ]);
      } else {
        return identity;
      }
    }

    case "DraggingPoint": {
      // Deze operatie is hier omdat we in de move event anders niet weten welk punt er verplaatst is.
      // Er is nog een bijkomende complicatie: wanneer 2 of meer features over elkaar liggen, dan worden die door de Modify
      // interaction allemaal verplaatst. Dat willen we niet. We kunnen dit opvangen door maar 1 drag toe te laten. We krijgen
      // immers een event voor elk punt. Elk punt na het eerste dat we zien, zetten we terug op zijn originele plaats.
      return dragFeatureLens.set(option.some(ops.feature));
    }

    case "MovePoint": {
      return pipe(
        dragFeatureLens.get(state),
        option.chain((draggedFeature) =>
          pipe(
            toWaypoint(draggedFeature),
            option.map((current) => {
              // laat onze subscriber weten dat er een punt verplaatst is
              const previous = findPreviousWaypoint(draggedFeature);
              dispatchWaypointOps(RemoveWaypoint(current));
              dispatchWaypointOps(AddWaypoint(previous, current));
              return dragFeatureLens.set(option.none);
            })
          )
        ),
        option.getOrElse(() => identity)
      );
    }

    case "DeletePoint": {
      const maybePrevious = findPreviousFeature(ops.feature);
      const maybeNext = findNextFeature(ops.feature);
      // Het eerste punt mag niet verwijderd worden. Een klik op het eerste punt zal daarentegen een punt toevoegen zodat de polygon quasi
      // gesloten is. Het eerste punt is, uiteraard, het enige punt dat geen vorig punt heeft. Dat gebruiken we dus als identificator.
      return pipe(
        maybePrevious,
        option.map((previous) => {
          updatePointProperties(replaceNext(maybeNext))(previous);
          forEach(
            maybeNext,
            updatePointProperties(replacePrevious(maybePrevious))
          );
          const newFeatures = array.filter(
            (f: ol.Feature) => f.getId() !== ops.feature.getId()
          )(state.pointFeatures);
          forEach(state.selectInteraction, (interaction) =>
            interaction.getFeatures().clear()
          );
          dispatchCmd(
            prt.VervangFeaturesCmd(
              PuntLaagNaam,
              newFeatures,
              kaartLogOnlyWrapper
            )
          );
          forEach(
            toWaypoint(ops.feature),
            flow(RemoveWaypoint, dispatchWaypointOps)
          );
          return applySequential([pointFeaturesLens.set(newFeatures)]);
        }),
        option.getOrElse(() => {
          // Maak een Add command obv de coordinaten van de geklikte feature.
          forEach(extractCoordinate(ops.feature), (coords) =>
            dispatchDrawOps(AddPoint(coords))
          );
          return identity;
        })
      );
    }

    case "SnapWaypoint": {
      state.pointFeatures.forEach((feature) => {
        if (
          pipe(extractId(feature), (ma) =>
            option.elem(eq.eqNumber)(ops.waypoint.id, ma)
          )
        ) {
          feature.setGeometry(new ol.geom.Point(ops.waypoint.location));
        }
      });
      return identity; // we werken enkel via side effects nl updaten van bestaande ol.Feature
    }
  }
}

const drawOpsReducer: (
  dispatchDrawOps: Consumer1<DrawOps>,
  dispatchWaypointOps: Consumer1<WaypointOperation>,
  dispatchCmd: Consumer1<Command<KaartInternalMsg>>
) => ReduceFunction<DrawState, DrawOps> = (
  dispatchDrawOps,
  dispatchWaypointOps,
  dispatchCmd
) => (state, ops) =>
  drawStateTransformer(
    dispatchDrawOps,
    dispatchWaypointOps,
    dispatchCmd,
    state,
    ops
  )(state);

type FeaturesByWaypointId = NumberMapped<ol.Feature>;
type FeaturesByRouteId = StringMapped<ol.Feature>;

export interface RouteSegmentState {
  readonly featuresByStartWaypointId: FeaturesByWaypointId; // Een waypoint is de start van hoogstens 1 route segment
  readonly featuresByRouteId: FeaturesByRouteId; // Elke route id heeft exact 1 feature/geometry
}

const edgesToPolygon: (edges: ol.geom.LineString[]) => ol.geom.Polygon = (
  edges
) => {
  const coordinates = array.flatten(
    array.map((l: ol.geom.LineString) => l.getCoordinates())(edges)
  );
  coordinates.push(coordinates[0]);
  return new ol.geom.Polygon([coordinates]);
};

const featuresIn: (
  maybePolygonStylefunction: option.Option<ol.style.StyleFunction>
) => (state: RouteSegmentState) => Array<ol.Feature> = (
  maybePolygonStylefunction
) => (state) => {
  const routes: Array<ol.Feature> = Object.values(state.featuresByRouteId);

  return option.fold(
    () => routes,
    (polygonStyleFunction: ol.style.StyleFunction) => {
      const lines = routes.map((f) => <ol.geom.LineString>f.getGeometry());
      const firsts = lines.map((l) => l.getFirstCoordinate());
      const lasts = lines.map((l) => l.getLastCoordinate());
      const begins = array.difference(eqCoordinate)(firsts, lasts);
      const ends = array.difference(eqCoordinate)(lasts, firsts);
      const maybeBegin = array.head(begins);
      const maybeEnd = array.head(ends);

      const maybePhantomLine = pipe(
        maybeBegin,
        option.chain((begin) =>
          pipe(
            maybeEnd,
            option.map((end) => new ol.geom.LineString([begin, end]))
          )
        )
      );

      return pipe(
        maybePhantomLine,
        option.fold(
          () => lines,
          (l) => lines.concat(l)
        ),
        edgesToPolygon,
        (poly) => {
          const polyF = new ol.Feature(poly);
          polyF.setStyle(polygonStyleFunction);
          return [polyF];
        }
      );
    }
  )(maybePolygonStylefunction);
};

const featuresByStartWaypointIdLens: Lens<
  RouteSegmentState,
  FeaturesByWaypointId
> = Lens.fromProp<RouteSegmentState>()("featuresByStartWaypointId");
const startWaypointIdOptional: (
  arg: WaypointId
) => Optional<RouteSegmentState, ol.Feature> = (waypointId) =>
  featuresByStartWaypointIdLens.composeOptional(numberMapOptional(waypointId));
const featuresByRouteIdLens: Lens<
  RouteSegmentState,
  FeaturesByRouteId
> = Lens.fromProp<RouteSegmentState>()("featuresByRouteId");
const routeIdOptional: (
  arg: RouteEventId
) => Optional<RouteSegmentState, ol.Feature> = (routeId) =>
  featuresByRouteIdLens.composeOptional(stringMapOptional(routeId));

const addFeature: (
  routeId: RouteEventId,
  waypointId: WaypointId,
  feature: ol.Feature
) => Endomorphism<RouteSegmentState> = (routeId, waypointId, feature) =>
  applySequential([
    startWaypointIdOptional(waypointId).set(feature),
    routeIdOptional(routeId).set(feature),
  ]);

const removeFeature: (
  arg1: RouteEventId,
  arg2: WaypointId
) => Endomorphism<RouteSegmentState> = (routeId, waypointId) =>
  applySequential([
    featuresByStartWaypointIdLens.modify(removeFromNumberMap(waypointId)),
    featuresByRouteIdLens.modify(removeFromStringMap(routeId)),
  ]);

const routeSegmentReducer: (
  arg1: clr.Kleur,
  arg2: Consumer1<DrawOps>
) => ReduceFunction<RouteSegmentState, RouteEvent> = (
  lineColour,
  dispatchDrawOps
) => (state, ops) => {
  function handleOps(): Endomorphism<RouteSegmentState> {
    switch (ops.type) {
      case "RouteAdded":
        // maken we een feature met de te tekenen geometrie
        const line = new ol.Feature(ops.geometry);
        line.set("edges", ops.edges);
        line.setStyle(createLineStyle(lineColour));

        // dan kijken we of de eindpunten veranderd zijn en als dat zo is, dan maken we daar een DrawOps voor
        [ops.beginSnap, ops.endSnap].forEach((snap) =>
          forEach(snap, flow(SnapWaypoint, dispatchDrawOps))
        );

        // en tenslotte voegen we de feature toe aan de state
        return addFeature(ops.id, ops.startWaypointId, line);

      case "RouteRemoved":
        return removeFeature(ops.id, ops.startWaypointId);
    }
  }
  return handleOps()(state);
};

const stichGeometries: (
  arg1: WaypointId[],
  arg2: FeaturesByWaypointId
) => ol.geom.Geometry = (ids, featuresById) => {
  return new ol.geom.GeometryCollection(
    array.compact(
      ids.map((id) =>
        pipe(
          numberMapOptional<ol.Feature>(id).getOption(featuresById),
          option.chain((f) => option.fromNullable(f.getGeometry()))
        )
      )
    )
  );
};

@Component({
  selector: "awv-kaart-multi-teken-laag",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-teken-laag.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class KaartMultiTekenLaagComponent
  extends KaartChildDirective
  implements OnInit, OnDestroy {
  private readonly internalDrawOpsSubj: rx.Subject<DrawOps> = new rx.Subject();
  private routingRapportSubj: rx.Subject<RoutingRapport>;

  constructor(
    parent: KaartComponent,
    zone: NgZone,
    private readonly http: HttpClient
  ) {
    super(parent, zone);

    // Trek de OL map binnen, zodat we niet voor alles een boodschap naar de globale kaart reducer moeten dispatchen.
    // We moeten er dan wel voor zorgen dat we alle resources mooi opkuisen.
    const olMap$ = this.kaartModel$.pipe(
      map((m) => m.map),
      take(1)
    );

    // Breng de externe DrawOps (start & stop) samen met de interne DrawOps
    const drawEffects$ = rx.merge(
      this.modelChanges.tekenenOps$,
      this.internalDrawOpsSubj
    );

    // Een event dat helpt om alle state te resetten
    const drawingStarts$: rx.Observable<StartDrawing> = drawEffects$.pipe(
      filter(isStartDrawing)
    );
    const redrawStarts$: rx.Observable<RedrawRoute> = drawEffects$.pipe(
      filter(isRedrawRoute)
    );

    // Maak een subject waar de drawReducer kan in schrijven
    const waypointObsSubj: rx.Subject<WaypointOperation> = new rx.Subject();

    // Vorm een state + een event om tot een nieuwe state en wat side-effects op de OL map
    // Dit is het hart van het zetten en bewerken van de punten.
    // Welke lijnen er getekened moeten worden zal afhangen van het antwoord op de WaypointOps die we genereren
    const drawOpsProcessor$: rx.Observable<DrawState> = olMap$.pipe(
      switchMap((olMap) =>
        drawingStarts$.pipe(
          switchMap((startCmd) =>
            drawEffects$.pipe(
              startWith(startCmd), // We mogen ons startcommando niet verliezen omdat daar configuratie in zit
              scan(
                drawOpsReducer(
                  (ops) => asap(() => this.internalDrawOpsSubj.next(ops)), // achteraf gezien beter om scanState functie te gebruiken
                  (ops) => asap(() => waypointObsSubj.next(ops)),
                  (cmd) => this.dispatch(cmd)
                ),
                initialState(olMap)
              )
            )
          )
        )
      ),
      share()
    );

    // We willen vlugge opeenvolgingen van add en remove interpreteren als een
    // trigger om te stoppen met tekenen, maar toch in de tekenmode blijven. We
    // kunnen op dit niveau niet gebruik maken van de OL double click event. Die
    // interfereert bovendien met de andere event handlers.
    const doubleClick$ = waypointObsSubj.pipe(
      timeInterval(),
      pairwise(),
      filter(([prev, curr]) => {
        return (
          curr.interval < 500 &&
          prev.value.type === "AddWaypoint" &&
          curr.value.type === "RemoveWaypoint" &&
          prev.value.waypoint.id === curr.value.waypoint.id &&
          Coordinates.equal(
            prev.value.waypoint.location,
            curr.value.waypoint.location
          )
        );
      }),
      tap(([prev]) => {
        const addWayPoint = prev.value;
        this.internalDrawOpsSubj.next(AddPoint(addWayPoint.waypoint.location));
      })
    );
    // Kies de correcte routering
    const routeSegmentOps$: (
      arg1: boolean,
      arg2: option.Option<RoutingService>
    ) => rx.Observable<RouteEvent> = (useRouting, customRoutingService) => {
      const routingService = pipe(
        customRoutingService,
        option.fold(
          () => (useRouting ? routesViaRoutering(this.http) : directeRoutes()),
          (rs) => customRoutes(rs)
        )
      );
      return waypointObsSubj.pipe(routingService);
    };

    const initialRouteSegmentState: RouteSegmentState = {
      featuresByStartWaypointId: {},
      featuresByRouteId: {},
    };

    interface DrawOptions {
      readonly useRouting: boolean;
      readonly featureColour: clr.Kleur;
      readonly customRoutingService: option.Option<RoutingService>;
      readonly polygonStyleFunction: option.Option<ol.style.StyleFunction>;
    }

    // Dit (her)start de routing service wanneer een nieuwe serie punten gestart wordt of het type van routing herzet wordt
    const routingStart$: rx.Observable<DrawOptions> = rx
      .merge(drawingStarts$, redrawStarts$)
      .pipe(
        withLatestFrom(drawingStarts$),
        map(([{ useRouting }, start]) => ({
          useRouting: useRouting,
          featureColour: start.featureColour,
          polygonStyleFunction: start.polygonStyleFunction,
          customRoutingService: start.customRoutingService,
        }))
      );

    // Verbind de geproduceerde WaypointOps met de routing service
    const routeEventProcessor$: rx.Observable<RouteSegmentState> = routingStart$.pipe(
      switchMap((start) =>
        routeSegmentOps$(start.useRouting, start.customRoutingService).pipe(
          scan(
            routeSegmentReducer(start.featureColour, (ops) =>
              asap(() => this.internalDrawOpsSubj.next(ops))
            ),
            initialRouteSegmentState
          ),
          debounceTime(start.useRouting ? 75 : 0)
        )
      ),
      share()
    );

    // Vorm de deelroutes om tot 1 geometrie
    const combinedGeometry$: rx.Observable<ol.geom.Geometry> = routeEventProcessor$.pipe(
      withLatestFrom(
        drawOpsProcessor$.pipe(
          map((drawState) =>
            array.compact(drawState.pointFeatures.map(extractId))
          )
        )
      ),
      map(([routeSegmentState, pointFeatureIds]) =>
        stichGeometries(
          pointFeatureIds,
          routeSegmentState.featuresByStartWaypointId
        )
      )
    );

    const stringMappedOrd: ord.Ord<[string, any]> = ord.contramap<
      string,
      [string, any]
    >((idToFeature) => idToFeature[0])(ord.ordString);

    const numberMappedOrd: ord.Ord<[number, any]> = ord.contramap<
      number,
      [number, any]
    >((idToFeature) => idToFeature[0])(ord.ordNumber);

    const routingRapport$: rx.Observable<RoutingRapport> = routeEventProcessor$.pipe(
      withLatestFrom(
        drawOpsProcessor$.pipe(
          map((drawState) => {
            const waypointIdToWaypoint = new Map(
              array.compact(
                drawState.pointFeatures.map((pf) =>
                  pipe(
                    extractId(pf),
                    option.map((i) => [i, pf])
                  )
                )
              )
            );
            return waypointIdToWaypoint;
          })
        )
      ),
      distinctUntilChanged(),
      map(([routeSegmentState, waypointIdToWaypoint]) => {
        const sortedWaypoints = array
          .sort(numberMappedOrd)([...waypointIdToWaypoint.entries()])
          .map(([key, value]) => <ol.Feature>value);

        const routesByStartId: Array<[number, GetekendeRoute]> = Object.entries(
          routeSegmentState.featuresByRouteId
        ).map(([key, value]) => {
          const keys = key.split("_");
          const startId = Number(keys[0]);
          const van = waypointIdToWaypoint.get(startId);
          const tot = waypointIdToWaypoint.get(Number(keys[1]));
          const segmenten = value.get("edges");
          const route = getekendeRoute(van!, tot!, segmenten);
          return [startId, route];
        });

        const sortedRoutes = array
          .sort(numberMappedOrd)(routesByStartId)
          .map(([key, value]) => <GetekendeRoute>value);

        return routingRapport(sortedWaypoints, sortedRoutes);
      })
    );

    // Steek alles in gang. Tot nu toe was het enkel compositie
    this.runInViewReady(
      rx.merge(
        combinedGeometry$.pipe(
          tap((geom) => this.dispatch(prt.ZetGetekendeGeometryCmd(geom)))
        ),
        routingStart$.pipe(
          switchMap((start) =>
            routeEventProcessor$.pipe(
              tap((routeState) =>
                this.dispatch(
                  prt.VervangFeaturesCmd(
                    SegmentLaagNaam,
                    featuresIn(start.polygonStyleFunction)(routeState),
                    kaartLogOnlyWrapper
                  )
                )
              )
            )
          )
        ),
        routingRapport$.pipe(
          tap((rr) => {
            this.routingRapportSubj.next(rr);
          })
        ),
        doubleClick$
      )
    );

    // TODO werkt selector weg
    const onderdrukBoodschapOpties$ = this.accumulatedOpties$(
      BevraagKaartUiSelector
    ).pipe(
      sample(this.initialising$),
      tap(() => {
        this.dispatch(
          BevraagKaartOpties.ZetOptiesCmd({
            infoServiceOnderdrukt: true,
            kaartBevragenOnderdrukt: true,
          })
        );
        // this.dispatch(ZetMaarkeerKaartklikOptiesCmd({ disabled: true }));
      }),
      switchMap((opties) =>
        this.destroying$.pipe(
          tap(() => this.dispatch(BevraagKaartOpties.ZetOptiesCmd(opties)))
        )
      )
    );

    onderdrukBoodschapOpties$.subscribe();
  }

  ngOnInit() {
    super.ngOnInit();
    // Hou de subject bij.
    this.bindToLifeCycle(
      this.kaartModel$.pipe(
        distinctUntilChanged(
          (k1, k2) => k1.routingRapportSubj === k2.routingRapportSubj
        ), //
        map((kwi) => kwi.routingRapportSubj)
      )
    ).subscribe((s) => (this.routingRapportSubj = s));
  }
}
