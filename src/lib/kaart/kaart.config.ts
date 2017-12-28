import * as ol from "openlayers";

export class KaartConfig {
  wdb = {
    urls: [] as string[]
  };

  orthofotomozaiek = {
    naam: "Ortho" as string,
    urls: [] as string[]
  };

  srs = "EPSG:31370" as string;

  defaults = {
    zoom: 2 as number,
    middelpunt: [130000, 193000] as ol.Coordinate,
    grootte: [undefined, 500] as [number, number]
  };
}
