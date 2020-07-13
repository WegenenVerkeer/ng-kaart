import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { AfterViewInit, Component, NgZone, OnInit, QueryList, ViewChildren } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { option } from "fp-ts";
import { Function1, Predicate } from "fp-ts/lib/function";
import { AbsoluteOrientationSensor } from "motion-sensors-polyfill";
import * as rx from "rxjs";
import {
  buffer,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  mapTo,
  mergeAll,
  pairwise,
  scan,
  shareReplay,
  startWith,
  throttle,
  throttleTime
} from "rxjs/operators";

import { Transparantie } from "../../transparantieeditor/transparantie";
import { forEach } from "../../util";
import * as ol from "../../util/openlayers-compat";
import { catOptions } from "../../util/operators";
import { mobile } from "../kaart-config";
import * as ke from "../kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import { KaartModusDirective } from "../kaart-modus.directive";
import { Viewinstellingen } from "../kaart-protocol";
import * as prt from "../kaart-protocol";
import { MijnLocatieStateChangeCmd } from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";

export const MijnLocatieUiSelector = "Mijnlocatie";
const MijnLocatieLaagNaam = "Mijn Locatie";

const TrackingInterval = 500; // aantal milliseconden tussen tracking updates

export type State = "TrackingDisabled" | "NoTracking" | "Tracking" | "TrackingCenter" | "TrackingAutoRotate";

export type Event = "ActiveerEvent" | "DeactiveerEvent" | "PanEvent" | "ZoomEvent" | "RotateEvent" | "ClickEvent";

interface EventMetVerschil {
  readonly event: Event;
  readonly verschil: number;
}

export type EventMap = { [event in Event]: State };
export type StateMachine = { [state in State]: EventMap };

const isEventRelevant = (event: EventMetVerschil) => {
  switch (event.event) {
    case "ActiveerEvent":
      return true;
    case "DeactiveerEvent":
      return true;
    case "PanEvent":
      return true;
    case "ZoomEvent":
      return event.verschil > 1.0;
    case "RotateEvent":
      return event.verschil > 0.5;
    case "ClickEvent":
      return true;
  }
};

interface TrackingInfo {
  readonly feature: option.Option<ol.Feature>;
  readonly zoom: number;
  readonly accuracy: number;
  readonly doelzoom: number;
  readonly currentRotation: number;
  readonly rotatie: number;
  readonly coordinate: ol.Coordinate;
  readonly state: State;
  readonly stateVeranderd: boolean;
}

const afstandTussenCoordinaten = (c1: ol.Coordinate, c2: ol.Coordinate) => {
  const line = new ol.geom.LineString([c1, c2]);
  return line.getLength();
};

const isTrackingInfoGelijk = (t1: TrackingInfo, t2: TrackingInfo) => {
  return (
    Math.round(t1.zoom) === Math.round(t2.zoom) &&
    Math.abs(t1.currentRotation - t2.currentRotation) < 0.5 &&
    afstandTussenCoordinaten(t1.coordinate, t2.coordinate) < 1.0 &&
    t1.state === t2.state &&
    t1.stateVeranderd === t2.stateVeranderd
  );
};

export const NoOpStateMachine: StateMachine = {
  NoTracking: {
    ClickEvent: "NoTracking",
    ActiveerEvent: "NoTracking",
    DeactiveerEvent: "NoTracking",
    PanEvent: "NoTracking",
    ZoomEvent: "NoTracking",
    RotateEvent: "NoTracking"
  },
  TrackingCenter: {
    ClickEvent: "TrackingCenter",
    PanEvent: "TrackingCenter",
    ActiveerEvent: "TrackingCenter",
    DeactiveerEvent: "NoTracking",
    ZoomEvent: "TrackingCenter",
    RotateEvent: "TrackingCenter"
  },
  TrackingDisabled: {
    ClickEvent: "TrackingDisabled",
    ActiveerEvent: "NoTracking",
    DeactiveerEvent: "NoTracking",
    PanEvent: "TrackingDisabled",
    ZoomEvent: "TrackingDisabled",
    RotateEvent: "TrackingDisabled"
  },
  Tracking: {
    ClickEvent: "Tracking",
    ActiveerEvent: "Tracking",
    DeactiveerEvent: "NoTracking",
    PanEvent: "Tracking",
    ZoomEvent: "Tracking",
    RotateEvent: "Tracking"
  },
  TrackingAutoRotate: {
    ClickEvent: "TrackingAutoRotate",
    ActiveerEvent: "TrackingAutoRotate",
    DeactiveerEvent: "NoTracking",
    PanEvent: "TrackingAutoRotate",
    ZoomEvent: "TrackingAutoRotate",
    RotateEvent: "TrackingAutoRotate"
  }
};

const pasLocatieFeatureAan = (info: TrackingInfo): void =>
  forEach(info.feature, feature => {
    feature.setGeometry(new ol.geom.Point(info.coordinate));
    zetStijl(info);
    feature.changed(); // force redraw meteen
  });

const moetCentreren: Predicate<State> = state => state === "TrackingCenter" || state === "TrackingAutoRotate";

const moetLocatieTonen: Predicate<State> = state => state === "Tracking" || state === "TrackingCenter" || state === "TrackingAutoRotate";

const moetRoteren: Predicate<State> = state => state === "TrackingAutoRotate";

const moetKijkrichtingTonen: Predicate<State> = state =>
  state === "Tracking" || state === "TrackingCenter" || state === "TrackingAutoRotate";

const zetStijl: Function1<TrackingInfo, void> = info => info.feature.map(feature => feature.setStyle(locatieStijlFunctie(info)));

const locatieStijlFunctie: Function1<TrackingInfo, ol.style.StyleFunction> = info => {
  const fillColor = "rgba(65, 105, 225, 0.15)";
  const fillColorDark = "rgba(65, 105, 225, 0.25)";
  const fillColorDarkTransparant = "rgba(65, 105, 225, 0.0)";

  function binnencirkelStyle(): ol.style.Style {
    return new ol.style.Style({
      zIndex: 2,
      image: new ol.style.Circle({
        fill: new ol.style.Fill({
          color: "rgba(66, 133, 244, 1.0)"
        }),
        stroke: new ol.style.Stroke({
          color: "rgba(255, 255, 255, 1.0)",
          width: 2
        }),
        radius: 6
      })
    });
  }

  function buitencirkelStyle(radius: number): ol.style.Style {
    return new ol.style.Style({
      zIndex: 1,
      image: new ol.style.Circle({
        fill: new ol.style.Fill({
          color: fillColor
        }),
        radius: radius
      })
    });
  }

  function kijkrichtingStyle(info: TrackingInfo, radius: number): option.Option<ol.style.Style> {
    if (moetKijkrichtingTonen(info.state)) {
      const radius2 = 50;

      const canvas = document.createElement("canvas");
      canvas.width = radius2 * 2;
      canvas.height = radius2 * 2;
      const context = canvas.getContext("2d");
      if (context) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const angle1 = 67.5 * (Math.PI / 180.0);
        const angle2 = 22.5 * (Math.PI / 180.0);

        const x1 = centerX + Math.cos(angle1) * centerX;
        const y1 = centerY - Math.sin(angle1) * centerY;
        const x2 = centerX + Math.cos(angle2) * centerX;
        const y2 = centerY - Math.sin(angle2) * centerY;

        const grad = context.createRadialGradient(centerX, centerY, radius2 / 2, centerX, centerY, radius2);
        grad.addColorStop(0, fillColorDark);
        grad.addColorStop(1, fillColorDarkTransparant);

        context.beginPath();
        context.moveTo(centerX, centerY);
        context.lineTo(x1, y1);
        context.arcTo(x2, y1, x2, y2, y2 - y1);
        context.lineTo(centerX, centerY);
        context.fillStyle = grad;
        context.fill();

        const buitenArc = new ol.style.Style({
          image: new ol.style.Icon({
            img: canvas,
            imgSize: [canvas.width, canvas.height],
            rotation: info.currentRotation - (info.rotatie + Math.PI / 4)
          })
        });
        return option.some(buitenArc);
      }
    }
    return option.none;
  }

  return (_: ol.Feature, resolution: number) => {
    const accuracyInPixels = Math.min(info.accuracy, 500) / resolution; // max 500m cirkel, soms accuracy 86000 in chrome bvb...
    const radius = Math.max(accuracyInPixels, 12); // nauwkeurigheid cirkel toch nog tonen zelfs indien ver uitgezoomd

    const binnencirkel: ol.style.Style = binnencirkelStyle();
    const buitencirkel: ol.style.Style = buitencirkelStyle(radius);
    const kijkrichting: option.Option<ol.style.Style> = kijkrichtingStyle(info, radius);

    return kijkrichting.map(arc => [binnencirkel, buitencirkel, arc]).getOrElse([binnencirkel, buitencirkel]);
  };
};

// FIXME: deze component leidt af van KaartModusComponent maar voldoet niet aan het contract (moet laten weten wanneer
// hij ge(de)activeerd wordt). Dus ofwel niet als modus component te bezien ofwel contract naleven.
@Component({
  selector: "awv-kaart-mijn-locatie",
  templateUrl: "./kaart-mijn-locatie.component.html",
  styleUrls: ["./kaart-mijn-locatie.component.scss"]
})
export class KaartMijnLocatieComponent extends KaartModusDirective implements OnInit, AfterViewInit {
  constructor(zone: NgZone, private readonly parent: KaartComponent, breakpointObserver: BreakpointObserver) {
    super(parent, zone);
    breakpointObserver.observe([Breakpoints.HandsetPortrait]).subscribe(result => {
      // Gebruik van built-in breakpoints uit de Material Design spec: https://material.angular.io/cdk/layout/overview
      this.handsetPortrait = result.matches && this.onMobileDevice;
    });
  }

  private viewinstellingen$: rx.Observable<Viewinstellingen> = rx.EMPTY;
  private zoomdoelSetting$: rx.Observable<option.Option<number>> = rx.EMPTY;
  private locatieSubj: rx.Subject<Position> = new rx.Subject<Position>();
  private rotatieSubj: rx.Subject<number> = new rx.Subject<number>();

  private eventsSubj: rx.Subject<EventMetVerschil> = new rx.Subject<EventMetVerschil>();

  currentState$: rx.Observable<State> = rx.of("TrackingDisabled" as State);
  enabled$: rx.Observable<boolean> = rx.of(true);

  readonly onMobileDevice = mobile;
  handsetPortrait = false;

  @ViewChildren("locateBtn")
  locateBtnQry: QueryList<MatButton>;

  private mijnLocatie: option.Option<ol.Feature> = option.none;
  private watchId: option.Option<number> = option.none;
  private sensor: option.Option<AbsoluteOrientationSensor> = option.none;

  private zoomIsGevraagd = false;
  private rotatieIsGevraagd = false;

  modus(): string {
    return MijnLocatieUiSelector;
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.dispatch({
      type: "VoegLaagToe",
      positie: 0,
      laag: this.createLayer(),
      magGetoondWorden: true,
      transparantie: Transparantie.opaak,
      laaggroep: "Tools",
      legende: option.none,
      stijlInLagenKiezer: option.none,
      filterinstellingen: option.none,
      laagtabelinstellingen: option.none,
      wrapper: kaartLogOnlyWrapper
    });

    this.viewinstellingen$ = this.parent.modelChanges.viewinstellingen$;
    this.zoomdoelSetting$ = this.parent.modelChanges.mijnLocatieZoomDoel$;
    this.enabled$ = this.zoomdoelSetting$.pipe(map(m => m.isSome()));
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();

    const zoomdoel$: rx.Observable<number> = this.zoomdoelSetting$.pipe(catOptions); // Hou enkel de effectieve zoomniveaudoelen over
    const zoom$ = this.viewinstellingen$.pipe(
      distinctUntilChanged((vi1, vi2) => vi1.zoom === vi2.zoom && vi1.minZoom === vi2.minZoom && vi1.maxZoom === vi2.maxZoom),
      map(vi => vi.zoom)
    );
    const currentRotation$ = this.viewinstellingen$.pipe(
      distinctUntilChanged((vi1, vi2) => vi1.rotation === vi2.rotation),
      map(vi => vi.rotation)
    );

    // Event handlers
    this.bindToLifeCycle(this.parent.modelChanges.dragInfo$).subscribe(() => {
      this.eventsSubj.next({ event: "PanEvent", verschil: 0 });
    });

    // We moeten de rotatie-events die we zelf triggeren negeren.
    this.bindToLifeCycle(
      this.parent.modelChanges.rotatie$.pipe(
        pairwise(),
        throttle(() => {
          if (this.rotatieIsGevraagd) {
            this.rotatieIsGevraagd = false;
            return rx.timer(500);
          } else {
            return rx.timer(1);
          }
        }),
        filter(() => !this.rotatieIsGevraagd),
        map(([oud, nieuw]) => Math.abs(oud - nieuw))
      )
    ).subscribe(verschil => this.eventsSubj.next({ event: "RotateEvent", verschil }));

    // We moeten de zoom-events die we zelf triggeren negeren.
    this.bindToLifeCycle(
      zoom$.pipe(
        pairwise(),
        throttle(() => {
          if (this.zoomIsGevraagd) {
            this.zoomIsGevraagd = false;
            return rx.timer(500);
          } else {
            return rx.timer(1);
          }
        }),
        filter(() => !this.zoomIsGevraagd),
        map(([oud, nieuw]) => Math.abs(oud - nieuw))
      )
    ).subscribe(verschil => this.eventsSubj.next({ event: "ZoomEvent", verschil }));

    // "State machine"
    const stateMachine: StateMachine = this.getStateMachine();

    this.currentState$ = rx
      .merge(
        this.eventsSubj.pipe(
          // Wanneer er op mobile met twee vingers gedragd wordt, krijgen we op korte tijd een zoom-, somes een rotate- en dragevent
          // we willen die hier groeperen en dan de "niet relevante" (kleine verandering) events eruit halen.
          buffer(this.eventsSubj.pipe(debounceTime(500))),
          map(events => {
            if (events.length === 1) {
              return events;
            } else {
              return events.filter(isEventRelevant);
            }
          }),
          map(events => events.map(event => event.event)),
          mergeAll()
        ), //
        this.wordtActief$.pipe(mapTo("ActiveerEvent")),
        this.wordtInactief$.pipe(mapTo("DeactiveerEvent"))
      )
      .pipe(
        startWith("TrackingDisabled"),
        scan<Event, State>((state: State, event: Event) => {
          const newState = stateMachine[state][event];
          this.dispatch(MijnLocatieStateChangeCmd(state, newState, event));
          return newState;
        }),
        shareReplay(1)
      );

    // pas positie aan bij nieuwe locatie
    this.bindToLifeCycle(
      rx
        .combineLatest([
          zoom$,
          zoomdoel$,
          currentRotation$,
          this.rotatieSubj.pipe(throttleTime(TrackingInterval)),
          this.locatieSubj.pipe(throttleTime(TrackingInterval)),
          this.currentState$.pipe(pairwise())
        ])
        .pipe(
          filter(([, , , , , [, state]]) => {
            return this.isTrackingActief(state);
          }),
          map(([zoom, doel, currentRotation, rotatie, locatie, [prevState, state]]) => {
            const longLat: ol.Coordinate = [locatie.coords.longitude, locatie.coords.latitude];
            const coordinate = ol.proj.fromLonLat(longLat, "EPSG:31370");
            return {
              feature: option.none,
              zoom,
              accuracy: locatie.coords.accuracy,
              doelzoom: doel,
              currentRotation,
              rotatie,
              coordinate,
              state,
              stateVeranderd: prevState !== state
            };
          }),
          distinctUntilChanged(isTrackingInfoGelijk)
        )
    ).subscribe(r => this.zetMijnPositie(r));

    // pas rotatie aan
    this.bindToLifeCycle(
      rx.combineLatest([this.rotatieSubj.pipe(throttleTime(TrackingInterval)), this.currentState$]).pipe(
        filter(([, state]) => {
          return moetRoteren(state);
        }),
        map(([rotatie]) => rotatie)
      )
    ).subscribe(rotatie => {
      this.rotatieIsGevraagd = true;
      this.dispatch(prt.VeranderRotatieCmd(rotatie, option.some(250)));
    });

    this.bindToLifeCycle(this.currentState$).subscribe(state => {
      if ((moetCentreren(state) || moetLocatieTonen(state)) && this.watchId.isNone()) {
        this.startPositieTracking();
      }
      if (!(moetCentreren(state) || moetLocatieTonen(state)) && this.watchId.isSome()) {
        this.stopPositieTracking();
      }
      if ((moetRoteren(state) || moetKijkrichtingTonen(state)) && this.sensor.isNone()) {
        this.startRotatieTracking();
      }
      if (!moetRoteren(state) && !moetKijkrichtingTonen(state) && this.sensor.isSome()) {
        this.stopRotatieTracking();
      }
      this.centreerIndienNodig(state);
    });

    if (navigator.geolocation) {
      this.eventsSubj.next({ event: "ActiveerEvent", verschil: 0 });
    }
    // Nodig omdat we anders wachten tot we een rotatieevent binnenkrijgen voor we de locatie tonen.
    this.rotatieSubj.next(0);
  }

  isTrackingActief(state: State): boolean {
    return state !== "TrackingDisabled" && state !== "NoTracking";
  }

  // Dit is het statemachine van deze modus: Altijd tussen TrackingCenter en NoTracking, initialState: NoTracking
  protected getStateMachine(): StateMachine {
    return {
      ...NoOpStateMachine,
      NoTracking: { ...NoOpStateMachine.NoTracking, ClickEvent: "TrackingCenter" },
      TrackingCenter: { ...NoOpStateMachine.TrackingCenter, ClickEvent: "NoTracking", PanEvent: "NoTracking" }
    };
  }

  click() {
    this.eventsSubj.next({ event: "ClickEvent", verschil: 0 });
  }

  private maakNieuwFeature(info: TrackingInfo): option.Option<ol.Feature> {
    const feature = new ol.Feature(new ol.geom.Point(info.coordinate));
    feature.setStyle(locatieStijlFunctie(info)); // Opgelet hier word de nieuwe feature niet gebruikt
    this.dispatch(prt.VervangFeaturesCmd(MijnLocatieLaagNaam, [feature], kaartLogOnlyWrapper));
    return option.some(feature);
  }

  private meldFout(fout: PositionError | string) {
    kaartLogger.error("error", fout);
    this.dispatch(
      prt.ToonMeldingCmd(["Zoomen naar huidige locatie niet mogelijk", "De toepassing heeft geen toestemming om locatie te gebruiken"])
    );
  }

  private stopPositieTracking() {
    this.watchId.map(watchId => navigator.geolocation.clearWatch(watchId));
    this.watchId = option.none;
    this.mijnLocatie = option.none;
    this.dispatch(prt.VervangFeaturesCmd(MijnLocatieLaagNaam, <Array<ol.Feature>>[], kaartLogOnlyWrapper));
  }

  private startPositieTracking() {
    if (navigator.geolocation) {
      if (this.watchId.isNone()) {
        this.watchId = option.some(
          navigator.geolocation.watchPosition(
            //
            positie => this.locatieSubj.next(positie),
            fout => this.meldFout(fout),
            {
              enableHighAccuracy: true,
              timeout: 20000 // genoeg tijd geven aan gebruiker om locatie toestemming te geven
            }
          )
        );
      }
    } else {
      this.meldFout("Geen geolocatie mogelijk");
    }
  }

  private startRotatieTracking() {
    const sensor = new AbsoluteOrientationSensor({ frequency: 60 });

    const nav = navigator as any; // Onze versie van javascript bevat de permissions typing nog niet.
    Promise.all([
      nav.permissions.query({ name: "accelerometer" }),
      nav.permissions.query({ name: "magnetometer" }),
      nav.permissions.query({ name: "gyroscope" })
    ]).then(
      results => {
        if (results.every(result => result.state === "granted")) {
          sensor.addEventListener("reading", (e: any) => {
            if (e.target) {
              const sensorEvent = e.target as AbsoluteOrientationSensor;
              const q = sensorEvent.quaternion;
              if (q) {
                let heading = Math.atan2(2 * q[0] * q[1] + 2 * q[2] * q[3], 1 - 2 * q[1] * q[1] - 2 * q[2] * q[2]);
                if (heading < 0) {
                  heading = 2 * Math.PI + heading;
                }
                this.rotatieSubj.next(heading);
              }
            }
          });
          sensor.start();
          this.sensor = option.some(sensor);
        } else {
          this.meldFout("Geen toestemming om AbsoluteOrientationSensor te gebruiken");
        }
      },
      () => this.meldFout("Kon geen toestemming krijgen om AbsoluteOrientationSensor te gebruiken")
    );
  }

  private stopRotatieTracking() {
    this.sensor = this.sensor.chain(sensor => {
      sensor.stop();
      return option.none;
    });
  }

  private zetMijnPositie(info: TrackingInfo) {
    if (moetLocatieTonen(info.state)) {
      this.mijnLocatie = this.mijnLocatie
        .chain(() => {
          // TODO hier stond voorheen { feature: option.some(feature), ...info } wat
          // wil zeggen dat we op de bestaande feature van info aan het werken
          // waren. Als we daarentegen op de feature van mijnLocatie willen
          // werken, moeten we onderstaande functie aanpassen om een feature te
          // nemen (die van mijnLocatie). De return moet dan ook op die manier
          // aangepast worden.
          pasLocatieFeatureAan(info);
          return info.feature;
        })
        .orElse(() => {
          return this.maakNieuwFeature(info);
        })
        .map(feature => {
          if (info.stateVeranderd && info.zoom < info.doelzoom && moetCentreren(info.state)) {
            // We zitten nu op een te laag zoomniveau, dus gaan we eerst inzoomen,
            // maar we doen dit alleen wanneer we van een state veranderd zijn.
            this.zoomIsGevraagd = true;
            this.dispatch(prt.VeranderZoomCmd(info.doelzoom, kaartLogOnlyWrapper));
          }
          return feature;
        });
    }

    this.centreerIndienNodig(info.state);
  }

  private centreerIndienNodig(state: State) {
    if (moetCentreren(state)) {
      // kleine delay om OL tijd te geven eerst de icon te verplaatsen
      this.mijnLocatie.map(feature =>
        setTimeout(
          () =>
            this.dispatch(
              prt.VeranderMiddelpuntCmd((<ol.geom.Point>feature.getGeometry()).getCoordinates(), option.some(TrackingInterval))
            ),
          50
        )
      );
    }
  }

  private createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: MijnLocatieLaagNaam,
      source: new ol.source.Vector(),
      clusterDistance: option.none,
      styleSelector: option.none,
      styleSelectorBron: option.none,
      selectieStyleSelector: option.none,
      hoverStyleSelector: option.none,
      selecteerbaar: false,
      hover: false,
      minZoom: 2,
      maxZoom: 15,
      velden: new Map<string, ke.VeldInfo>(),
      offsetveld: option.none,
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false,
      filter: option.none
    };
  }
}
