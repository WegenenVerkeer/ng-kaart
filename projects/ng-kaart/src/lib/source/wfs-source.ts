import { option } from "fp-ts";
import { filter, map } from "rxjs/operators";

import { toOlFeature } from "../util/feature";
import { fetchObs$ } from "../util/fetch-with-timeout";
import * as ol from "../util/openlayers-compat";
import { urlWithParams } from "../util/url";

import { featureDelimiter, getWithCommonHeaders, getWithoutHeaders, mapToFeatureCollection, split } from "./nosql-fs-source";

export function wfsSource(
  laagnaam: string,
  srsname: string,
  version: string,
  typenames: string,
  baseUrl: string,
  geomField: string,
  cqlFilter: option.Option<string>,
  cors: boolean
): ol.source.Vector {
  const maybeEncodedFilter = cqlFilter.map(f => ` AND (${f})`).map(encodeURIComponent);
  const precalculatedUrl = urlWithParams(baseUrl, {
    srsname,
    version,
    outputFormat: "application/json",
    request: "GetFeature",
    typenames
  });

  function load(extent: ol.Extent) {
    const extentUrl = `${precalculatedUrl}&cql_filter=bbox(${geomField},${extent.join(",")})`;
    const composedQueryUrl = maybeEncodedFilter.fold(extentUrl, encodedFilter => extentUrl + encodedFilter);
    const features$ = fetchObs$(composedQueryUrl, cors ? getWithoutHeaders() : getWithCommonHeaders()).pipe(
      split(featureDelimiter),
      filter(lijn => lijn.trim().length > 0),
      mapToFeatureCollection,
      map(featureCollection => featureCollection.features)
    );
    features$.subscribe(features => {
      source.clear();
      source.addFeatures(features.map(toOlFeature(laagnaam)));
    });
  }

  const source = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    loader: load,
    strategy: ol.loadingstrategy.bbox
  });

  return source;
}
