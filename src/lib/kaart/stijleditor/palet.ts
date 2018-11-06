import * as array from "fp-ts/lib/Array";
import { concat } from "fp-ts/lib/function";

import * as clr from "../../stijl/colour";

// De hardgecodeerde kleuren
export const kleurenpaletKlein = array.catOptions([
  clr.toKleur("groen", "#46af4a"),
  clr.toKleur("geel", "#ffec16"),
  clr.toKleur("rood", "#f44336"),
  clr.toKleur("indigo", "#3d4db7"),
  clr.toKleur("bruin", "#7a5547"),
  clr.toKleur("lichtgroen", "#88d440"),
  clr.toKleur("amber", "#ffc100"),
  clr.toKleur("roze", "#eb1460"),
  clr.toKleur("blauw", "#2196f3"),
  clr.toKleur("grijs", "#9d9d9d"),
  clr.toKleur("limoengroen", "#ccdd1e"),
  clr.toKleur("oranje", "#ff9800"),
  clr.toKleur("paars", "#9c1ab1"),
  clr.toKleur("lichtblauw", "#03a9f4"),
  clr.toKleur("grijsblauw", "#5e7c8b"),
  clr.toKleur("groenblauw", "#009687"),
  clr.toKleur("donkeroranje", "#ff5505"),
  clr.toKleur("donkerpaars", "#6633b9"),
  clr.toKleur("cyaan", "#00bbd5")
]);

export const kleurenpaletExtra = array.catOptions([
  clr.toKleur("grijsblauw", "#455a64"),
  clr.toKleur("grasgroen", "#388e3c"),
  clr.toKleur("zalm", "#ff6e40"),
  clr.toKleur("bordeau", "#c2185b"),
  clr.toKleur("turquoise", "#0097a7"),
  clr.toKleur("taupe", "#8d6e63"),
  clr.toKleur("donkergroen", "#1b5e20"),
  clr.toKleur("donkergeel", "#ffd740"),
  clr.toKleur("donkerrood", "#d50000"),
  clr.toKleur("donkerblauw", "#1a237e"),
  clr.toKleur("zwart", "#212121"),
  clr.toKleur("zachtgroen", "#81c784"),
  clr.toKleur("zachtgeel", "#fff59d"),
  clr.toKleur("zachtrood", "#ef5350"),
  clr.toKleur("zachtblauw", "#7986cb"),
  clr.toKleur("zachtgrijs", "#cfd8dc")
]);

export const kleurenpaletGroot = concat(kleurenpaletKlein, kleurenpaletExtra);
