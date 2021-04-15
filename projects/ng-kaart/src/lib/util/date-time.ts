import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { DateTime } from "luxon";

import { PartialFunction1 } from "./function";

export const defaultDateFormat = "dd/MM/yyyy";

export const formateerDate: (
  maybeFormat: option.Option<string>
) => (date: DateTime) => string = (maybeFormat) => (date) => {
  return date
    .setLocale("nl-BE")
    .toFormat(option.getOrElse(() => defaultDateFormat)(maybeFormat));
};

export const formateerDateAsDefaultDate: (
  date: DateTime
) => string = formateerDate(option.some(defaultDateFormat));

export const formateerJsDate: (date: Date) => string = (date) => {
  return DateTime.fromJSDate(date)
    .setLocale("nl-BE")
    .toFormat(defaultDateFormat);
};

export const formateerDateTime: (
  maybeFormat: option.Option<string>
) => (dateTime: DateTime) => string = (maybeFormat) => (dateTime) => {
  return dateTime
    .setLocale("nl-BE")
    .toFormat(option.getOrElse(() => "dd/MM/yyyy hh:mm:ss")(maybeFormat));
};

export const parseDate: (
  maybeFormat: option.Option<string>
) => (text: string) => option.Option<DateTime> = (maybeFormat) => (text) =>
  option.fold(
    () => parseDateHeuristically,
    parseDateTimeWithFormat
  )(maybeFormat)(text);

const parseDateTimeHeuristically: PartialFunction1<string, DateTime> = (
  text
) => {
  // We ondersteunen enkel het ISO-formaat. Dat is in de praktijk ook de enige DateTime die we hebben (gegenereerd in
  // Scala).
  return option.fromPredicate((d: DateTime) => d.isValid)(
    DateTime.fromISO(text)
  );
};

// We ondersteunen enkel de formaten die luxon (https://moment.github.io/luxon/docs/manual/parsing.html) ondersteunt.
const parseDateTimeWithFormat: (
  format: string
) => PartialFunction1<string, DateTime> = (format) => (text) => {
  return option.fromPredicate((d: DateTime) => d.isValid)(
    DateTime.fromFormat(text, format)
  );
};

export const parseDefaultDate: PartialFunction1<
  string,
  DateTime
> = parseDateTimeWithFormat(defaultDateFormat);

const parseDateHeuristically: PartialFunction1<string, DateTime> = (text) => {
  // Er zijn veel manieren hoe een datum geformatteerd kan zijn. Het vervelende is dat JSON geen datum formaat heeft en
  // dat datums dus als string doorkomen. Dat zou allemaal nog geen probleem zijn mocht er een std formaat (epoch
  // timestamps of ISO 6801 strings) voor alle feature sources gedefinieerd zou zijn. Helaas is dat niet zo. We moeten
  // dus heuristieken gebruiken. De browser doet dat ook, maar niet toegespitst op onze, Vlaamse, situatie.
  return pipe(
    parseDateTimeWithFormat("dd/LL/yyyy")(text),
    option.alt(() => parseDateTimeWithFormat("dd-LL-yyyy")(text)),
    option.alt(() => parseDateTimeWithFormat("yyyy/LL/dd")(text)),
    option.alt(() => parseDateTimeWithFormat("yyyy-LL-dd")(text))
  );
};

export const parseDateTime: (
  maybeFormat: option.Option<string>
) => (text: string) => option.Option<DateTime> = (maybeFormat) => (text) =>
  option.fold(
    () => parseDateTimeHeuristically,
    parseDateTimeWithFormat
  )(maybeFormat)(text);

export const fromTimestamp = (ts: number): option.Option<DateTime> =>
  option.tryCatch(() => DateTime.fromMillis(ts));
