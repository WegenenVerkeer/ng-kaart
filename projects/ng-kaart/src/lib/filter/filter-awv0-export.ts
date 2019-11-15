import { option, record } from "fp-ts";
import { Function1 } from "fp-ts/lib/function";
import { DateTime } from "luxon";
import { identity } from "rxjs";
import { isArray } from "util";

import { formateerDateAsDefaultDate } from "../util/date-time";

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
    string: s => `'${s}'`,
    url: u => `'${u}'`
  });

  const operatorSymbols = {
    equality: "=",
    inequality: "!="
  };

  const expressionText: Generator<fltr.Expression> = fltr.matchExpression({
    And: expr => `${expressionText(expr.left)} en ${expressionText(expr.right)}`,
    Or: expr => `${expressionText(expr.left)} of ${expressionText(expr.right)}`,
    BinaryComparison: expr => `${propertyText(expr.property)} ${operatorSymbols[expr.operator]} ${literalText(expr.value)}`,
    UnaryComparison: expr => `${propertyText(expr.property)} ${operatorSymbols[expr.operator]}`
  });

  export const filterText: Generator<fltr.Filter> = fltr.matchFilter({
    EmptyFilter: () => "alle waarden",
    ExpressionFilter: exprFltr => expressionText(exprFltr.expression)
  });
}

export namespace FilterAwv0Json {
  type Encoder<A> = Function1<A, object>;

  // function flattenOptionRecursively(obj: any): any {
  //   // De primitieven + null
  //   if (null === obj || "object" !== typeof obj) {
  //     return obj;
  //   }

  //   // Arrays
  //   if (isArray(obj)) {
  //     const cloned: any[] = [];
  //     for (let i = 0; i < obj.length; ++i) {
  //       cloned[i] = flattenOptionRecursively(obj[i]);
  //     }
  //     return cloned;
  //   }

  //   // Option
  //   const toUndefined = obj["toUndefined"];
  //   if (typeof toUndefined === "function") {
  //     // We veronderstellen een object dat gelijkaardig is aan Option
  //     return (obj as any).toUndefined();
  //   }

  //   // Algemene object
  //   const cloned = {};
  //   Object.entries(obj).forEach(([key, value]) => {
  //     cloned[key] = flattenOptionRecursively(value);
  //   });
  //   return cloned;
  // }

  // // JSON kan enkel primitives, key-values en arrays aan. Option e.d. mogen dus niet.
  // const flattenOption: Function1<fltr.Filter, any> = filter => flattenOptionRecursively(filter);

  // const optionally = (key: string, value: unknown): object => (value === undefined ? {} : record.compact);

  const encodeProperty: Encoder<fltr.Property> = property => ({
    kind: property.kind,
    type: property.type,
    ref: property.ref,
    label: property.label,
    ...record.compact({ sqlFormat: property.sqlFormat })
  });

  type JsonEncodable = string | boolean | number | object | unknown[];

  const encodeValue = (value: fltr.ValueType, valueType: fltr.TypeType): JsonEncodable =>
    fltr.matchTypeTypeWithFallback({
      boolean: () => value as JsonEncodable, // Mag niet te nauw zijn want bepaalt type van alle volgende exepressies
      double: () => value as number,
      integer: () => value as number,
      string: () => value as string,
      date: () => formateerDateAsDefaultDate(value as DateTime),
      fallback: () => "<unsupported>"
    })(valueType);

  const encodeLiteral = (literal: fltr.Literal): JsonEncodable => ({
    kind: literal.kind,
    type: literal.type,
    value: encodeValue(literal.value, literal.type)
  });

  const encodeUnaryComparison: Encoder<fltr.UnaryComparison> = unaryComparion => ({
    kind: unaryComparion.kind,
    operator: unaryComparion.operator,
    property: encodeProperty(unaryComparion.property)
  });

  const encodeBinaryComparison: Encoder<fltr.BinaryComparison> = binaryComparion => ({
    kind: binaryComparion.kind,
    caseSensitive: binaryComparion.caseSensitive,
    operator: binaryComparion.operator,
    property: encodeProperty(binaryComparion.property),
    value: encodeLiteral(binaryComparion.value)
  });

  const encodeConjunctionExpression: Encoder<fltr.ConjunctionExpression> = fltr.matchConjunctionExpression({
    And: encodeConjunction,
    BinaryComparison: encodeBinaryComparison,
    UnaryComparison: encodeUnaryComparison
  });

  const encodeDisjunction: Encoder<fltr.Disjunction> = disjunction => ({
    kind: disjunction.kind,
    left: encodeExpression(disjunction.left),
    right: encodeExpression(disjunction.right)
  });

  function encodeConjunction(conjuncion: fltr.Conjunction): object {
    return {
      kind: conjuncion.kind,
      left: encodeConjunctionExpression(conjuncion.left),
      right: encodeConjunctionExpression(conjuncion.right)
    };
  }

  const encodeExpression: Encoder<fltr.Expression> = fltr.matchExpression({
    And: encodeConjunction,
    Or: encodeDisjunction,
    UnaryComparison: encodeUnaryComparison,
    BinaryComparison: encodeBinaryComparison
  });

  const encodeExpressionFilter: Encoder<fltr.ExpressionFilter> = expFlter => ({
    kind: expFlter.kind,
    expression: encodeExpression(expFlter.expression),
    ...record.compact({ name: expFlter.name })
  });

  const encodeFilter: Encoder<fltr.Filter> = fltr.matchFilter({
    EmptyFilter: fltr.empty,
    ExpressionFilter: encodeExpressionFilter
  });

  export const encode: Function1<fltr.Filter, string> = filter => JSON.stringify({ version: "awv-v0", definition: encodeFilter(filter) });
}
