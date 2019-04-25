import { constant, Function1, Function2, Lazy, not, Predicate } from "fp-ts/lib/function";

// Een namespace is nodig omdat verschillende types dezelfde naam hebben als die voor stijlen en er kan maar 1 naam
// geëxporteerd worden buiten de module.
export namespace Filter {
  export type Filter = PureFilter | ExpressionFilter; // Later ook | RawCQLFilter

  export interface PureFilter {
    readonly kind: "PureFilter";
  }

  export interface ExpressionFilter {
    readonly kind: "ExpressionFilter";
    readonly name: string;
    readonly expression: Expression;
  }

  export type Expression = Conjunction | Disjunction | Comparison;

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

  export type Comparison = Equality | Inequality;

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
  }

  function Comparison<C extends Comparison, K extends C["kind"]>(kind: K): Function2<Property, Literal, C> {
    return (property, value) =>
      (({
        kind: kind,
        property: property,
        value: value
      } as unknown) as C);
  }

  export const PureFilter: PureFilter = { kind: "PureFilter" };
  export const pure: Lazy<Filter> = constant(PureFilter);

  export const ExpressionFilter: Function2<string, Expression, ExpressionFilter> = (name, expression) => ({
    kind: "ExpressionFilter",
    name: name,
    expression: expression
  });

  export const Equality: Function2<Property, Literal, Equality> = Comparison("Equality");

  export const Inequality: Function2<Property, Literal, Inequality> = Comparison("Inequality");

  export const Property: Function2<TypeType, string, Property> = (typetype, name) => ({
    kind: "Property",
    type: typetype,
    ref: name
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

  export const matchExpression: <A>(
    _: {
      and: Function1<Conjunction, A>;
      or: Function1<Disjunction, A>;
      equality: Function1<Equality, A>;
      inequality: Function1<Inequality, A>;
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

  export const isEmpty: Predicate<Filter> = matchFilter({
    expression: constant(false),
    pure: constant(true)
  });

  export const isDefined: Predicate<Filter> = not(isEmpty);
}
