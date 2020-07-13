import { option } from "fp-ts";
import { Curried2, Function1 } from "fp-ts/lib/function";
import { DateTime } from "luxon";

import { PartialFunction1 } from "./function";

export const defaultDateFormat = "dd/MM/yyyy";

export const formateerDate: Curried2<option.Option<string>, DateTime, string> = maybeFormat => date => {
  return date.setLocale("nl-BE").toFormat(maybeFormat.getOrElse(defaultDateFormat));
};

export const formateerDateAsDefaultDate: (date: DateTime) => string = formateerDate(option.some(defaultDateFormat));

export const formateerJsDate: Function1<Date, string> = date => {
  return DateTime.fromJSDate(date)
    .setLocale("nl-BE")
    .toFormat(defaultDateFormat);
};

export const formateerDateTime: Curried2<option.Option<string>, DateTime, string> = maybeFormat => dateTime => {
  return dateTime.setLocale("nl-BE").toFormat(maybeFormat.getOrElse("dd/MM/yyyy hh:mm:ss"));
};

export const parseDate: Curried2<option.Option<string>, string, option.Option<DateTime>> = maybeFormat => text =>
  maybeFormat.foldL(() => parseDateHeuristically, parseDateTimeWithFormat)(text);

const parseDateTimeHeuristically: PartialFunction1<string, DateTime> = text => {
  // We ondersteunen enkel het ISO-formaat. Dat is in de praktijk ook de enige DateTime die we hebben (gegenereerd in
  // Scala).
  return option.fromPredicate((d: DateTime) => d.isValid)(DateTime.fromISO(text));
};

// We ondersteunen enkel de formaten die luxon (https://moment.github.io/luxon/docs/manual/parsing.html) ondersteunt.
const parseDateTimeWithFormat: Function1<string, PartialFunction1<string, DateTime>> = format => text => {
  return option.fromPredicate((d: DateTime) => d.isValid)(DateTime.fromFormat(text, format));
};

export const parseDefaultDate: PartialFunction1<string, DateTime> = parseDateTimeWithFormat(defaultDateFormat);

const parseDateHeuristically: PartialFunction1<string, DateTime> = text => {
  // Er zijn veel manieren hoe een datum geformatteerd kan zijn. Het vervelende is dat JSON geen datum formaat heeft en
  // dat datums dus als string doorkomen. Dat zou allemaal nog geen probleem zijn mocht er een std formaat (epoch
  // timestamps of ISO 6801 strings) voor alle feature sources gedefinieerd zou zijn. Helaas is dat niet zo. We moeten
  // dus heuristieken gebruiken. De browser doet dat ook, maar niet toegespitst op onze, Vlaamse, situatie.
  return parseDateTimeWithFormat("dd/LL/yyyy")(text)
    .orElse(() => parseDateTimeWithFormat("dd-LL-yyyy")(text))
    .orElse(() => parseDateTimeWithFormat("yyyy/LL/dd")(text))
    .orElse(() => parseDateTimeWithFormat("yyyy-LL-dd")(text));
};

export const parseDateTime: Curried2<option.Option<string>, string, option.Option<DateTime>> = maybeFormat => text =>
  maybeFormat.foldL(() => parseDateTimeHeuristically, parseDateTimeWithFormat)(text);

export const fromTimestamp = (ts: number): option.Option<DateTime> => option.tryCatch(() => DateTime.fromMillis(ts));
