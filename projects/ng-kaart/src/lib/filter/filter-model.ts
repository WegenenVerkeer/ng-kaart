import { constant, Function1, Function2, Function3, identity, Lazy, not, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";

import * as matchers from "../util/matchers";

// Een namespace is nodig omdat verschillende types dezelfde naam hebben als die voor stijlen en er kan maar 1 naam
// geëxporteerd worden buiten de module.
export namespace Filter {
  export type Filter = PureFilter | ExpressionFilter; // Later ook | RawCQLFilter

  export interface PureFilter {
    readonly kind: "PureFilter";
  }

  export interface ExpressionFilter {
    readonly kind: "ExpressionFilter";
    readonly name: Option<string>;
    readonly expression: Expression;
  }

  export type Expression = Conjunction | Disjunction | Comparison | Incomplete;

  // Dit zou niet nodig zijn mochten we arbitraire combinaties van "And" en "Or" toelaten, maar dat mag niet in de UI.
  // Het is dan best dit hier ook niet toe te laten, want anders kan de UI niet met alle geldige filters overweg en moeten
  // we weer veronderstellingen maken of extra tests invoeren.
  export type BaseExpression = Conjunction | Comparison;

  export interface Conjunction {
    readonly kind: "And";
    readonly left: BaseExpression;
    readonly right: Comparison;
  }

  export interface Disjunction {
    readonly kind: "Or";
    readonly left: Expression;
    readonly right: Expression;
  }

  export const Conjunction: Function2<BaseExpression, Comparison, Conjunction> = (left, right) => ({
    kind: "And",
    left: left,
    right: right
  });

  export const Disjunction: Function2<Expression, Expression, Disjunction> = (left, right) => ({
    kind: "Or",
    left: left,
    right: right
  });

  export type LogicalConnective = Conjunction | Disjunction;

  export type Comparison = Equality | Inequality | Incomplete; // Legacy

  // We kiezen er (voorlopig) voor om de types van operatoren niet te encoderen mbv generic type parameters. De
  // geserialiseerde JSON heeft daar geen benul van en dus moeten we toch at-runtime checken of de types wel
  // overeenkomen. Het zou de code er ook niet eenvoudiger op maken.
  export interface PropertyValueOperator {
    readonly property: Property;
    readonly value: Literal;
  }

  export function propertyAndValueCompatible<A extends PropertyValueOperator>(pvo: PropertyValueOperator): pvo is A {
    return pvo.property.type === pvo.value.type; // TODO double -> integer bijvoorbeeld is ook toegelaten
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

  export interface Larger extends PropertyValueOperator {
    readonly kind: "Larger";
  }

  export interface LargerOrEqual extends PropertyValueOperator {
    readonly kind: "LargerOrEqual";
  }

  export interface Smaller extends PropertyValueOperator {
    readonly kind: "Smaller";
  }

  export interface SmallerOrEqual extends PropertyValueOperator {
    readonly kind: "SmallerOrEqual";
  }

  export interface StartsWith extends PropertyValueOperator {
    readonly kind: "StartsWith";
  }

  export interface Contains extends PropertyValueOperator {
    readonly kind: "Contains";
  }

  export interface EndsWith extends PropertyValueOperator {
    readonly kind: "EndsWith";
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

  export function Comparison<C extends Comparison, K extends C["kind"]>(kind: K): Function2<Property, Literal, C> {
    return (property, value) =>
      (({
        kind: kind,
        property: property,
        value: value
      } as unknown) as C);
  }

  export interface Conjunction {
    readonly kind: "And";
    readonly left: BaseExpression;
    readonly right: Comparison;
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

  export const PureFilter: PureFilter = { kind: "PureFilter" };
  export const pure: Lazy<Filter> = constant(PureFilter);

  export const ExpressionFilter: Function2<Option<string>, Expression, ExpressionFilter> = (name, expression) => ({
    kind: "ExpressionFilter",
    name: name,
    expression: expression
  });

  export const Equality: Function2<Property, Literal, Equality> = Comparison("Equality");

  export const Inequality: Function2<Property, Literal, Inequality> = Comparison("Inequality");

  export const Incomplete: Function2<Property, Literal, Incomplete> = Comparison("Incomplete");

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

  export const matchFilter: <A>(
    _: {
      pure: Lazy<A>;
      expression: Function1<ExpressionFilter, A>;
    }
  ) => (_: Filter) => A = switcher => filter => {
    switch (filter.kind) {
      case "PureFilter":
        return switcher.pure();
      case "ExpressionFilter":
        return switcher.expression(filter);
    }
  };

  export const matchExpression: <A>(_: matchers.FullKindMatcher<Expression, A, Expression["kind"]>) => Function1<Expression, A> =
    matchers.matchKind;

  export const matchExpression2: <A>(
    _: {
      and: Function1<Conjunction, A>;
      or: Function1<Disjunction, A>;
      equality: Function1<Equality, A>;
      inequality: Function1<Inequality, A>;
      incomplete: Function1<Incomplete, A>;
    }
  ) => (_: Expression) => A = switcher => expression => {
    switch (expression.kind) {
      case "And":
        return switcher.and(expression);
      case "Or":
        return switcher.or(expression);
      case "Equality":
        return switcher.equality(expression);
      case "Inequality":
        return switcher.inequality(expression);
      case "Incomplete":
        return switcher.incomplete(expression);
    }
  };

  export const matchLiteral: <A>(
    _: {
      str: Function1<string, A>;
      int: Function1<number, A>;
      dbl: Function1<number, A>;
      bool: Function1<boolean, A>;
      geom: Function1<string, A>; // Nog uit te werken.
      date: Function1<number, A>; // Nog uit te werken.
      datetime: Function1<number, A>; // Nog uit te werken.
      json: Function1<string, A>; // Nog uit te werken.
    }
  ) => (_: Literal) => A = switcher => literal => {
    switch (literal.type) {
      case "string":
        return switcher.str(literal.value as string);
      case "integer":
        return switcher.int(literal.value as number);
      case "boolean":
        return switcher.bool(literal.value as boolean);
      case "double":
        return switcher.dbl(literal.value as number);
      case "geometry":
        return switcher.geom(literal.value as string);
      case "date":
        return switcher.date(literal.value as number);
      case "datetime":
        return switcher.datetime(literal.value as number);
      case "json":
        return switcher.json(literal.value as string);
    }
  };

  export const matchTypeTypeWithFallback: <A>(_: matchers.FallbackMatcher<TypeType, A, TypeType>) => (_: TypeType) => A = switcher =>
    matchers.matchWithFallback(switcher)(identity);

  export const isEmpty: Predicate<Filter> = matchFilter({
    expression: constant(false),
    pure: constant(true)
  });

  export const isDefined: Predicate<Filter> = not(isEmpty);
}
