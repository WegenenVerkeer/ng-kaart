import { fromPredicate, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import proj4 from "proj4";

export function wgs84ToLambert72(coordinate: [number, number]): [number, number] {
  return ol.proj.transform(coordinate, "EPSG:4326", "EPSG:31370");
}

export function lambert72ToWgs84(coordinate: [number, number]): [number, number] {
  return ol.proj.transform(coordinate, "EPSG:31370", "EPSG:4326");
}

export function switchVolgorde(coordinate: [number, number]): [number, number] {
  return [coordinate[1], coordinate[0]];
}

export const formatCoordinate: (_: number) => (_: [number, number]) => string = decimals => coordinate =>
  `${coordinate[0].toFixed(decimals)}, ${coordinate[1].toFixed(decimals)}`;

export const parseCoordinate: (_: string) => Option<[number, number]> = coordTxt => {
  const coords = coordTxt
    .split(",")
    .map(s => Number(s))
    .filter(n => !isNaN(n));
  return fromPredicate((cs: number[]) => cs.length === 2)(coords) as Option<[number, number]>;
};

ol.proj.setProj4(proj4);
proj4.defs(
  "EPSG:31370",
  "+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367486666666666 +x_0=150000.013 +y_0=5400088.438 " +
    "+ellps=intl +towgs84=-125.8,79.9,-100.5 +units=m +no_defs"
);
