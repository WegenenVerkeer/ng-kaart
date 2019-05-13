import { constant, Function1, pipe } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";

import { Filter as fltr } from "../filter/filter-model";

export namespace FilterCql {
  type Generator<A> = Function1<A, string>;

  const propertyCql: Generator<fltr.Property> = property => `properties.${property.ref}`;

  const literalCql: Generator<fltr.Literal> = fltr.matchLiteral({
    boolean: literal => (literal ? "true" : "false"),
    string: literal => `'${literal.value}'`,
    integer: literal => `${literal.value}`,
    double: literal => `${literal.value}`,
    date: literal => `'${literal.value}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    datetime: literal => `'${literal.value}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    geometry: literal => `'${literal.value}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    json: literal => `'${literal.value}'` // beschouw al de rest als string. Zie TODO bij TypeType
  });

  const binaryOperatorSymbols = {
    equality: "=",
    inequality: "!="
  };

  const expressionCql: Generator<fltr.Expression> = fltr.matchExpression({
    And: expr => expressionCql(expr.left) + " AND " + expressionCql(expr.right),
    Or: expr => expressionCql(expr.left) + " OR " + expressionCql(expr.right),
    BinaryComparison: expr => `${propertyCql(expr.property)} ${binaryOperatorSymbols[expr.operator]} ${literalCql(expr.value)}`
  });

  export const cql: Function1<fltr.Filter, Option<string>> = fltr.matchFilter({
    EmptyFilter: constant(none),
    ExpressionFilter: pipe(
      expr => expr.expression,
      expressionCql,
      some
    )
  });
}
