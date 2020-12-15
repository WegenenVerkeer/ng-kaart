import { eq, option } from "fp-ts";
import {
  constant,
  identity,
  Lazy,
  not,
  Predicate,
  Refinement,
} from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import { DateTime, Duration } from "luxon";
import { Getter, Lens } from "monocle-ts";

import * as arrays from "../util/arrays";
import { isBoolean } from "../util/boolean";
import { PartialFunction1 } from "../util/function";
import * as matchers from "../util/matchers";
import { isNumber } from "../util/number";
import { isObject } from "../util/object";
import { isString } from "../util/string";

// Een namespace is nodig omdat verschillende types dezelfde naam hebben als die voor stijlen en er kan maar 1 naam
// geëxporteerd worden buiten de module.
export namespace Filter {
  export type Filter = EmptyFilter | ExpressionFilter; // Later ook | RawCQLFilter

  // TODO hernoemen naar Empty
  export interface EmptyFilter {
    readonly kind: "EmptyFilter";
  }

  export interface ExpressionFilter {
    readonly kind: "ExpressionFilter";
    readonly name: option.Option<string>;
    readonly expression: Expression;
  }

  export type Expression = ConjunctionExpression | Disjunction;

  // Dit zou niet nodig zijn mochten we arbitraire combinaties van "And" en "Or" toelaten, maar dat mag niet in de UI.
  // Het is dan best dit hier ook niet toe te laten, want anders kan de UI niet met alle geldige filters overweg en
  // moeten we weer veronderstellingen maken of extra tests invoeren.
  export type ConjunctionExpression = Conjunction | Comparison;

  export interface Conjunction {
    readonly kind: "And";
    readonly left: ConjunctionExpression;
    readonly right: ConjunctionExpression;
  }

  export interface Disjunction {
    readonly kind: "Or";
    readonly left: Expression;
    readonly right: Expression;
  }

  export const Conjunction: (
    arg1: ConjunctionExpression,
    arg2: Comparison
  ) => Conjunction = (left, right) => ({ kind: "And", left, right });

  export const Disjunction: (
    arg1: Expression,
    arg2: Expression
  ) => Disjunction = (left, right) => ({ kind: "Or", left, right });

  export type LogicalConnective = Conjunction | Disjunction;

  export type Comparison = BinaryComparison | UnaryComparison;

  export type ComparisonOperator =
    | BinaryComparisonOperator
    | UnaryComparisonOperator;

  export type BinaryComparisonOperator =
    | "equality"
    | "inequality"
    | "contains"
    | "starts"
    | "ends"
    | "smaller"
    | "smallerOrEqual"
    | "larger"
    | "largerOrEqual"
    | "within";

  export interface BinaryComparison {
    readonly kind: "BinaryComparison";
    readonly operator: BinaryComparisonOperator;
    readonly property: Property;
    readonly value: Literal;
    readonly caseSensitive: boolean;
  }

  export type UnaryComparisonOperator = "isEmpty" | "isNotEmpty";

  export interface UnaryComparison {
    readonly kind: "UnaryComparison";
    readonly operator: UnaryComparisonOperator;
    readonly property: Property;
  }

  export interface PropertyValueOperator {
    readonly property: Property;
    readonly value: Literal;
  }

  // De ondersteunde propertytypes. Dit is niet helemaal gelijk aan de types in VeldInfo (+ range, - json, etc.)
  export type TypeType =
    | "string"
    | "integer"
    | "double"
    | "date"
    | "boolean"
    | "range";

  const propertyAndValueTypeEqual: Predicate<PropertyValueOperator> = (pvo) =>
    pvo.property.type === pvo.value.type;
  const propertyAndValueNumericCompatible: Predicate<PropertyValueOperator> = (
    pvo
  ) => pvo.property.type === "double" && pvo.value.type === "integer"; // wel gevaarlijk wegens afrondingsfouten
  const propertyAndValueDateCompatible: Predicate<PropertyValueOperator> = (
    pvo
  ) => pvo.property.type === "date" && pvo.value.type === "range"; // test komt na equal, dus niet nodig te herhalen

  export function propertyAndValueCompatible<A extends BinaryComparison>(
    pvo: PropertyValueOperator
  ): pvo is A {
    return (
      propertyAndValueTypeEqual(pvo) ||
      propertyAndValueNumericCompatible(pvo) ||
      propertyAndValueDateCompatible(pvo)
    );
  }

  export const operatorPropertyAndValueCompatible = <
    A extends BinaryComparison
  >(
    binop: BinaryComparison
  ): binop is A =>
    binop.operator !== "within" ||
    (binop.property.type === "date" && // within is enkel ondersteund voor date
      binop.value.type === "range" && // within vereist een range type
      Range.isRelativeDateRange(binop.value.value)); // RelativeDateRange is het enige wat we toelaten voor within

  export interface Range {
    readonly unit: string; // ondersteunde waarden volgen uit type van Property + Operator
    readonly magnitude: number;
  }

  export interface RelativeDateRange extends Range {
    readonly unit: "year" | "month" | "day";
  }

  export namespace Range {
    export const create = (unit: string, magnitude: number): Range => ({
      unit,
      magnitude,
    });

    export const isRange: Refinement<ValueType, Range> = (
      range
    ): range is Range =>
      isObject(range) &&
      typeof range["magnitude"] === "number" &&
      typeof range["unit"] === "string";

    export const isRelativeDateRange: Refinement<ValueType, Range> = (
      range
    ): range is Range =>
      isRange(range) &&
      arrays.isOneOf("year", "month", "day")(range.unit) &&
      range.magnitude > 0;

    const durationFallBackMatcher = matchers.matchWithFallback<
      RelativeDateRange,
      option.Option<DateTime>
    >({
      day: (q: RelativeDateRange) =>
        option.some(
          DateTime.local().minus(Duration.fromObject({ days: q.magnitude }))
        ),
      month: (q: RelativeDateRange) =>
        option.some(
          DateTime.local().minus(Duration.fromObject({ months: q.magnitude }))
        ),
      year: (q: RelativeDateRange) =>
        option.some(
          DateTime.local().minus(Duration.fromObject({ years: q.magnitude }))
        ),
      fallback: () => option.none,
    });

    export const withinValueToDuration: (
      arg: RelativeDateRange
    ) => option.Option<DateTime> = durationFallBackMatcher(
      (q: Range) => q.unit
    );
  }

  // Dit zijn alle types die we ondersteunen in het geheugen, maar denk eraan dat alles als string of number
  // geserialiseerd moet worden.
  export type ValueType = boolean | string | number | DateTime | Range;

  export interface Literal {
    readonly kind: "Literal";
    readonly type: TypeType;
    readonly value: ValueType;
  }

  export const literalValueGetter: Getter<Literal, ValueType> = Lens.fromProp<
    Literal
  >()("value").asGetter();

  export interface Property {
    readonly kind: "Property";
    readonly type: TypeType;
    readonly ref: string;
    readonly label: string;
    readonly sqlFormat: option.Option<string>;
  }

  export const BinaryComparison: (
    operator: BinaryComparisonOperator,
    property: Property,
    value: Literal,
    caseSensitive: boolean
  ) => BinaryComparison = (operator, property, value, caseSensitive) => ({
    kind: "BinaryComparison",
    operator,
    property,
    value,
    caseSensitive,
  });

  export const UnaryComparison: (
    arg1: UnaryComparisonOperator,
    arg2: Property
  ) => UnaryComparison = (operator, property) => ({
    kind: "UnaryComparison",
    operator,
    property,
  });

  export interface Conjunction {
    readonly kind: "And";
    readonly left: ConjunctionExpression;
    readonly right: ConjunctionExpression;
  }

  export interface Disjunction {
    readonly kind: "Or";
    readonly left: Expression;
    readonly right: Expression;
  }

  export interface PropertyValueOperator {
    readonly property: Property;
    readonly value: Literal;
  }

  export interface Equality extends PropertyValueOperator {
    readonly kind: "Equality";
  }

  export interface Inequality extends PropertyValueOperator {
    readonly kind: "Inequality";
  }

  export interface Incomplete extends PropertyValueOperator {
    readonly kind: "Incomplete";
  }

  export const EmptyFilter: EmptyFilter = { kind: "EmptyFilter" };
  export const empty: Lazy<Filter> = constant(EmptyFilter);

  export const ExpressionFilter: (
    arg1: option.Option<string>,
    arg2: Expression
  ) => ExpressionFilter = (name, expression) => ({
    kind: "ExpressionFilter",
    name: name,
    expression: expression,
  });

  export const Property: (
    typetype: TypeType,
    name: string,
    label: string,
    sqlFormat: string
  ) => Property = (typetype, name, label, sqlFormat) => ({
    kind: "Property",
    type: typetype,
    ref: name,
    sqlFormat: option.fromNullable(sqlFormat),
    label,
  });

  export const Literal: (arg1: TypeType, arg2: ValueType) => Literal = (
    typetype,
    value
  ) => ({
    kind: "Literal",
    type: typetype,
    value,
  });

  export const stringValue: PartialFunction1<
    ValueType,
    string
  > = option.fromPredicate(isString);
  export const boolValue: PartialFunction1<
    ValueType,
    boolean
  > = option.fromPredicate(isBoolean);
  export const numberValue: PartialFunction1<
    ValueType,
    number
  > = option.fromPredicate(isNumber);
  export const dateValue: PartialFunction1<
    ValueType,
    DateTime
  > = option.fromPredicate(DateTime.isDateTime);
  export interface FilterMatcher<A> {
    readonly EmptyFilter: Lazy<A>;
    readonly ExpressionFilter: (arg: ExpressionFilter) => A;
  }

  export const matchFilter: <A>(fm: FilterMatcher<A>) => (f: Filter) => A =
    matchers.matchKind;

  export const asExpressionFilter: (
    arg: Filter
  ) => option.Option<ExpressionFilter> = matchFilter({
    EmptyFilter: constant(option.none),
    ExpressionFilter: option.some,
  });

  export interface ExpressionMatcher<A> {
    readonly And: (arg: Conjunction) => A;
    readonly Or: (arg: Disjunction) => A;
    readonly BinaryComparison: (arg: BinaryComparison) => A;
    readonly UnaryComparison: (arg: UnaryComparison) => A;
  }

  export const matchExpression: <A>(
    _: ExpressionMatcher<A>
  ) => (arg: Expression) => A = matchers.matchKind;

  export const matchLiteral: <A>(
    _: matchers.FullMatcher<Literal, A, TypeType>
  ) => (arg: Literal) => A = (matcher) =>
    matchers.match(matcher)((l) => l.type);

  export const matchTypeTypeWithFallback: <A>(
    _: matchers.FallbackMatcher<TypeType, A, TypeType>
  ) => (_: TypeType) => A = (switcher) =>
    matchers.matchWithFallback(switcher)(identity);

  export interface ComparisonMatcher<A> {
    readonly BinaryComparison: (arg: BinaryComparison) => A;
    readonly UnaryComparison: (arg: UnaryComparison) => A;
  }

  export const matchComparison: <A>(
    _: ComparisonMatcher<A>
  ) => (arg: Comparison) => A = matchers.matchKind;

  export const matchBinaryComparisonOperatorWithFallback: <A>(
    _: matchers.FallbackMatcher<
      BinaryComparisonOperator,
      A,
      BinaryComparisonOperator
    >
  ) => (arg: BinaryComparisonOperator) => A = (matcher) =>
    matchers.matchWithFallback(matcher)(identity);

  export const matchUnaryComparisonOperator: <A>(
    _: matchers.FullMatcher<UnaryComparisonOperator, A, UnaryComparisonOperator>
  ) => (arg: UnaryComparisonOperator) => A = (matcher) =>
    matchers.match(matcher)(identity);

  export const matchConjunctionExpression: <A>(
    _: matchers.FullKindMatcher<ConjunctionExpression, A>
  ) => (arg: ConjunctionExpression) => A = (matcher) =>
    matchers.matchKind(matcher);

  export const isEmpty: Predicate<Filter> = matchFilter({
    ExpressionFilter: constant(false),
    EmptyFilter: constant(true),
  });

  export const isDefined: Predicate<Filter> = not(isEmpty);

  export const setoidPropertyByRef: eq.Eq<Property> = pipe(
    eq.eqString,
    eq.contramap((p) => p.ref)
  );
  export const setoidBinaryComparisonOperator: eq.Eq<BinaryComparisonOperator> =
    eq.eqString;
  export const setoidUnaryComparisonOperator: eq.Eq<UnaryComparisonOperator> =
    eq.eqString;
}
