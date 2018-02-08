import * as ol from "openlayers";
import { kaartLogger } from "../kaart/log";

interface GeoJsonLike {
  type: string;
  id: any;
  properties: any;
  geometry: any;
}

export class NosqlFsSource extends ol.source.Vector {
  private static readonly featureDelimiter = "\n";

  constructor(
    public database: string,
    public collection: string,
    public url = "/geolatte-nosqlfs",
    public view = "default",
    public filter?: string
  ) {
    super({
      loader: function(extent, resolution, projection) {
        const params = {
          bbox: extent.join(","),
          "with-view": encodeURIComponent(view),
          ...filter ? { query: encodeURIComponent(filter) } : {}
        };

        const httpUrl = `${url}/api/databases/${database}/${collection}/query?${Object.keys(params)
          .map(function(key) {
            return key + "=" + params[key];
          })
          .join("&")}`;

        const xhr = new XMLHttpRequest();
        xhr.open("GET", httpUrl, true);
        xhr.setRequestHeader("Accept", "application/json");

        let currentPosition = 0;
        const source = this;
        const format = new ol.format.GeoJSON();
        xhr.onprogress = () => {
          if (xhr.status !== 200) {
            return;
          }

          const positionLastDelimiter = xhr.response.lastIndexOf(NosqlFsSource.featureDelimiter);
          if (positionLastDelimiter === -1) {
            return;
          }

          const tokens: string[] = xhr.response.slice(currentPosition, positionLastDelimiter).split(NosqlFsSource.featureDelimiter);
          currentPosition = positionLastDelimiter;

          const features = tokens.filter(token => token.length > 0).map(token => {
            const geojson: GeoJsonLike = JSON.parse(token);
            return new ol.Feature({
              id: geojson.id,
              properties: geojson.properties,
              geometry: format.readGeometry(geojson.geometry)
            });
          });
          kaartLogger.debug(`Adding ${features.length} features`);
          source.addFeatures(features);
        };
        xhr.onloadstart = () => {
          kaartLogger.debug("onloadstart");
          kaartLogger.debug("Clearing features");
          source.clear();
        };

        xhr.onerror = (event: ErrorEvent) => {
          kaartLogger.error("Fout bij laden nosqlfs data", event.message);
        };
        xhr.onload = () => {
          kaartLogger.debug("onload");
        };
        xhr.onloadend = () => {
          kaartLogger.debug("onloadend");
        };
        xhr.ontimeout = () => {
          kaartLogger.debug("ontimeout");
        };
        xhr.onabort = () => {
          kaartLogger.debug("onabort");
        };

        xhr.send();
      },
      strategy: ol.loadingstrategy.bbox
    });
  }
}
