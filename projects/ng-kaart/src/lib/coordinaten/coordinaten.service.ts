import { array, eq, option, set } from "fp-ts";
import {
  Endomorphism,
  Function1,
  Function2,
  Predicate,
} from "fp-ts/lib/function";

import proj4 from "proj4";

import { Consumer1, PartialFunction1 } from "../util/function";
import * as ol from "../util/openlayers-compat";

export namespace Epsg {
  export const Lambert72 = "EPSG:31370";
  export const Lambert2008 = "EPSG:3812";
  export const WebMercator = "EPSG:3857";
  export const Wgs84 = "EPSG:4326";
  export const Etrs89 = "EPSG:4258";
  export const LaeaEurope = "EPSG:3035";
  export const GoogleMercator = "EPSG:900913";

  export const all = [
    Lambert72,
    Wgs84,
    WebMercator,
    GoogleMercator,
    Lambert2008,
    Etrs89,
    LaeaEurope,
  ];
}

export function wgs84ToLambert72(coordinate: ol.Coordinate): ol.Coordinate {
  return ol.proj.transform(coordinate, Epsg.Wgs84, Epsg.Lambert72);
}

export function lambert72ToWgs84(coordinate: ol.Coordinate): ol.Coordinate {
  return ol.proj.transform(coordinate, Epsg.Lambert72, Epsg.Wgs84);
}

export const reprojectLambert72: Function1<
  string,
  Endomorphism<ol.Coordinate>
> = (projection) => (coordinate) =>
  ol.proj.transform(coordinate, Epsg.Lambert72, projection);

export function switchVolgorde(coordinate: ol.Coordinate): ol.Coordinate {
  return [coordinate[1], coordinate[0]];
}

export const roundCoordinate: Function2<
  ol.Coordinate,
  number,
  ol.Coordinate
> = (coordinate, decimals) => {
  const pow = Math.pow(10, decimals);
  return [
    Math.round(coordinate[0] * pow) / pow,
    Math.round(coordinate[1] * pow) / pow,
  ];
};

export const formatCoordinate: (_: number) => (_: ol.Coordinate) => string = (
  decimals
) => (coordinate) =>
  `${coordinate[0].toFixed(decimals)}, ${coordinate[1].toFixed(decimals)}`;

export const parseCoordinate: (_: string) => option.Option<ol.Coordinate> = (
  coordTxt
) => {
  const coords = coordTxt
    .split(",")
    .map((s) => Number(s))
    .filter((n) => !isNaN(n));
  return option.fromPredicate((cs: number[]) => cs.length === 2)(
    coords
  ) as option.Option<ol.Coordinate>;
};

const supportedProjections = new Set(Epsg.all);

const stringIntersector = set.intersection(eq.eqString);

const first: Function1<Set<string>, option.Option<string>> = (
  xs: Set<string>
) => (xs.size > 0 ? option.some(xs.values().next().value) : option.none);

export const supportedProjection: PartialFunction1<string[], string> = (
  projections
) => first(stringIntersector(supportedProjections, new Set(projections)));

// Onze dienstkaartextent
const Lambert72Extent: ol.Extent = [18000.0, 152999.75, 280144.0, 415143.75];

const updateExtent = (crs: string) =>
  ol.proj
    .get(crs)
    .setExtent(ol.proj.transformExtent(Lambert72Extent, Epsg.Lambert72, crs));

proj4.defs(
  Epsg.Lambert72,
  "+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367486666666666 +x_0=150000.013 +y_0=5400088.438 " +
    "+ellps=intl +towgs84=-125.8,79.9,-100.5 +units=m +no_defs"
);
proj4.defs(
  Epsg.Lambert2008,
  "+proj=lcc +lat_1=49.83333333333334 +lat_2=51.16666666666666 +lat_0=50.797815 +lon_0=4.359215833333333 +x_0=649328 +y_0=665262 " +
    "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);
proj4.defs(
  Epsg.WebMercator,
  "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs"
);
proj4.defs(
  Epsg.Etrs89,
  "+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs"
);
proj4.defs(
  Epsg.LaeaEurope,
  "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);
proj4.defs(
  Epsg.GoogleMercator,
  "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs"
);

ol.proj.setProj4(proj4); // Moet na proj4.defs komen

updateExtent(Epsg.Lambert72);
updateExtent(Epsg.Lambert2008);
updateExtent(Epsg.WebMercator);
updateExtent(Epsg.Etrs89);
updateExtent(Epsg.LaeaEurope);
updateExtent(Epsg.GoogleMercator);
updateExtent(Epsg.Wgs84);

export namespace Coordinates {
  export const setoid: eq.Eq<ol.Coordinate> = array.getEq(eq.eqNumber);
  export const equalTo: Function1<ol.Coordinate, Predicate<ol.Coordinate>> = (
    coord1
  ) => (coord2) => setoid.equals(coord1, coord2);
  export const equal: Function2<ol.Coordinate, ol.Coordinate, boolean> = (
    coord1,
    coord2
  ) => setoid.equals(coord1, coord2);
}
