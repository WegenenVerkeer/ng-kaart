import { Option } from "fp-ts/lib/Option";
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
  private static format = new ol.format.GeoJSON();
  private static decoder = new TextDecoder();

  constructor(
    private readonly database: string,
    private readonly collection: string,
    private readonly url = "/geolatte-nosqlfs",
    private readonly view: Option<string>,
    private readonly filter: Option<string>,
    private readonly laagnaam: string
  ) {
    super({
      loader: function(extent, resolution, projection) {
        const params = {
          bbox: extent.join(","),
          ...view.fold({}, v => ({ "with-view": v })),
          ...filter.fold({}, f => ({ query: encodeURIComponent(f) }))
        };

        const httpUrl = `${url}/api/databases/${database}/${collection}/query?${Object.keys(params)
          .map(function(key) {
            return key + "=" + params[key];
          })
          .join("&")}`;

        const source = this;

        fetch(httpUrl).then(response => {
          if (response.status !== 200) {
            kaartLogger.error(`Probleem bij ontvangen nosql ${collection} data: status ${response.status}`);
            return;
          }

          let restData = "";
          let teParsenFeatureGroep: string[] = [];

          if (!response.body) {
            kaartLogger.error(`Probleem bij ontvangen nosql ${collection} data: response.body is leeg`);
            return;
          }

          const reader = response.body.getReader();
          reader.read().then(function verwerkChunk({ done, value }) {
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
              source.verwerkFeaturesGeoJson(teParsenFeatureGroep);
              teParsenFeatureGroep = [];
            }

            if (!done) {
              return reader.read().then(verwerkChunk);
            } else {
              return;
            }
          });
        });
      },
      strategy: ol.loadingstrategy.bbox
    });
  }

  verwerkFeaturesGeoJson(volledigeLijnen: string[]) {
    try {
      const features = volledigeLijnen //
        .filter(lijn => lijn.trim().length > 0) //
        .map(lijn => {
          const geojson: GeoJsonLike = JSON.parse(lijn);
          return new ol.Feature({
            id: geojson.id,
            properties: geojson.properties,
            geometry: NosqlFsSource.format.readGeometry(geojson.geometry),
            laagnaam: this.laagnaam
          });
        });
      this.addFeatures(features!);
    } catch (error) {
      return kaartLogger.error(`Kon JSON data niet parsen: ${error}`);
    }
  }
}
