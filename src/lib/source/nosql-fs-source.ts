import * as ol from "openlayers";
import { kaartLogger } from "../kaart/log";
import { Option } from "fp-ts/lib/Option";

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
    public view: Option<string>,
    public filter: Option<string>
  ) {
    super({
      loader: function(extent, resolution, projection) {
        const params = {
          bbox: extent.join(","),
          ...view.map(v => ({ "with-view": v })),
          ...filter.map(f => ({ filter: f }))
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
            return; // geen delimiter gevonden
          }

          const tokens: string[] = xhr.response.slice(currentPosition, positionLastDelimiter).split(NosqlFsSource.featureDelimiter);
          currentPosition = positionLastDelimiter;

          const features = tokens.filter(token => token.length > 0).map(token => {
            // format.readFeature(token) werkt hier niet vermits in de properties een 'geometry' veld zit en daar kan de ol parser
            // niet mee om. Daarom via tussenstap.
            const geojson: GeoJsonLike = JSON.parse(token);
            return new ol.Feature({
              id: geojson.id,
              properties: geojson.properties,
              geometry: format.readGeometry(geojson.geometry)
            });
          });
          kaartLogger.debug(`nosql: adding ${features.length} features`);
          source.addFeatures(features);
        };
        xhr.onloadstart = () => {
          kaartLogger.debug("nosql: onloadstart");
          kaartLogger.debug("nosql: clearing features");
          source.clear();
        };

        xhr.onerror = (event: ErrorEvent) => {
          kaartLogger.error("nosql: fout bij laden nosqlfs data", event.message);
        };
        xhr.onload = () => {
          kaartLogger.debug("nosql: onload");
        };
        xhr.onloadend = () => {
          kaartLogger.debug("nosql: onloadend ");
        };
        xhr.ontimeout = () => {
          kaartLogger.debug("nosql: ontimeout");
        };
        xhr.onabort = () => {
          kaartLogger.debug("nosql: onabort");
        };

        xhr.send();
      },
      strategy: ol.loadingstrategy.bbox
    });
  }
}
