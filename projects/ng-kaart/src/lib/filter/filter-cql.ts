import { constant, Function1, pipe } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";

import { Filter as fltr } from "../filter/filter-model";

export namespace FilterCql {
  type Generator<A> = Function1<A, string>;

  const propertyCql: Generator<fltr.Property> = property => `properties.${property.ref}`;

  const literalCql: Generator<fltr.Literal> = fltr.matchLiteral({
    bool: literal => (literal ? "true" : "false"),
    str: literal => `'${literal}'`,
    int: literal => `${literal}`,
    dbl: literal => `${literal}`,
    date: literal => `'${literal}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    datetime: literal => `'${literal}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    geom: literal => `'${literal}'`, // beschouw al de rest als string. Zie TODO bij TypeType
    json: literal => `'${literal}'` // beschouw al de rest als string. Zie TODO bij TypeType
  });

  const expressionCql: Generator<fltr.Expression> = fltr.matchExpression({
    and: expr => expressionCql(expr.left) + " AND " + expressionCql(expr.right),
    or: expr => expressionCql(expr.left) + " OR " + expressionCql(expr.right),
    equality: expr => propertyCql(expr.property) + " = " + literalCql(expr.value),
    inequality: expr => propertyCql(expr.property) + " != " + literalCql(expr.value)
  });

  export const cql: Function1<fltr.Filter, Option<string>> = fltr.matchFilter({
    pure: constant(none),
    expression: pipe(
      expr => expr.expression,
      expressionCql,
      some
    )
  });
}
