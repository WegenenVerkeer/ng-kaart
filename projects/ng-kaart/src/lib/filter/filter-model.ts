import { constant, Function1, Function2, Function3, identity, Lazy, not, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";

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

  export type Comparison = BinaryComparison;

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
  }

  export interface PropertyValueOperator {
    readonly property: Property;
    readonly value: Literal;
  }

  export function propertyAndValueCompatible<A extends BinaryComparison>(pvo: PropertyValueOperator): pvo is A {
    return pvo.property.type === pvo.value.type; // TODO double -> integer bijvoorbeeld is ook toegelaten
  }

  // TODO: laten we voorlopig overeen komen met alle veldtypes uit VeldInfo
  export type TypeType = "string" | "integer" | "double" | "geometry" | "date" | "datetime" | "boolean" | "json";

  export type ValueType = boolean | string | number;

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
  }

  export const BinaryComparison: Function3<BinaryComparisonOperator, Property, Literal, BinaryComparison> = (
    operator,
    property,
    value
  ) => ({ kind: "BinaryComparison", operator, property, value });

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
  }

  export const EmptyFilter: EmptyFilter = { kind: "EmptyFilter" };
  export const empty: Lazy<Filter> = constant(EmptyFilter);

  export const ExpressionFilter: Function2<Option<string>, Expression, ExpressionFilter> = (name, expression) => ({
    kind: "ExpressionFilter",
    name: name,
    expression: expression
  });

  export const Property: Function3<TypeType, string, string, Property> = (typetype, name, label) => ({
    kind: "Property",
    type: typetype,
    ref: name,
    label: label
  });

  export const Literal: Function2<TypeType, ValueType, Literal> = (typetype, value) => ({
    kind: "Literal",
    type: typetype,
    value: value
  });

  export interface FilterMatcher<A> {
    readonly EmptyFilter: Lazy<A>;
    readonly ExpressionFilter: Function1<ExpressionFilter, A>;
  }

  export const matchFilter: <A>(_: FilterMatcher<A>) => Function1<Filter, A> = matchers.matchKind;

  export interface ExpressionMatcher<A> {
    readonly And: Function1<Conjunction, A>;
    readonly Or: Function1<Disjunction, A>;
    readonly BinaryComparison: Function1<BinaryComparison, A>;
  }

  export const matchExpression: <A>(_: ExpressionMatcher<A>) => Function1<Expression, A> = matchers.matchKind;

  export const matchLiteral: <A>(_: matchers.FullMatcher<Literal, A, TypeType>) => Function1<Literal, A> = matcher =>
    matchers.match(matcher)(l => l.type);

  export const matchTypeTypeWithFallback: <A>(_: matchers.FallbackMatcher<TypeType, A, TypeType>) => (_: TypeType) => A = switcher =>
    matchers.matchWithFallback(switcher)(identity);

  export const matchBinaryComparisonOperatorWithFallback: <A>(
    _: matchers.FallbackMatcher<BinaryComparisonOperator, A, BinaryComparisonOperator>
  ) => Function1<BinaryComparisonOperator, A> = matcher => matchers.matchWithFallback(matcher)(identity);

  export const isEmpty: Predicate<Filter> = matchFilter({
    ExpressionFilter: constant(false),
    EmptyFilter: constant(true)
  });

  export const isDefined: Predicate<Filter> = not(isEmpty);
}
