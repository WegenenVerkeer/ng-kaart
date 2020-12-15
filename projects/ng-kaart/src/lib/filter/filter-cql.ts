import { option } from "fp-ts";
import { constant, Endomorphism, flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";

import { Filter as fltr } from "../filter/filter-model";
import { formateerDateAsDefaultDate } from "../util/date-time";
import { PartialFunction1 } from "../util/function";

export namespace FilterCql {
  type Generator<A> = (arg: A) => option.Option<string>;
  type Generator2<A> = (
    os: option.Option<string>
  ) => (A) => option.Option<string>;

  const like: (caseSensitive: boolean) => string = (caseSensitive) =>
    caseSensitive ? "like" : "ilike";

  // % en ' moeten escaped worden
  const escapeText: Endomorphism<string> = (text) =>
    text
      .replace(/\\/g, "\\") // eerst de escapes escapen
      .replace(/%/g, "\\%") // dan % escape
      .replace(/'/g, "''"); // en dan ' escapen

  const asDate: PartialFunction1<fltr.ValueType, string> = fltr.stringValue; // Uiteraard nog te verfijnen
  const asDateTime: PartialFunction1<fltr.ValueType, string> = fltr.stringValue; // Uiteraard nog te verfijnen

  const quoteString: Endomorphism<string> = (text) => `'${text}'`;

  const stringGenerator: Generator<fltr.Literal> = (literal) =>
    pipe(
      fltr.stringValue(literal.value),
      option.map(escapeText),
      option.map(quoteString)
    );

  const integerGenerator: Generator<fltr.Literal> = (literal) =>
    pipe(
      fltr.numberValue(literal.value),
      option.filter(Number.isInteger),
      option.map((value: number) => value.toString())
    );

  const doubleGenerator: Generator<fltr.Literal> = (literal) =>
    pipe(
      fltr.numberValue(literal.value),
      option.map((value) => value.toString())
    );

  const dateTimeGenerator: Generator<fltr.Literal> = flow(
    fltr.literalValueGetter.get,
    fltr.dateValue,
    option.map(formateerDateAsDefaultDate)
  );

  // In principe heeft de gebruiker niet veel zeggenschap over de properties. Maar ingeval van eigen data kan dat dus om
  // het even wat zijn (voor zover het in een shape file past). We verwachten dat de gebruikers geen "rare" kolomnamen
  // gebruiken. We filteren aan de bron properties weg die toch vreemde kolommen gebruiken. De featureserver laat ons
  // immers niet toe om kolomnamen te quoten zoals dat wel kan bij ruwe SQL.
  const propertyRef: (arg: fltr.Property) => String = (property) =>
    `properties.${property.ref}`;

  const literalCql: Generator<fltr.Literal> = fltr.matchLiteral({
    boolean: (literal) =>
      pipe(
        fltr.boolValue(literal.value),
        option.map((value) => (value ? "true" : "false"))
      ),
    string: stringGenerator,
    integer: integerGenerator,
    double: doubleGenerator,
    date: dateTimeGenerator,
    range: () => option.none,
  });

  const stringBinaryOperator: (
    property: fltr.Property,
    operator: fltr.BinaryComparisonOperator,
    literal: fltr.Literal,
    caseSensitive: boolean
  ) => option.Option<string> = (property, operator, literal, caseSensitive) =>
    fltr.matchBinaryComparisonOperatorWithFallback({
      equality: () =>
        option.some(
          `${propertyRef(property)} ${like(caseSensitive)} '${literal.value}'`
        ),
      inequality: () =>
        option.some(
          `not (${propertyRef(property)} ${like(caseSensitive)} '${
            literal.value
          }')`
        ),
      starts: () =>
        option.some(
          `${propertyRef(property)} ${like(caseSensitive)} '${literal.value}%'`
        ),
      ends: () =>
        option.some(
          `${propertyRef(property)} ${like(caseSensitive)} '%${literal.value}'`
        ),
      contains: () =>
        option.some(
          `${propertyRef(property)} ${like(caseSensitive)} '%${literal.value}%'`
        ),
      fallback: () => option.none, // de andere operators worden niet ondersteund
    })(operator);

  const defaultSqlFormat = "DD/MM/YYYY";
  const datetimeBinaryOperator = (
    property: fltr.Property,
    operator: fltr.BinaryComparisonOperator,
    literal: fltr.Literal
  ): option.Option<string> => {
    const dateTerm = () =>
      option.fold(
        () => `${propertyRef(property)}`, // geen sqlFormat, we gaan er van uit dat veld al date is, mogelijk bij flat tables in nosqlfs
        (sqlFormat) => `to_date(${propertyRef(property)}, '${sqlFormat}')`
      )(property.sqlFormat);

    return fltr.matchBinaryComparisonOperatorWithFallback({
      within: () =>
        pipe(
          option.some(literal.value),
          option.filter(fltr.Range.isRelativeDateRange),
          option.chain(fltr.Range.withinValueToDuration),
          option.map(formateerDateAsDefaultDate),
          option.map(
            (formattedDate) =>
              `(${dateTerm()} >= to_date('${formattedDate}', '${defaultSqlFormat}'))`
          )
        ),
      fallback: () =>
        pipe(
          dateBinaryOperatorSymbols[operator],
          option.fromNullable,
          option.chain((symbol) =>
            pipe(
              literalCql(literal),
              option.map(
                (formattedDate) =>
                  `(${dateTerm()} ${symbol} to_date('${formattedDate}', '${defaultSqlFormat}'))`
              )
            )
          )
        ),
    })(operator);
  };

  const numberBinaryOperatorSymbols = {
    equality: "=",
    inequality: "!=",
    smaller: "<",
    smallerOrEqual: "<=",
    larger: ">",
    largerOrEqual: ">=",
  };

  const dateBinaryOperatorSymbols = numberBinaryOperatorSymbols; // Toevallig gelijk

  const numberBinaryOperator = (
    property: fltr.Property,
    operator: fltr.BinaryComparisonOperator,
    literal: fltr.Literal
  ): option.Option<string> =>
    pipe(
      option.fromNullable(numberBinaryOperatorSymbols[operator]),
      option.chain((symbol) =>
        pipe(
          literalCql(literal),
          option.map((value) => `${propertyRef(property)} ${symbol} ${value}`)
        )
      )
    );

  const both: (
    maybeLeft: option.Option<string>,
    maybeRight: option.Option<string>,
    separator: string
  ) => option.Option<string> = (maybeLeft, maybeRight, separator) =>
    option.fold(
      () => maybeRight, //
      (left: string) =>
        option.some(
          option.fold(
            () => left,
            (right) => `(${left} ${separator} ${right})`
          )(maybeRight)
        )
    )(maybeLeft);

  const unaryOperator: (
    property: fltr.Property,
    operator: fltr.UnaryComparisonOperator
  ) => option.Option<string> = (property, operator) =>
    fltr.matchUnaryComparisonOperator({
      isEmpty: () => option.some(`${propertyRef(property)} is null`),
      isNotEmpty: () => option.some(`${propertyRef(property)} is not null`),
    })(operator);

  const expressionCql: Generator<fltr.Expression> = fltr.matchExpression({
    And: (expr) =>
      both(expressionCql(expr.left), expressionCql(expr.right), "AND"),
    Or: (expr) =>
      both(expressionCql(expr.left), expressionCql(expr.right), "OR"),
    BinaryComparison: (expr: fltr.BinaryComparison) =>
      fltr.matchTypeTypeWithFallback({
        string: () =>
          stringBinaryOperator(
            expr.property,
            expr.operator,
            expr.value,
            expr.caseSensitive
          ),
        date: () =>
          datetimeBinaryOperator(expr.property, expr.operator, expr.value),
        double: () =>
          numberBinaryOperator(expr.property, expr.operator, expr.value),
        integer: () =>
          numberBinaryOperator(expr.property, expr.operator, expr.value),
        boolean: () =>
          numberBinaryOperator(expr.property, expr.operator, expr.value),
        fallback: () => option.none,
      })(expr.property.type),
    UnaryComparison: (expr) => unaryOperator(expr.property, expr.operator),
  });

  export const cql: (
    arg: fltr.Filter
  ) => option.Option<string> = fltr.matchFilter({
    EmptyFilter: constant(option.none),
    ExpressionFilter: (expr) => expressionCql(expr.expression),
  });
}
