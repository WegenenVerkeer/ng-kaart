import { Function1 } from "fp-ts/lib/function";

import { Filter as fltr } from "./filter-model";

// Serialiseer een filter naar een string

export namespace FilterText {
  export type Generator<A> = Function1<A, string>;

  const propertyText: Generator<fltr.Property> = property => property.ref;
  const literalText: Generator<fltr.Literal> = fltr.matchLiteral({
    bool: b => (b ? "waar" : "vals"),
    date: d => d.toString(),
    datetime: d => d.toString(),
    dbl: d => d.toString(), // Afronden of sprintf?
    geom: d => "<geometrie>",
    int: i => i.toString(),
    json: j => "<json>",
    str: s => `'${s}'`
  });

  const expressionText: Generator<fltr.Expression> = fltr.matchExpression({
    And: expr => `${expressionText(expr.left)} en ${expressionText(expr.right)}`,
    Or: expr => `${expressionText(expr.left)} of ${expressionText(expr.right)}`,
    Equality: expr => `${propertyText(expr.property)} = ${literalText(expr.value)}`,
    Inequality: expr => `${propertyText(expr.property)} <> ${literalText(expr.value)}`,
    Incomplete: expr => `${propertyText(expr.property)} <> ${literalText(expr.value)}`
  });

  export const filterText: Generator<fltr.Filter> = fltr.matchFilter({
    pure: () => "alle waarden",
    expression: exprFltr => expressionText(exprFltr.expression)
  });
}

export namespace FilterAwv0Json {
  export const encode: Function1<fltr.Filter, string> = filter => JSON.stringify({ version: "awv-v0", definition: filter });
}
