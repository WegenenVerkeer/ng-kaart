import { array } from "fp-ts";
import { BinaryOperation } from "fp-ts/lib/function";
import { fromPredicate, none } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import { PartialFunction1 } from "../util/function";

// We veronderstellen dat de bounding boxes altijd het linksbovenpunt eerst hebben gevolgd door het rechtsonderpunt. In
// schermcoördinaten, maw _[0] <= _[2] && _[1] <= _[3].
export type BBox = ol.Extent;

export namespace BBox {
  /**
   * Snijdt `bbox1` met `bbox2` zodat een array van 0 tot 4 kleinere rechthoeken bekomen wordt.
   *
   * @param bbox1 De rechthoek die afgesneden wordt.
   * @param bbox2 De rechthoek waarmee gesneden wordt.
   */
  export const difference: BinaryOperation<BBox, BBox[]> = (bbox1, bbox2) => {
    // Het idee is dat eerst gesneden wordt met 2 rechten die overlappen met de linker- en rechterzijden van de
    // snijdende rechthoek. Dat levert 4 zijden op (volgorde hangt af van soort overlapping):
    // 1. de linkerkant van de gesneden rechthoek
    // 2. de linkerkant van de snijdende rechthoek
    // 3. de rechterkant van de snijdende rechthoek
    // 4. de rechterkant van de gesneden rechthoek
    //
    // Hiermee kunnen (maximaal) 3 rechthoeken gemaakt worden. De eerste en de derde mogen we behouden zoals die zijn
    // (voor zover ze geldig zijn. Geldig betekent van links naar rechts: eerste zijde voor tweede, tweede voor derde,
    // derde voor vierde), de tweede moet nog eens doorsneden worden met de rechten die samenvallen met de boven- en
    // onderzijden van de snijdende rechthoek.
    const [lft1, top1, rght1, btm1] = bbox1;
    const [lft2, top2, rght2, btm2] = bbox2;

    if (lft2 >= rght1 || rght2 <= lft1 || top2 >= btm1 || btm2 <= top1) {
      return [bbox1]; // Geen overlap: er wordt niks afgesneden
    } else {
      // We kijken of [lft1, lft2, rght2, rght1] mooi oplopen. Enkel wanneer een paar punten mooi oploopt mogen ze
      // weerhouden worden.
      const [h1, h2] = lft1 <= lft2 ? [lft1, lft2] : [Number.POSITIVE_INFINITY, lft1];
      const [h3, h4] = rght2 <= rght1 ? [rght2, rght1] : [rght1, Number.NEGATIVE_INFINITY];

      const isValidLeftRight: PartialFunction1<BBox, BBox> = fromPredicate(([l, _, r, __]) => l < r);
      const isValidTopBottom: PartialFunction1<BBox, BBox> = fromPredicate(([_, t, __, b]) => t < b);

      // Als er overlap is, dan kijken we of de drie mogelijke rechthoeken begrensd door [lft1, lft2, rght2, lft2] geldig zijn.
      const [left, middle, right] = [
        isValidLeftRight([h1, top1, h2, btm1]),
        isValidLeftRight([h2, top1, h3, btm1]),
        isValidLeftRight([h3, top1, h4, btm1])
      ];
      const [middleTop, middleBottom] = middle
        .map(([lftm, topm, rghtm, botmm]) => {
          return top2 >= botmm || btm2 <= topm // Is er enige verticale overlap? We zijn al zeker van horizontale.
            ? [none, none]
            : [isValidTopBottom([lftm, topm, rghtm, top2]), isValidTopBottom([lftm, btm2, rghtm, botmm])];
        })
        .getOrElse([none, none]);
      return array.catOptions([left, right, middleTop, middleBottom]);
    }
  };
}
