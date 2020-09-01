import * as matchers from "../util/matchers";

import * as fltr from "./filter-model";

const singularDateRange: (
  range: fltr.Filter.RelativeDateRange
) => string = matchers.match<fltr.Filter.RelativeDateRange, string>({
  day: () => "dag",
  month: () => "maand",
  year: () => "jaar",
})((range) => range.unit);

const pluralDateRange: (
  range: fltr.Filter.RelativeDateRange
) => string = matchers.match<fltr.Filter.RelativeDateRange, string>({
  day: () => "dagen",
  month: () => "maanden",
  year: () => "jaar",
})((range) => range.unit);

export const formatRelativeDateRange = (
  range: fltr.Filter.RelativeDateRange
): string =>
  range.magnitude === 1
    ? singularDateRange(range)
    : `${range.magnitude} ${pluralDateRange(range)}`;
