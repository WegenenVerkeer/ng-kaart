import { array } from "fp-ts";

import * as clr from "../../stijl/colour";

// De kleuren voor onze 2 paletten
export const kleurenpaletKlein = array.takeLeft(19)(clr.standaardKleuren);
export const kleurenpaletGroot = array.takeLeft(35)(clr.standaardKleuren);
