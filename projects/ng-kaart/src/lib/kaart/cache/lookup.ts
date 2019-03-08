import { Function1, Function2, Lazy } from "fp-ts/lib/function";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { concatMap, map } from "rxjs/operators";

import { toOlFeature } from "../../util/feature";
import * as geojsonStore from "../../util/indexeddb-geojson-store";

export interface CachedFeatureLookup {
  readonly all$: Lazy<rx.Observable<ol.Feature>>;
  readonly inExtent$: Function1<ol.Extent, rx.Observable<ol.Feature>>;
  readonly byIds$: Function1<(number | string)[], rx.Observable<ol.Feature>>;
}

export namespace CachedFeatureLookup {
  export const fromObjectStore: Function2<string, string, CachedFeatureLookup> = (storeName, laagnaam) => ({
    all$: () => geojsonStore.getAllFeatures(storeName).pipe(concatMap(features => features.map(toOlFeature(laagnaam)))),
    inExtent$: extent => geojsonStore.getFeaturesByExtent(storeName, extent).pipe(map(toOlFeature(laagnaam))),
    byIds$: keys => geojsonStore.getFeaturesByIds(storeName, keys).pipe(map(toOlFeature(laagnaam)))
  });

  export const fromFailureMessage: Function1<string, CachedFeatureLookup> = msg => {
    const errGen = () => rx.throwError(`Geen queries mogelijk wegens eerdere fout: "${msg}"`);
    return {
      all$: errGen,
      inExtent$: errGen,
      byIds$: errGen
    };
  };
}
