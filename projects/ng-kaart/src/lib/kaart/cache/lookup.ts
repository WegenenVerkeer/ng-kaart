import { Lazy, Predicate } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { filter, map } from "rxjs/operators";

import { toOlFeature } from "../../util/feature";
import * as geojsonStore from "../../util/indexeddb-geojson-store";
import * as ol from "../../util/openlayers-compat";

export interface CachedFeatureLookup {
  readonly all$: Lazy<rx.Observable<ol.Feature>>;
  readonly filtered$: (pf: Predicate<ol.Feature>) => rx.Observable<ol.Feature>; // een shorthand voor all + filter
  readonly inExtent$: (e: ol.Extent) => rx.Observable<ol.Feature>;
  readonly filteredInExtent$: (
    e: ol.Extent,
    pf: Predicate<ol.Feature>
  ) => rx.Observable<ol.Feature>;
  readonly byIds$: (as: (number | string)[]) => rx.Observable<ol.Feature>;
}

export namespace CachedFeatureLookup {
  export const fromObjectStore: (
    storeName: string,
    laagnaam: string
  ) => CachedFeatureLookup = (storeName, laagnaam) => {
    const all$ = () =>
      geojsonStore.getAllFeatures(storeName).pipe(map(toOlFeature(laagnaam)));
    const inExtent$ = (extent: ol.Extent) =>
      geojsonStore
        .getFeaturesByExtent(storeName, extent)
        .pipe(map(toOlFeature(laagnaam)));
    return {
      all$: all$,
      filtered$: (pred) => all$().pipe(filter(pred)),
      inExtent$: inExtent$,
      filteredInExtent$: (extent, pred) => inExtent$(extent).pipe(filter(pred)),
      byIds$: (keys) =>
        geojsonStore
          .getFeaturesByIds(storeName, keys)
          .pipe(map(toOlFeature(laagnaam))),
    };
  };

  export const fromFailureMessage: (msg: string) => CachedFeatureLookup = (
    msg
  ) => {
    const errGen = () =>
      rx.throwError(`Geen queries mogelijk wegens eerdere fout: "${msg}"`);
    return {
      all$: errGen,
      filtered$: errGen,
      inExtent$: errGen,
      filteredInExtent$: errGen,
      byIds$: errGen,
    };
  };
}
