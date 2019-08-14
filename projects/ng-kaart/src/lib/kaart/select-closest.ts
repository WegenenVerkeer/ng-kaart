import { ord } from "fp-ts";
import { Function1 } from "fp-ts/lib/function";
import { Ord } from "fp-ts/lib/Ord";
import * as ol from "openlayers";

import * as arrays from "../util/arrays";
import { PartialFunction2 } from "../util/function";
import { distance } from "../util/geometries";

//////////////////////////////////////////////////////////////////////////////////
// Functies om bij een select ta maken die de dichtstbijzijnde feature selecteert.
//
// Dit is op basis van een OL multi select waarvan we alle behalve 1 feature (de dichtste) weerhouden. Het probleem met
// de de native select van OL is dat die de eerste feature (volgens een of andere arbitraire volgorde) selecteert.

const distanceFromPointOrd: Function1<ol.Coordinate, Ord<ol.Feature>> = coord =>
  ord.contramap(feature => distance(coord, feature.getGeometry().getClosestPoint(coord)), ord.ordNumber);

export const findClosest: PartialFunction2<ol.Feature[], ol.Coordinate, ol.Feature> = (features, clickLoc) =>
  arrays.findFirstBy(distanceFromPointOrd(clickLoc))(features);
