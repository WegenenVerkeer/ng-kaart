import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { Curried2, Endomorphism, flow, Function1, Function2, Function3, identity, Predicate, Refinement } from "fp-ts/lib/function";
import { fromNullable, fromPredicate, none, Option, some } from "fp-ts/lib/Option";
import * as option from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";
import { setoidNumber, setoidString } from "fp-ts/lib/Setoid";
import { Lens, Optional } from "monocle-ts";
import * as ol from "openlayers";
import * as rx from "rxjs";
import {
  debounceTime,
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
  withLatestFrom
} from "rxjs/operators";

import { Coordinate } from "../../coordinaten";
import * as clr from "../../stijl/colour";
import { disc, solidLine } from "../../stijl/common-shapes";
import { Transparantie } from "../../transparantieeditor/transparantie";
import { eqCoordinate } from "../../util";
import { asap } from "../../util/asap";
import { applySequential, Consumer1, PartialFunction1, ReduceFunction } from "../../util/function";
import {
  numberMapOptional,
  NumberMapped,
  removeFromNumberMap,
  removeFromStringMap,
  stringMapOptional,
  StringMapped
} from "../../util/lenses";
import { forEach } from "../../util/option";
import { BevraagKaartUiSelector, ZetKaartBevragenOptiesCmd } from "../kaart-bevragen/kaart-bevragen-opties";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { Command, DrawOpsCmd, VerwijderLaagCmd } from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";
import * as ss from "../stijl-selector";

import { RouteEvent, RouteEventId } from "./route.msg";
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
  StopDrawing
} from "./tekenen-model";
import { directeRoutes, routesViaRoutering } from "./waypoint-ops";
import { AddWaypoint, RemoveWaypoint, Waypoint, WaypointId, WaypointOperation } from "./waypoint.msg";

export const MultiTekenenUiSelector = "MultiKaarttekenen";

const PuntLaagNaam = "MultiTekenPuntLaag"; // De naam van de laag waar de bolletjes, aka Waypoints, geplaatst worden
const SegmentLaagNaam = "MultiTekenSegmentLaag"; // De naam van de laag waar de lijntjes, aka RouteSegments, geplaatst worden

interface DrawState {
  readonly map: ol.Map; // Misschien moeten we de interacties via dispatchCmd op de OL map zetten, dan hebbenn we ze hier niet nodig
  readonly featureColour: clr.Kleur;
  readonly drawInteractions: ol.interaction.Interaction[];
  readonly selectInteraction: Option<ol.interaction.Select>;
  readonly pointFeatures: ol.Feature[];
  readonly nextId: number;
  readonly dragFeature: Option<ol.Feature>;
  readonly listeners: ol.GlobalObject[];
}

interface PointProperties {
  readonly type: "Waypoint";
  readonly previous: Option<ol.Feature>; // Het vorige punt in de dubbelgelinkte lijst van punten
  readonly next: Option<ol.Feature>; // Het volgende punt in de dubbelgelinkte lijst van punten
}

// Onze state is wel immutable, maar de features zelf worden beheerd door OL en die is helemaal niet immutable dus de features
// in pointFeature worden achter onze rug aangepast.
const initialState: Function1<ol.Map, DrawState> = olMap => ({
  map: olMap,
  featureColour: clr.zwartig,
  drawInteractions: [],
  selectInteraction: none,
  pointFeatures: [],
  nextId: 0,
  dragFeature: none,
  listeners: []
});

const PointProperties: Function2<Option<ol.Feature>, Option<ol.Feature>, PointProperties> = (previous, next) => ({
  type: "Waypoint",
  next: next,
  previous: previous
});

type DrawLens<A> = Lens<DrawState, A>;
const drawInteractionsLens: DrawLens<ol.interaction.Interaction[]> = Lens.fromProp("drawInteractions");
const selectInteractionLens: DrawLens<Option<ol.interaction.Select>> = Lens.fromProp("selectInteraction");
const pointFeaturesLens: DrawLens<ol.Feature[]> = Lens.fromProp("pointFeatures");
const nextIdLens: DrawLens<number> = Lens.fromProp("nextId");
const incrementNextId: Endomorphism<DrawState> = nextIdLens.modify(n => n + 1);
const dragFeatureLens: DrawLens<Option<ol.Feature>> = Lens.fromProp("dragFeature");
const listenersLens: DrawLens<ol.GlobalObject[]> = Lens.fromProp("listeners");
const featureColourLens: DrawLens<clr.Kleur> = Lens.fromProp("featureColour");

type PointFeaturePropertyLens<A> = Lens<PointProperties, A>;
const nextLens: PointFeaturePropertyLens<Option<ol.Feature>> = Lens.fromProp("next");
const previousLens: PointFeaturePropertyLens<Option<ol.Feature>> = Lens.fromProp("previous");
const replaceNext: Function1<Option<ol.Feature>, Endomorphism<PointProperties>> = nextLens.set;
const replacePrevious: Function1<Option<ol.Feature>, Endomorphism<PointProperties>> = previousLens.set;

const createMarkerStyle: Function1<clr.Kleur, ss.Stylish> = colour => disc.stylish(colour, clr.wit, 3, 5);

const createLineStyle: Function1<clr.Kleur, ss.Stylish> = colour => solidLine.stylish(colour, 2);

const createLayer: Function2<string, ol.source.Vector, ke.VectorLaag> = (titel, source) => {
  source.set("laagTitel", titel);
  return {
    type: ke.VectorType,
    titel: titel,
    source: source,
    clusterDistance: none,
    styleSelector: none,
    styleSelectorBron: none,
    selectieStyleSelector: none,
    hoverStyleSelector: none,
    selecteerbaar: false,
    hover: false,
    minZoom: 2,
    maxZoom: 15,
    offsetveld: none, // veel ruis
    velden: new Map<string, ke.VeldInfo>(),
    verwijderd: false,
    rijrichtingIsDigitalisatieZin: false,
    filter: none
  };
};

const isTekenLayer: Predicate<ol.layer.Layer> = layer =>
  fromNullable(ke.underlyingSource(layer))
    .chain(source => fromNullable(source.get("laagTitel")))
    .contains(setoidString, PuntLaagNaam);

type FeaturePicker = PartialFunction1<[number, number], ol.Feature>;
const featurePicker: Function1<ol.Map, FeaturePicker> = map => pixel => {
  const featuresAtPixel = map.getFeaturesAtPixel(pixel, { layerFilter: isTekenLayer }) as ol.Feature[];
  return fromNullable(featuresAtPixel).chain(array.head);
};

const isPoint: Refinement<ol.geom.Geometry, ol.geom.Point> = (geom): geom is ol.geom.Point => geom instanceof ol.geom.Point;
const isNumber: Refinement<any, number> = (value): value is number => typeof value === "number";
const isWaypointProperties: Refinement<any, PointProperties> = (value): value is PointProperties =>
  typeof value === "object" && fromNullable(value.type).exists(type => type === "Waypoint");

const extractCoordinate: PartialFunction1<ol.Feature, ol.Coordinate> = feature =>
  fromPredicate(isPoint)(feature.getGeometry()).map(point => point.getCoordinates());

const extractId: PartialFunction1<ol.Feature, number> = feature => fromNullable(feature.getId()).chain(fromPredicate(isNumber));

const extractPointProperties: PartialFunction1<ol.Feature, PointProperties> = feature =>
  fromPredicate(isWaypointProperties)(feature.getProperties());

const toWaypoint: PartialFunction1<ol.Feature, Waypoint> = feature =>
  extractId(feature).chain(id => extractCoordinate(feature).map(coordinate => Waypoint(id, coordinate)));

const findPreviousFeature: PartialFunction1<ol.Feature, ol.Feature> = feature => extractPointProperties(feature).chain(previousLens.get);

const findNextFeature: PartialFunction1<ol.Feature, ol.Feature> = feature => extractPointProperties(feature).chain(nextLens.get);

const findPreviousWaypoint: PartialFunction1<ol.Feature, Waypoint> = feature => findPreviousFeature(feature).chain(toWaypoint);

const selectFilter: ol.SelectFilterFunction = feature => isWaypointProperties(feature.getProperties());

const updatePointProperties: Function1<Endomorphism<PointProperties>, Consumer1<ol.Feature>> = f => feature =>
  forEach(extractPointProperties(feature), props => feature.setProperties(f(props)));

function drawStateTransformer(
  dispatchDrawOps: Consumer1<DrawOps>,
  dispatchWaypointOps: Consumer1<WaypointOperation>,
  dispatchCmd: Consumer1<Command<KaartInternalMsg>>,
  state: DrawState,
  ops: DrawOps
): Endomorphism<DrawState> {
  const handleAdd: Consumer1<ol.events.Event> = event => {
    const drawEvent = event as ol.interaction.Draw.Event;
    const maybeCurrentCoordinate = extractCoordinate(drawEvent.feature);
    forEach(maybeCurrentCoordinate, coordinate => dispatchDrawOps(AddPoint(coordinate)));
  };

  // Jammer genoeg hebben we in het move event hieronder geen informatie over welke feature er precies van plaats veranderd is.
  // Daarom maken we een tussentijds event waarin we deze informatie wel hebben. In principe zouden we ook een heleboel move
  // events kunnen genereren, maar dat zou belastend zijn voor de server en flikkeren aan de client.
  const handleFeatureDrag: Consumer1<ol.events.Event> = evt => {
    const feature: ol.Feature = evt.target as ol.Feature;
    dispatchDrawOps(DraggingPoint(feature));
  };

  // We krijgen in het event enkel alle features samen. Er is wel een revision methode op een feature, maar om die te gebruiken
  // zouden we ergens de versies van alle features moeten bijhouden. En bovendien zouden we dan alle soorten interacties met die
  // features die de versie ophogen moeten opvangen.
  const handleFeatureMove: Consumer1<ol.events.Event> = () => dispatchDrawOps(MovePoint());

  const handleDoubleClick: Consumer1<ol.events.Event> = () => dispatchCmd(DrawOpsCmd(StopDrawing()));

  const handleSelect: Consumer1<ol.events.Event> = evt => {
    const selectEvent = evt as ol.interaction.Select.Event;
    forEach(
      array.head(selectEvent.selected),
      flow(
        DeletePoint,
        dispatchDrawOps
      )
    );
  };

  const handlePointermove: Function2<FeaturePicker, ol.source.Vector, Consumer1<ol.events.Event>> = (featurePicker, source) => evt => {
    const moveEvent = evt as ol.MapBrowserEvent;
    if (!moveEvent.dragging) {
      forEach(featurePicker(moveEvent.pixel), selectedFeature => {
        array.head(source.getFeatures()).foldL(
          () => source.addFeature(selectedFeature),
          movedFeature => {
            if (movedFeature !== selectedFeature) {
              source.clear();
              source.addFeature(selectedFeature);
            }
          }
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
        type: "Point",
        freehandCondition: ol.events.condition.never,
        style: puntStijl,
        snapTolerance: 5
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
        legende: none,
        stijlInLagenKiezer: none,
        filterinstellingen: none,
        laagtabelinstellingen: none,
        wrapper: kaartLogOnlyWrapper
      });
      dispatchCmd({
        type: "VoegLaagToe",
        positie: 1,
        laag: createLayer(PuntLaagNaam, drawSource),
        magGetoondWorden: true,
        transparantie: Transparantie.opaak,
        laaggroep: "Tools",
        legende: none,
        stijlInLagenKiezer: none,
        filterinstellingen: none,
        laagtabelinstellingen: none,
        wrapper: kaartLogOnlyWrapper
      });
      drawInteractions.forEach(inter => state.map.addInteraction(inter));
      state.map.addInteraction(selectInteraction);
      state.map.on("dblclick", handleDoubleClick);
      const moveKey = state.map.on("pointermove", handlePointermove(featurePicker(state.map), modifySource)) as ol.GlobalObject;
      return applySequential([
        drawInteractionsLens.set(drawInteractions),
        selectInteractionLens.set(some(selectInteraction)),
        listenersLens.set([moveKey]),
        featureColourLens.set(ops.featureColour)
      ]);
    }

    case "EndDrawing": {
      dispatchCmd(VerwijderLaagCmd(PuntLaagNaam, kaartLogOnlyWrapper));
      dispatchCmd(VerwijderLaagCmd(SegmentLaagNaam, kaartLogOnlyWrapper));
      state.drawInteractions.forEach(inter => state.map.removeInteraction(inter));
      forEach(state.selectInteraction, inter => state.map.removeInteraction(inter));
      state.listeners.forEach(key => ol.Observable.unByKey(key));
      return identity; // Hierna gooien we onze state toch weg -> mag corrupt zijn
    }

    case "StopDrawing": {
      state.drawInteractions.forEach(inter => state.map.removeInteraction(inter));
      forEach(state.selectInteraction, inter => state.map.removeInteraction(inter));
      state.listeners.forEach(key => ol.Observable.unByKey(key));
      return applySequential([drawInteractionsLens.set([]), listenersLens.set([])]);
    }

    case "RedrawRoute": {
      // De bedoeling is om alle waypoints te behouden, maar de route opnieuw te laten tekenen.
      // Wat we doen is een klein beetje tricky. We sturen alle waypoints opnieuw naar de observer
      // die de route tekent. We rekenen erop dat die observer gereset is vooraleer hij die waypoints
      // binnen krijgt. Dat is zo omdat de dispatch asynchroon gebeurt.
      state.pointFeatures.forEach(feature => {
        const maybePointProperties = extractPointProperties(feature);
        const maybePreviousPoint: Option<Waypoint> = maybePointProperties.chain(p => p.previous).chain(toWaypoint);
        const maybeCurrentWaypoint = toWaypoint(feature);
        forEach(maybeCurrentWaypoint, currentWaypoint => dispatchWaypointOps(AddWaypoint(maybePreviousPoint, currentWaypoint)));
      });
      return identity; // geen state changes
    }

    case "AddPoint": {
      const currentFeatures = pointFeaturesLens.get(state);
      const lastFeature = array.last(currentFeatures);
      const coordinate = ops.coordinate;
      const feature = new ol.Feature(new ol.geom.Point(coordinate));

      const maybePreviousCoordinate = lastFeature.chain(extractCoordinate);
      const sameLocationAsPrevious = maybePreviousCoordinate.exists(p => p[0] === coordinate[0] && p[1] === coordinate[1]);

      // Openlayers (in elk geval zoals wij het gebruiken) heeft de vervelende eigenschap dat het een drawend genereert bij
      // een klik als de muispointer nog niet bewogen is. We voegen dan maw. Nog een extra punt toe opdezelfde locatie. En
      // tegelijkertijd wissen we het punt dat er net voor gezet was. Dat is niet wat we willen. Dat extra punt moet nl. niet
      // toegevoegd worden
      if (!sameLocationAsPrevious) {
        feature.setId(state.nextId);
        feature.setStyle(createMarkerStyle(state.featureColour));
        feature.setProperties(PointProperties(lastFeature, none));
        forEach(lastFeature, updatePointProperties(replaceNext(some(feature))));
        feature.on("change", handleFeatureDrag);
        const newFeatures = array.snoc(currentFeatures, feature);
        dispatchWaypointOps(AddWaypoint(lastFeature.chain(toWaypoint), Waypoint(state.nextId, coordinate)));
        dispatchCmd(prt.VervangFeaturesCmd(PuntLaagNaam, newFeatures, kaartLogOnlyWrapper));
        return applySequential([pointFeaturesLens.set(newFeatures), incrementNextId]);
      } else {
        return identity;
      }
    }

    case "DraggingPoint": {
      // Deze operatie is hier omdat we in de move event anders niet weten welk punt er verplaatst is.
      // Er is nog een bijkomende complicatie: wanneer 2 of meer features over elkaar liggen, dan worden die door de Modify
      // interaction allemaal verplaatst. Dat willen we niet. We kunnen dit opvangen door maar 1 drag toe te laten. We krijgen
      // immers een event voor elk punt. Elk punt na het eerste dat we zien, zetten we terug op zijn originele plaats.
      return dragFeatureLens.set(some(ops.feature));
    }

    case "MovePoint": {
      return dragFeatureLens
        .get(state)
        .chain(draggedFeature =>
          toWaypoint(draggedFeature).map(current => {
            // laat onze subscriber weten dat er een punt verplaatst is
            const previous = findPreviousWaypoint(draggedFeature);
            dispatchWaypointOps(RemoveWaypoint(current));
            dispatchWaypointOps(AddWaypoint(previous, current));
            return dragFeatureLens.set(none);
          })
        )
        .getOrElse(identity);
    }

    case "DeletePoint": {
      const maybePrevious = findPreviousFeature(ops.feature);
      const maybeNext = findNextFeature(ops.feature);
      // Het eerste punt mag niet verwijderd worden. Een klik op het eerste punt zal daarentegen een punt toevoegen zodat de polygon quasi
      // gesloten is. Het eerste punt is, uiteraard, het enige punt dat geen vorig punt heeft. Dat gebruiken we dus als identificator.
      return maybePrevious
        .map(previous => {
          updatePointProperties(replaceNext(maybeNext))(previous);
          forEach(maybeNext, updatePointProperties(replacePrevious(maybePrevious)));
          const newFeatures = array.filter(state.pointFeatures, f => f.getId() !== ops.feature.getId());
          forEach(state.selectInteraction, interaction => interaction.getFeatures().clear());
          dispatchCmd(prt.VervangFeaturesCmd(PuntLaagNaam, newFeatures, kaartLogOnlyWrapper));
          forEach(
            toWaypoint(ops.feature),
            flow(
              RemoveWaypoint,
              dispatchWaypointOps
            )
          );
          return applySequential([pointFeaturesLens.set(newFeatures)]);
        })
        .getOrElseL(() => {
          // Maak een Add command obv de coordinaten van de geklikte feature.
          forEach(extractCoordinate(ops.feature), coords => dispatchDrawOps(AddPoint(coords)));
          return identity;
        });
    }

    case "SnapWaypoint": {
      state.pointFeatures.forEach(feature => {
        if (extractId(feature).contains(setoidNumber, ops.waypoint.id)) {
          feature.setGeometry(new ol.geom.Point(ops.waypoint.location));
        }
      });
      return identity; // we werken enkel via side effects nl updaten van bestaande ol.Feature
    }
  }
}

const drawOpsReducer: Function3<
  Consumer1<DrawOps>,
  Consumer1<WaypointOperation>,
  Consumer1<Command<KaartInternalMsg>>,
  ReduceFunction<DrawState, DrawOps>
> = (dispatchDrawOps, dispatchWaypointOps, dispatchCmd) => (state, ops) =>
  drawStateTransformer(dispatchDrawOps, dispatchWaypointOps, dispatchCmd, state, ops)(state);

type FeaturesByWaypointId = NumberMapped<ol.Feature>;
type FeaturesByRouteId = StringMapped<ol.Feature>;

interface RouteSegmentState {
  readonly featuresByStartWaypointId: FeaturesByWaypointId; // Een waypoint is de start van hoogstens 1 route segment
  readonly featuresByRouteId: FeaturesByRouteId; // Elke route id heeft exact 1 feature/geometry
}

const edgesToPolygon: Function1<ol.geom.LineString[], ol.geom.Polygon> = edges => {
  const coordinates = array.flatten(array.map((l: ol.geom.LineString) => l.getCoordinates())(edges));
  coordinates.push(coordinates[0]);
  return new ol.geom.Polygon([coordinates]);
};

const featuresIn: Curried2<Option<ol.StyleFunction>, RouteSegmentState, Array<ol.Feature>> = maybePolygonStylefunction => state => {
  const routes: Array<ol.Feature> = Object.values(state.featuresByRouteId);

  return maybePolygonStylefunction.fold(routes, polygonStyleFunction => {
    const lines = routes.map(f => <ol.geom.LineString>f.getGeometry());
    const firsts = lines.map(l => l.getFirstCoordinate());
    const lasts = lines.map(l => l.getLastCoordinate());
    const begins = array.difference(eqCoordinate)(firsts, lasts);
    const ends = array.difference(eqCoordinate)(lasts, firsts);
    const maybeBegin = array.head(begins);
    const maybeEnd = array.head(ends);

    const maybePhantomLine = pipe(
      maybeBegin,
      option.chain(begin =>
        pipe(
          maybeEnd,
          option.map(end => new ol.geom.LineString([begin, end]))
        )
      )
    );

    return pipe(
      maybePhantomLine.fold(lines, l => lines.concat(l)),
      edgesToPolygon,
      poly => {
        const polyF = new ol.Feature(poly);
        polyF.setStyle(polygonStyleFunction);
        return [polyF];
      }
    );
  });
};

const featuresByStartWaypointIdLens: Lens<RouteSegmentState, FeaturesByWaypointId> = Lens.fromProp("featuresByStartWaypointId");
const startWaypointIdOptional: Function1<WaypointId, Optional<RouteSegmentState, ol.Feature>> = waypointId =>
  featuresByStartWaypointIdLens.composeOptional(numberMapOptional(waypointId));
const featuresByRouteIdLens: Lens<RouteSegmentState, FeaturesByRouteId> = Lens.fromProp("featuresByRouteId");
const routeIdOptional: Function1<RouteEventId, Optional<RouteSegmentState, ol.Feature>> = routeId =>
  featuresByRouteIdLens.composeOptional(stringMapOptional(routeId));

const addFeature: Function3<RouteEventId, WaypointId, ol.Feature, Endomorphism<RouteSegmentState>> = (routeId, waypointId, feature) =>
  applySequential([startWaypointIdOptional(waypointId).set(feature), routeIdOptional(routeId).set(feature)]);

const removeFeature: Function2<RouteEventId, WaypointId, Endomorphism<RouteSegmentState>> = (routeId, waypointId) =>
  applySequential([
    featuresByStartWaypointIdLens.modify(removeFromNumberMap(waypointId)),
    featuresByRouteIdLens.modify(removeFromStringMap(routeId))
  ]);

const routeSegmentReducer: Function2<clr.Kleur, Consumer1<DrawOps>, ReduceFunction<RouteSegmentState, RouteEvent>> = (
  lineColour,
  dispatchDrawOps
) => (state, ops) => {
  function handleOps(): Endomorphism<RouteSegmentState> {
    switch (ops.type) {
      case "RouteAdded":
        // maken we een feature met de te tekenen geometrie
        const line = new ol.Feature(ops.geometry);
        line.setStyle(createLineStyle(lineColour));

        // dan kijken we of de eindpunten veranderd zijn en als dat zo is, dan maken we daar een DrawOps voor
        [ops.beginSnap, ops.endSnap].forEach(snap =>
          forEach(
            snap,
            flow(
              SnapWaypoint,
              dispatchDrawOps
            )
          )
        );

        // en tenslotte voegen we de feature toe aan de state
        return addFeature(ops.id, ops.startWaypointId, line);

      case "RouteRemoved":
        return removeFeature(ops.id, ops.startWaypointId);
    }
  }
  return handleOps()(state);
};

const stichGeometries: Function2<WaypointId[], FeaturesByWaypointId, ol.geom.Geometry> = (ids, featuresById) => {
  return new ol.geom.GeometryCollection(
    array.catOptions(
      ids.map(id =>
        numberMapOptional<ol.Feature>(id)
          .getOption(featuresById)
          .map(f => f.getGeometry())
      )
    )
  );
};

@Component({
  selector: "awv-kaart-multi-teken-laag",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-teken-laag.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartMultiTekenLaagComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private readonly internalDrawOpsSubj: rx.Subject<DrawOps> = new rx.Subject();

  constructor(parent: KaartComponent, zone: NgZone, private readonly http: HttpClient) {
    super(parent, zone);

    // Trek de OL map binnen, zodat we niet voor alles een boodschap naar de globale kaart reducer moeten dispatchen.
    // We moeten er dan wel voor zorgen dat we alle resources mooi opkuisen.
    const olMap$ = this.kaartModel$.pipe(
      map(m => m.map),
      take(1)
    );

    // Breng de externe DrawOps (start & stop) samen met de interne DrawOps
    const drawEffects$ = rx.merge(this.modelChanges.tekenenOps$, this.internalDrawOpsSubj);

    // Een event dat helpt om alle state te resetten
    const drawingStarts$: rx.Observable<StartDrawing> = drawEffects$.pipe(filter(isStartDrawing));
    const redrawStarts$: rx.Observable<RedrawRoute> = drawEffects$.pipe(filter(isRedrawRoute));

    // Maak een subject waar de drawReducer kan in schrijven
    const waypointObsSubj: rx.Subject<WaypointOperation> = new rx.Subject();

    // Vorm een state + een event om tot een nieuwe state en wat side-effects op de OL map
    // Dit is het hart van het zetten en bewerken van de punten.
    // Welke lijnen er getekened moeten worden zal afhangen van het antwoord op de WaypointOps die we genereren
    const drawOpsProcessor$: rx.Observable<DrawState> = olMap$.pipe(
      switchMap(olMap =>
        drawingStarts$.pipe(
          switchMap(startCmd =>
            drawEffects$.pipe(
              startWith(startCmd), // We mogen ons startcommando niet verliezen omdat daar configuratie in zit
              scan(
                drawOpsReducer(
                  ops => asap(() => this.internalDrawOpsSubj.next(ops)), // achteraf gezien beter om scanState functie te gebruiken
                  ops => asap(() => waypointObsSubj.next(ops)),
                  cmd => this.dispatch(cmd)
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
          Coordinate.equal(prev.value.waypoint.location, curr.value.waypoint.location)
        );
      }),
      tap(([prev]) => {
        const addWayPoint = prev.value;
        this.internalDrawOpsSubj.next(AddPoint(addWayPoint.waypoint.location));
      })
    );
    // Kies de correcte routering
    const routeSegmentOps$: Function1<boolean, rx.Observable<RouteEvent>> = useRouting =>
      waypointObsSubj.pipe(useRouting ? routesViaRoutering(this.http) : directeRoutes());

    const initialRouteSegmentState: RouteSegmentState = { featuresByStartWaypointId: {}, featuresByRouteId: {} };

    interface DrawOptions {
      readonly useRouting: boolean;
      readonly featureColour: clr.Kleur;
      readonly polygonStyleFunction: option.Option<ol.StyleFunction>;
    }

    // Dit (her)start de routing service wanneer een nieuwe serie punten gestart wordt of het type van routing herzet wordt
    const routingStart$: rx.Observable<DrawOptions> = rx.merge(drawingStarts$, redrawStarts$).pipe(
      withLatestFrom(drawingStarts$),
      map(([{ useRouting }, start]) => ({
        useRouting: useRouting,
        featureColour: start.featureColour,
        polygonStyleFunction: start.polygonStyleFunction
      }))
    );

    // Verbind de geproduceerde WaypointOps met de routing service
    const routeEventProcessor$: rx.Observable<RouteSegmentState> = routingStart$.pipe(
      switchMap(start =>
        routeSegmentOps$(start.useRouting).pipe(
          scan(routeSegmentReducer(start.featureColour, ops => asap(() => this.internalDrawOpsSubj.next(ops))), initialRouteSegmentState),
          debounceTime(start.useRouting ? 75 : 0)
        )
      ),
      share()
    );

    // Vorm de deelroutes om tot 1 geometrie
    const combinedGeometry$: rx.Observable<ol.geom.Geometry> = routeEventProcessor$.pipe(
      withLatestFrom(drawOpsProcessor$.pipe(map(drawState => array.catOptions(drawState.pointFeatures.map(extractId))))),
      map(([routeSegmentState, pointFeatureIds]) => stichGeometries(pointFeatureIds, routeSegmentState.featuresByStartWaypointId))
    );

    // Steek alles in gang. Tot nu toe was het enkel compositie
    this.runInViewReady(
      rx.merge(
        combinedGeometry$.pipe(tap(geom => this.dispatch(prt.ZetGetekendeGeometryCmd(geom)))),
        routingStart$.pipe(
          switchMap(start =>
            routeEventProcessor$.pipe(
              tap(routeState =>
                this.dispatch(
                  prt.VervangFeaturesCmd(SegmentLaagNaam, featuresIn(start.polygonStyleFunction)(routeState), kaartLogOnlyWrapper)
                )
              )
            )
          )
        ),
        doubleClick$
      )
    );

    // TODO werkt selector weg
    const onderdrukBoodschapOpties$ = this.accumulatedOpties$(BevraagKaartUiSelector).pipe(
      sample(this.initialising$),
      tap(() => {
        this.dispatch(ZetKaartBevragenOptiesCmd({ infoServiceOnderdrukt: true, kaartBevragenOnderdrukt: true }));
        // this.dispatch(ZetMaarkeerKaartklikOptiesCmd({ disabled: true }));
      }),
      switchMap(opties => this.destroying$.pipe(tap(() => this.dispatch(ZetKaartBevragenOptiesCmd(opties)))))
    );

    onderdrukBoodschapOpties$.subscribe();
  }
}
