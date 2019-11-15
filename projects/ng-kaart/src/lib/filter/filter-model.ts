import { constant, Function1, Function2, Function3, Function4, identity, Lazy, not, Predicate } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { contramap, Setoid, setoidString } from "fp-ts/lib/Setoid";
import { DateTime } from "luxon";

import { PartialFunction1 } from "../util/function";
import * as matchers from "../util/matchers";

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
    readonly name: Option<string>;
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

  export const Conjunction: Function2<ConjunctionExpression, Comparison, Conjunction> = (left, right) => ({ kind: "And", left, right });

  export const Disjunction: Function2<Expression, Expression, Disjunction> = (left, right) => ({ kind: "Or", left, right });

  export type LogicalConnective = Conjunction | Disjunction;

  export type Comparison = BinaryComparison | UnaryComparison;

  export type ComparisonOperator = BinaryComparisonOperator | UnaryComparisonOperator;

  export type BinaryComparisonOperator =
    | "equality"
    | "inequality"
    | "contains"
    | "starts"
    | "ends"
    | "smaller"
    | "smallerOrEqual"
    | "larger"
    | "largerOrEqual";

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

  export function propertyAndValueCompatible<A extends BinaryComparison>(pvo: PropertyValueOperator): pvo is A {
    return pvo.property.type === pvo.value.type; // TODO double -> integer bijvoorbeeld is ook toegelaten
  }

  // TODO: laten we voorlopig overeen komen met alle veldtypes uit VeldInfo
  export type TypeType = "string" | "integer" | "double" | "geometry" | "date" | "datetime" | "boolean" | "json" | "url";

  // Dit zijn alle types die we ondersteunen in het geheugen, maar denk eraan dat alles als string of number
  // geserialiseerd moet worden.
  export type ValueType = boolean | string | number | DateTime;

  export interface Literal {
    readonly kind: "Literal";
    readonly type: TypeType;
    readonly value: ValueType;
  }

  export interface Property {
    readonly kind: "Property";
    readonly type: TypeType;
    readonly ref: string;
    readonly label: string;
    readonly sqlFormat: Option<string>;
  }

  export const BinaryComparison: Function4<BinaryComparisonOperator, Property, Literal, boolean, BinaryComparison> = (
    operator,
    property,
    value,
    caseSensitive
  ) => ({ kind: "BinaryComparison", operator, property, value, caseSensitive });

  export const UnaryComparison: Function2<UnaryComparisonOperator, Property, UnaryComparison> = (operator, property) => ({
    kind: "UnaryComparison",
    operator,
    property
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

  export const ExpressionFilter: Function2<Option<string>, Expression, ExpressionFilter> = (name, expression) => ({
    kind: "ExpressionFilter",
    name: name,
    expression: expression
  });

  export const Property: Function4<TypeType, string, string, string, Property> = (typetype, name, label, sqlFormat) => ({
    kind: "Property",
    type: typetype,
    ref: name,
    sqlFormat: fromNullable(sqlFormat),
    label
  });

  export const Literal: Function2<TypeType, ValueType, Literal> = (typetype, value) => ({
    kind: "Literal",
    type: typetype,
    value
  });

  export const stringValue: PartialFunction1<ValueType, string> = value => (typeof value === "string" ? some(value) : none);
  export const boolValue: PartialFunction1<ValueType, boolean> = value => (typeof value === "boolean" ? some(value) : none);
  export const numberValue: PartialFunction1<ValueType, number> = value => (typeof value === "number" ? some(value) : none);
  export const dateValue: PartialFunction1<ValueType, DateTime> = value => (value instanceof DateTime ? some(value) : none);
  export interface FilterMatcher<A> {
    readonly EmptyFilter: Lazy<A>;
    readonly ExpressionFilter: Function1<ExpressionFilter, A>;
  }

  export const matchFilter: <A>(_: FilterMatcher<A>) => Function1<Filter, A> = matchers.matchKind;

  export const asExpressionFilter: Function1<Filter, Option<ExpressionFilter>> = matchFilter({
    EmptyFilter: constant(none),
    ExpressionFilter: some
  });

  export interface ExpressionMatcher<A> {
    readonly And: Function1<Conjunction, A>;
    readonly Or: Function1<Disjunction, A>;
    readonly BinaryComparison: Function1<BinaryComparison, A>;
    readonly UnaryComparison: Function1<UnaryComparison, A>;
  }

  export const matchExpression: <A>(_: ExpressionMatcher<A>) => Function1<Expression, A> = matchers.matchKind;

  export const matchLiteral: <A>(_: matchers.FullMatcher<Literal, A, TypeType>) => Function1<Literal, A> = matcher =>
    matchers.match(matcher)(l => l.type);

  export const matchTypeTypeWithFallback: <A>(_: matchers.FallbackMatcher<TypeType, A, TypeType>) => (_: TypeType) => A = switcher =>
    matchers.matchWithFallback(switcher)(identity);

  export interface ComparisonMatcher<A> {
    readonly BinaryComparison: Function1<BinaryComparison, A>;
    readonly UnaryComparison: Function1<UnaryComparison, A>;
  }

  export const matchComparison: <A>(_: ComparisonMatcher<A>) => Function1<Comparison, A> = matchers.matchKind;

  export const matchBinaryComparisonOperatorWithFallback: <A>(
    _: matchers.FallbackMatcher<BinaryComparisonOperator, A, BinaryComparisonOperator>
  ) => Function1<BinaryComparisonOperator, A> = matcher => matchers.matchWithFallback(matcher)(identity);

  export const matchUnaryComparisonOperator: <A>(
    _: matchers.FullMatcher<UnaryComparisonOperator, A, UnaryComparisonOperator>
  ) => Function1<UnaryComparisonOperator, A> = matcher => matchers.match(matcher)(identity);

  export const matchConjunctionExpression: <A>(
    _: matchers.FullKindMatcher<ConjunctionExpression, A>
  ) => Function1<ConjunctionExpression, A> = matcher => matchers.matchKind(matcher);

  export const isEmpty: Predicate<Filter> = matchFilter({
    ExpressionFilter: constant(false),
    EmptyFilter: constant(true)
  });

  export const isDefined: Predicate<Filter> = not(isEmpty);

  export const setoidPropertyByRef: Setoid<Property> = contramap(p => p.ref, setoidString);
  export const setoidBinaryComparisonOperator: Setoid<BinaryComparisonOperator> = setoidString;
  export const setoidUnaryComparisonOperator: Setoid<UnaryComparisonOperator> = setoidString;
}
