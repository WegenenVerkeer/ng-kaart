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
  private format = new ol.format.GeoJSON();
  private decoder = new TextDecoder();

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
        kaartLogger.debug(new Date() + " nosql: start load");

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
            kaartLogger.error("Probleem bij ontvangen nosql " + collection + " data: status " + response.status);
            return;
          }

          let ontvangenData = "";
          let teParsenFeatureGroep: string[] = [];

          const reader = response.body!.getReader();
          reader.read().then(function verwerkChunk({ done, value }) {
            ontvangenData += source.decoder.decode(value || new Uint8Array(0), {
              stream: !done
            }); // append nieuwe data (in geval er een half ontvangen lijn is van vorige call)

            let ontvangenLijnen = ontvangenData.split(NosqlFsSource.featureDelimiter);

            if (!done) {
              // laatste lijn is vermoedelijk niet compleet. Hou bij voor volgende keer
              ontvangenData = ontvangenLijnen[ontvangenLijnen.length - 1];
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
    kaartLogger.debug("nosql: " + volledigeLijnen.length + " features om toe te voegen");

    const features = volledigeLijnen.filter(lijn => lijn.trim().length > 0).map(lijn => {
      const geojson: GeoJsonLike = JSON.parse(lijn);
      return new ol.Feature({
        id: geojson.id,
        properties: geojson.properties,
        geometry: this.format.readGeometry(geojson.geometry),
        laagnaam: this.laagnaam
      });
    });

    this.addFeatures(features!);
  }
}
