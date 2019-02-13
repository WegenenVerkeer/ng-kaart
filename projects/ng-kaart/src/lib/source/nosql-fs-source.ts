import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { Observable, Subject } from "rxjs";

import * as le from "../kaart/kaart-load-events";
import { kaartLogger } from "../kaart/log";
import { fetchWithTimeout } from "../util/fetch-with-timeout";
import * as geojsonStore from "../util/geojson-store";
import { GeoJsonLike } from "../util/geojson-store";

const FETCH_TIMEOUT = 5000; // max time to wait for data from featureserver before checking cache

/**
 * Stappen:

 1. Er komt een extent binnen van de kaart om de features op te vragen
 2. NosqlfsLoader gaat de features voor die extent opvragen aan featureserver
 3. Bij ontvangen van de features worden deze bewaard in een indexeddb (1 per laag), gemanaged door ng-kaart
 4. Indien NosqlfsLoader binnen 5 seconden geen antwoord heeft gekregen, worden de features uit de indexeddb gehaald


  Indexering: 4 indexen op minx, miny, maxx, maxy en intersect nemen?

 */

export class NosqlFsSource extends ol.source.Vector {
  private static readonly featureDelimiter = "\n";
  private static format = new ol.format.GeoJSON();
  private static decoder = new TextDecoder();
  private readonly loadEventSubj = new rx.Subject<le.DataLoadEvent>();
  readonly loadEvent$: rx.Observable<le.DataLoadEvent> = this.loadEventSubj;

  constructor(
    private readonly database: string,
    private readonly collection: string,
    private readonly url = "/geolatte-nosqlfs",
    private readonly view: Option<string>,
    private readonly filter: Option<string>,
    private readonly laagnaam: string,
    private readonly gebruikCache: boolean
  ) {
    super({
      loader: function(extent) {
        const source = this;
        source.fetchFeatures$(extent).subscribe(
          geojson => {
            source.addFeature(
              new ol.Feature({
                id: geojson.id,
                properties: geojson.properties,
                geometry: NosqlFsSource.format.readGeometry(geojson.geometry),
                laagnaam: source.laagnaam
              })
            );
          },
          error => {
            if (source.gebruikCache) {
              kaartLogger.debug("Request niet gelukt, we gaan naar cache " + error);
              geojsonStore
                .getFeaturesByExtent(source.laagnaam, extent)
                .then(source.addFeatures)
                .catch(() => source.dispatchLoadError(error));
            } else {
              source.dispatchLoadError(error);
            }
          }
        );
      },
      strategy: ol.loadingstrategy.bbox
    });
  }

  fetchFeatures$(extent: number[]): Observable<GeoJsonLike> {
    const params = {
      bbox: extent.join(","),
      ...this.view.fold({}, v => ({ "with-view": v })),
      ...this.filter.fold({}, f => ({ query: encodeURIComponent(f) }))
    };

    const httpUrl = `${this.url}/api/databases/${this.database}/${this.collection}/query?${Object.keys(params)
      .map(function(key) {
        return key + "=" + params[key];
      })
      .join("&")}`;

    const geoJsonSubj = new Subject<GeoJsonLike>();

    const source = this;

    source.clear();

    this.dispatchLoadEvent(le.LoadStart);

    fetchWithTimeout(
      httpUrl,
      {
        cache: "no-store", // geen client side caching van nosql data
        credentials: "include" // essentieel om ACM Authenticatie cookies mee te sturen
      },
      FETCH_TIMEOUT
    )
      .then(response => {
        if (!response.ok) {
          kaartLogger.error(`Probleem bij ontvangen nosql ${source.collection} data: status ${response.status} ${response.statusText}`);
          source.dispatchLoadError(`Http error code ${response.status}: '${response.statusText}'`);
          geoJsonSubj.error(`Http error code ${response.status}: '${response.statusText}'`);
          return;
        }

        if (!response.body) {
          kaartLogger.error(`Probleem bij ontvangen nosql ${source.collection} data: response.body is leeg`);
          source.dispatchLoadError("Lege respons");
          geoJsonSubj.error(`Http error code ${response.status}: '${response.statusText}'`);
          return;
        }

        let restData = "";
        let teParsenFeatureGroep: string[] = [];

        const reader = response.body.getReader();
        reader
          .read()
          .then(function verwerkChunk({ done, value }) {
            source.dispatchLoadEvent(le.PartReceived);
            restData += NosqlFsSource.decoder.decode(value || new Uint8Array(0), {
              stream: !done
            }); // append nieuwe data (in geval er een half ontvangen lijn is van vorige call)

            let ontvangenLijnen = restData.split(NosqlFsSource.featureDelimiter);

            if (!done) {
              // laatste lijn is vermoedelijk niet compleet. Hou bij voor volgende keer
              restData = ontvangenLijnen[ontvangenLijnen.length - 1];
              // verwijder gedeeltelijke lijn
              ontvangenLijnen = ontvangenLijnen.slice(0, -1);
            }

            // verwerk in batches van 100
            teParsenFeatureGroep = teParsenFeatureGroep.concat(ontvangenLijnen);
            if (teParsenFeatureGroep.length > 100 || done) {
              source.parseStringsToFeatures(teParsenFeatureGroep).map(geojson => geoJsonSubj.next(geojson));
              teParsenFeatureGroep = [];
            }

            if (!done) {
              reader.read().then(verwerkChunk);
            } else {
              source.dispatchLoadComplete();
            }
          })
          .catch(reason => {
            source.dispatchLoadError(reason);
            geoJsonSubj.error(reason);
          });
      })
      .catch(reason => {
        source.dispatchLoadError(reason);
        geoJsonSubj.error(reason);
      });

    return geoJsonSubj.asObservable();
  }

  private parseStringsToFeatures(volledigeLijnen: string[]): GeoJsonLike[] {
    try {
      const features = volledigeLijnen //
        .filter(lijn => lijn.trim().length > 0) //
        .map(lijn => JSON.parse(lijn));
      return features!;
    } catch (error) {
      kaartLogger.error(`Kon JSON data niet parsen: ${error}`);
      throw new Error(`Kon JSON data niet parsen: ${error}`);
    }
  }

  private dispatchLoadEvent(evt: le.DataLoadEvent) {
    this.loadEventSubj.next(evt);
  }

  private dispatchLoadComplete() {
    this.dispatchLoadEvent(le.LoadComplete);
  }

  private dispatchLoadError(error: any) {
    this.dispatchLoadEvent(le.LoadError(error.toString()));
  }
}
