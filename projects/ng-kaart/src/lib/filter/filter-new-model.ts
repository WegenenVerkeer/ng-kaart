import { constant, Function1, Function2, Lazy, not, pipe, Predicate } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";

// Simple filter defs

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

export interface Conjunction {
  readonly kind: "And";
  readonly left: Comparison;
  readonly right: Comparison;
}

export interface Disjunction {
  readonly kind: "Or";
  readonly left: Conjunction;
  readonly right: Conjunction;
}

export type Comparison = Equality | Inequality;

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

export interface SimpleFilter {
  readonly kind: Equality | Inequality;
  readonly left: Property;
  readonly right: Literal;
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

const switchFilter: <A>(
  _: {
    pure: Lazy<A>;
    expression: Function1<Expression, A>;
  }
) => (_: Filter) => A = switcher => filter => {
  switch (filter.kind) {
    case "PureFilter":
      return switcher.pure();
    case "ExpressionFilter":
      return switcher.expression(filter.expression);
  }
};

const switchExpression: <A>(
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

const switchLiteral: <A>(
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

export const isEmpty: Predicate<Filter> = switchFilter({
  expression: constant(true),
  pure: constant(false)
});

export const isDefined: Predicate<Filter> = not(isEmpty);

// Hulp bij het opbouwen van een filter

export namespace FilterBuilder {
  export type FilterBuildElement = ComparisonBuilder; // later ook voor PropertyRangeOperator, enz

  interface ComparisonBuilder {
    readonly description: string;
    readonly build: Function2<Property, Literal, Comparison>;
  }

  export const comparisonBuilders: ComparisonBuilder[] = [
    { description: "is", build: Equality },
    { description: "is niet", build: Inequality }
  ];
}

// Maak CQL -> naar andere file
export namespace FilterCql {
  type Generator<A> = Function1<A, string>;

  const propertyCql: Generator<Property> = property => `properties.${property.ref}`;

  const literalCql: Generator<Literal> = switchLiteral({
    bool: literal => (literal ? "true" : "false"),
    str: literal => `'${literal}'`,
    int: literal => `${literal}`,
    dbl: literal => `${literal}`,
    date: literal => `'${literal}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    datetime: literal => `'${literal}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    geom: literal => `'${literal}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    json: literal => `'${literal}'` // beschouw al de rest als string. Zie TODO bij TypeType
  });

  const expressionCql: Generator<Expression> = switchExpression({
    and: expr => expressionCql(expr.left) + " AND " + expressionCql(expr.right),
    or: expr => expressionCql(expr.left) + " OR " + expressionCql(expr.right),
    equality: expr => propertyCql(expr.property) + " = " + literalCql(expr.value),
    inequality: expr => propertyCql(expr.property) + " <> " + literalCql(expr.value)
  });

  export const cql: Function1<Filter, Option<string>> = switchFilter({
    pure: constant(none),
    expression: pipe(
      expressionCql,
      some
    )
  });
}

// Maak een tekstvoorstelling -> naar andere file

export namespace FilterText {
  export type Generator<A> = Function1<A, string>;

  const propertyText: Generator<Property> = property => property.ref;
  const literalText: Generator<Literal> = switchLiteral({
    bool: b => (b ? "waar" : "vals"),
    date: d => d.toString(),
    datetime: d => d.toString(),
    dbl: d => d.toString(), // Afronden of sprintf?
    geom: d => "<geometrie>",
    int: i => i.toString(),
    json: j => "<json>",
    str: s => `'${s}'`
  });

  const expressionText: Generator<Expression> = switchExpression({
    and: expr => `${expressionText(expr.left)} en ${expressionText(expr.right)}`,
    or: expr => `${expressionText(expr.left)} of ${expressionText(expr.right)}`,
    equality: expr => `${propertyText(expr.property)} = ${literalText(expr.value)}`,
    inequality: expr => `${propertyText(expr.property)} <> ${literalText(expr.value)}`
  });

  export const filterText: Generator<Filter> = switchFilter({
    pure: () => "alle waarden",
    expression: expressionText
  });
}
