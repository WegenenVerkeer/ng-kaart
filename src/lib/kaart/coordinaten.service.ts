import { Injectable } from "@angular/core";

import * as ol from "openlayers";
import proj4 from "proj4";

@Injectable()
export class CoordinatenService {
  static configureerLambert72(): void {
    ol.proj.setProj4(proj4);
    proj4.defs(
      "EPSG:31370",
      "+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367486666666666 +x_0=150000.013 +y_0=5400088.438 " +
        "+ellps=intl +towgs84=-125.8,79.9,-100.5 +units=m +no_defs"
    );
  }

  constructor() {
    CoordinatenService.configureerLambert72();
  }

  /**
   * Zet WGS 84 om naar Lambert 72
   *
   * @param latitude latitude
   * @param longitude longitude
   * @returns Lambert 72 coordinaat
   */
  transformWgs84(latitude: number, longitude: number): [number, number] {
    return this.transform([latitude, longitude], "EPSG:4326");
  }

  /**
   * Zet coordinaat om van de gegeven EPSG code naar Lambert 72
   *
   * @param coordinate
   * @param source SRS
   * @returns Lambert 72 coordinaat
   */
  transform(coordinate: [number, number], source: string): [number, number] {
    if (source === "EPSG:31370") {
      return coordinate;
    }

    return ol.proj.transform(coordinate, source, "EPSG:31370");
  }
}
