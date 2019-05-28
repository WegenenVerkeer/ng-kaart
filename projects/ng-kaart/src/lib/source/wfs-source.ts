import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { concatMap, filter, map } from "rxjs/operators";

import { toOlFeature } from "../util/feature";
import { fetchObs$ } from "../util/fetch-with-timeout";
import { urlWithParams } from "../util/url";

import { featureDelimiter, getWithCommonHeaders, mapToFeatureCollection, split } from "./nosql-fs-source";

export function wfsSource(
  laagnaam: string,
  srsName: string,
  version: string,
  typenames: string,
  baseUrl: string,
  cqlFilter: Option<string>
): ol.source.Vector {
  const maybeEncodedFilter = cqlFilter.map(f => ` AND (${f})`).map(encodeURIComponent);
  const precalculatedUrl = urlWithParams(baseUrl, {
    srsname: srsName,
    version: version,
    outputFormat: "application/json",
    request: "GetFeature",
    typenames: typenames
  });

  function load(extent: ol.Extent) {
    const extentUrl = `${precalculatedUrl}&cql_filter=bbox(the_geom,${extent.join(",")})`;
    const composedQueryUrl = maybeEncodedFilter.fold(extentUrl, encodedFilter => extentUrl + encodedFilter);
    const feature$ = fetchObs$(composedQueryUrl, getWithCommonHeaders()).pipe(
      split(featureDelimiter),
      filter(lijn => lijn.trim().length > 0),
      mapToFeatureCollection,
      concatMap(featureCollection => featureCollection.features),
      map(toOlFeature(laagnaam))
    );
    feature$.subscribe(f => source.addFeature(f));
  }

  const source = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    loader: load,
    strategy: ol.loadingstrategy.bbox
  });

  return source;
}
