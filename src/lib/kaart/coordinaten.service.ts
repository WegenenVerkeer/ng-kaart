import { Injectable } from "@angular/core";

import * as ol from "openlayers";

@Injectable()
export class CoordinatenService {
  constructor() {}

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
