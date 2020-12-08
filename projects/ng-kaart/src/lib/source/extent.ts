import { array, option } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";

import { PartialFunction1 } from "../util/function";
import * as ol from "../util/openlayers-compat";

// We veronderstellen dat de extents altijd het linksbovenpunt eerst hebben gevolgd door het rechtsonderpunt. In
// schermcoördinaten, maw _[0] <= _[2] && _[1] <= _[3].
export type Extent = ol.Extent;

export namespace Extent {
  /**
   * Snijdt `extent1` met `extent2` zodat een array van 0 tot 4 kleinere rechthoeken bekomen wordt.
   *
   * @param extent1 De rechthoek die afgesneden wordt.
   * @param extent2 De rechthoek waarmee gesneden wordt.
   */
  export const difference: (extent1: Extent, extent2: Extent) => Extent[] = (
    extent1,
    extent2
  ) => {
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
    const [lft1, top1, rght1, btm1] = extent1;
    const [lft2, top2, rght2, btm2] = extent2;

    if (lft2 >= rght1 || rght2 <= lft1 || top2 >= btm1 || btm2 <= top1) {
      return [extent1]; // Geen overlap: er wordt niks afgesneden
    } else {
      // We kijken of [lft1, lft2, rght2, rght1] mooi oplopen. Enkel wanneer een paar punten mooi oploopt mogen ze
      // weerhouden worden.
      const [h1, h2] =
        lft1 <= lft2 ? [lft1, lft2] : [Number.POSITIVE_INFINITY, lft1];
      const [h3, h4] =
        rght2 <= rght1 ? [rght2, rght1] : [rght1, Number.NEGATIVE_INFINITY];

      const isValidLeftRight: PartialFunction1<
        Extent,
        Extent
      > = option.fromPredicate(([l, _, r, __]) => l < r);
      const isValidTopBottom: PartialFunction1<
        Extent,
        Extent
      > = option.fromPredicate(([_, t, __, b]) => t < b);

      // Als er overlap is, dan kijken we of de drie mogelijke rechthoeken begrensd door [lft1, lft2, rght2, lft2] geldig zijn.
      const [left, middle, right] = [
        isValidLeftRight([h1, top1, h2, btm1]),
        isValidLeftRight([h2, top1, h3, btm1]),
        isValidLeftRight([h3, top1, h4, btm1]),
      ];
      const [middleTop, middleBottom] = pipe(
        middle,
        option.map(([lftm, topm, rghtm, botmm]) => {
          return top2 >= botmm || btm2 <= topm // Is er enige verticale overlap? We zijn al zeker van horizontale.
            ? [option.none, option.none]
            : [
                isValidTopBottom([lftm, topm, rghtm, top2]),
                isValidTopBottom([lftm, btm2, rghtm, botmm]),
              ];
        }),
        option.getOrElse(() => [option.none, option.none])
      );
      return array.compact([left, right, middleTop, middleBottom]);
    }
  };

  export const toQueryValue: (arg: Extent) => string = (extent) =>
    extent.join(",");
}
