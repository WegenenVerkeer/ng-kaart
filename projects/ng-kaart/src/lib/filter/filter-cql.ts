import { constant, Function1, Function3 } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";

import { Filter as fltr } from "../filter/filter-model";

export namespace FilterCql {
  type Generator<A> = Function1<A, Option<string>>;

  const propertyRef: Function1<fltr.Property, String> = property => `properties.${property.ref}`;

  const literalCql: Generator<fltr.Literal> = fltr.matchLiteral({
    boolean: literal => some(literal.value ? "true" : "false"),
    string: literal => some(`'${literal.value}'`),
    integer: literal => some(`${literal.value}`),
    double: literal => some(`${literal.value}`),
    date: () => none, // niet ondersteund
    datetime: () => none,
    geometry: () => none,
    json: () => none
  });

  // TODO prevent CQL injection
  const stringBinaryOperator: Function3<fltr.Property, fltr.BinaryComparisonOperator, fltr.Literal, Option<string>> = (
    property,
    operator,
    literal
  ) =>
    fltr.matchBinaryComparisonOperatorWithFallback({
      equality: () => some(`${propertyRef(property)} = '${literal.value}'`),
      inequality: () => some(`${propertyRef(property)} != '${literal.value}'`),
      starts: () => some(`${propertyRef(property)} like '${literal.value}%'`), // TODO prevent %
      ends: () => some(`${propertyRef(property)} like '%${literal.value}'`), // TODO prevent %
      isempty: () => some(`${propertyRef(property)} is null`), // TODO prevent %
      isnotempty: () => some(`${propertyRef(property)} is not null`), // TODO prevent %
      contains: () => some(`${propertyRef(property)} like '%${literal.value}%'`), // TODO prevent %,
      fallback: () => none // de andere operators worden niet ondersteund
    })(operator);

  const numberBinaryOperatorSymbols = {
    equality: "=",
    inequality: "!=",
    smaller: "<",
    smallerOrEqual: "<=",
    larger: ">",
    largerOrEqual: ">="
  };

  const numberBinaryOperator: Function3<fltr.Property, fltr.BinaryComparisonOperator, fltr.Literal, Option<string>> = (
    property,
    operator,
    literal
  ) =>
    fromNullable(numberBinaryOperatorSymbols[operator]).chain(symbol =>
      literalCql(literal).map(value => `${propertyRef(property)} ${symbol} ${value}`)
    );

  const both: Function3<Option<string>, Option<string>, string, Option<string>> = (maybeLeft, maybeRight, separator) =>
    maybeLeft.fold(
      maybeRight, //
      left => some(maybeRight.fold(left, right => `${left} ${separator} ${right}`))
    );

  const expressionCql: Generator<fltr.Expression> = fltr.matchExpression({
    And: expr => both(expressionCql(expr.left), expressionCql(expr.right), "AND"),
    Or: expr => both(expressionCql(expr.left), expressionCql(expr.right), "OR"),
    BinaryComparison: expr =>
      fltr.matchTypeTypeWithFallback({
        string: () => stringBinaryOperator(expr.property, expr.operator, expr.value),
        double: () => numberBinaryOperator(expr.property, expr.operator, expr.value),
        integer: () => numberBinaryOperator(expr.property, expr.operator, expr.value),
        boolean: () => numberBinaryOperator(expr.property, expr.operator, expr.value), // zouden we in principe niet mogen hebben
        fallback: () => none
      })(expr.property.type)
  });

  export const cql: Function1<fltr.Filter, Option<string>> = fltr.matchFilter({
    EmptyFilter: constant(none),
    ExpressionFilter: expr => expressionCql(expr.expression)
  });
}
