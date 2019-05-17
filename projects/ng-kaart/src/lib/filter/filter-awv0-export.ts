import { Function1 } from "fp-ts/lib/function";

import { Filter as fltr } from "./filter-model";

// Serialiseer een filter naar een string

export namespace FilterText {
  export type Generator<A> = Function1<A, string>;

  const propertyText: Generator<fltr.Property> = property => property.ref;
  const literalText: Generator<fltr.Literal> = fltr.matchLiteral({
    boolean: b => (b ? "waar" : "vals"),
    date: d => d.toString(),
    datetime: d => d.toString(),
    double: d => d.toString(), // Afronden of sprintf?
    geometry: d => "<geometrie>",
    integer: i => i.toString(),
    json: j => "<json>",
    string: s => `'${s}'`
  });

  const operatorSymbols = {
    equality: "=",
    inequality: "!="
  };

  const expressionText: Generator<fltr.Expression> = fltr.matchExpression({
    And: expr => `${expressionText(expr.left)} en ${expressionText(expr.right)}`,
    Or: expr => `${expressionText(expr.left)} of ${expressionText(expr.right)}`,
    BinaryComparison: expr => `${propertyText(expr.property)} ${operatorSymbols[expr.operator]} ${literalText(expr.value)}`
  });

  export const filterText: Generator<fltr.Filter> = fltr.matchFilter({
    EmptyFilter: () => "alle waarden",
    ExpressionFilter: exprFltr => expressionText(exprFltr.expression)
  });
}

export namespace FilterAwv0Json {
  const fixName: Function1<fltr.Filter, any> = filter => {
    return fltr.matchFilter({
      EmptyFilter: () => filter as any, // cast nodig omdat TS beide resultaattypes gelijk wil trekken and wat the eager is
      ExpressionFilter: expr => ({ ...filter, name: expr.name.toUndefined() })
    })(filter);
  };

  export const encode: Function1<fltr.Filter, string> = filter => JSON.stringify({ version: "awv-v0", definition: fixName(filter) });
}
