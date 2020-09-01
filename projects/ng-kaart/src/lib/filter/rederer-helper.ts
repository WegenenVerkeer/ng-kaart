import { DateTime } from "luxon";

import { formateerDateAsDefaultDate } from "../util/date-time";

import { formatRelativeDateRange } from "./date-range-helper";
import { FilterEditor as fed } from "./filter-builder";
import { Filter as fltr } from "./filter-model";

export const literalValueStringRenderer = (
  literalValue: fed.LiteralValue
): string =>
  fltr.matchTypeTypeWithFallback({
    date: () => formateerDateAsDefaultDate(literalValue.value as DateTime),
    range: () =>
      formatRelativeDateRange(literalValue.value as fltr.RelativeDateRange),
    fallback: () => literalValue.value.toString(),
  })(literalValue.valueType);
