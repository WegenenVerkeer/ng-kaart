import { Function1, Function2, Lazy } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

import { NosqlFsSource } from "../../source";
import { PartialFunction1 } from "../../util/function";
import { Pipeable } from "../../util/operators";
import * as ke from "../kaart-elementen";
import { ModelChanges } from "../model-changes";

export const tabulerbareLagen$: Function1<ModelChanges, rx.Observable<ke.ToegevoegdeVectorLaag[]>> = changes =>
  changes.lagenOpGroep["Voorgrond.Hoog"].pipe(map(lgn => lgn.filter(ke.isToegevoegdeVectorLaag)));

export const laagTitels$: Pipeable<ke.ToegevoegdeVectorLaag[], string[]> = lagen$ => lagen$.pipe(map(lgn => lgn.map(lg => lg.titel)));

export interface NoSqlFsLaagAndData {
  readonly titel: string;
  readonly veldInfos: ke.VeldInfo[];

  readonly source: NosqlFsSource;
  readonly data: Lazy<ol.Feature[]>;
  // later
  // readonly canRequestFullData: boolean;
  // readonly fetchAllData();  --> of nog beter in losse functie?
  // readonly ord: Ord<ol.Feature>;
}

export const NoSqlFsLaagAndData: PartialFunction1<ke.ToegevoegdeVectorLaag, NoSqlFsLaagAndData> = laag =>
  ke.ToegevoegdeVectorLaag.noSqlFsSourceFold.headOption(laag).map(source => ({
    titel: laag.titel,
    veldInfos: ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag),
    source,
    data: () => source.getFeatures()
  }));

export const dataInBbox: Function2<NoSqlFsLaagAndData, ol.Extent, ol.Feature[]> = (laagAndData, bbox) =>
  laagAndData.data().filter(feature => ol.extent.intersects(feature.getGeometry().getExtent(), bbox));
