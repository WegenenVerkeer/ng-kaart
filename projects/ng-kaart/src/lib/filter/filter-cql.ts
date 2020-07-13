import { option } from "fp-ts";
import { constant, Curried2, Endomorphism, flow, Function1, Function2, Function3, Function4 } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";

import { Filter as fltr } from "../filter/filter-model";
import { formateerDateAsDefaultDate } from "../util/date-time";
import { PartialFunction1 } from "../util/function";

export namespace FilterCql {
  type Generator<A> = Function1<A, option.Option<string>>;
  type Generator2<A> = Curried2<option.Option<string>, A, option.Option<string>>;

  const like: Function1<boolean, string> = caseSensitive => (caseSensitive ? "like" : "ilike");

  // % en ' moeten escaped worden
  const escapeText: Endomorphism<string> = text =>
    text
      .replace(/\\/g, "\\") // eerst de escapes escapen
      .replace(/%/g, "\\%") // dan % escape
      .replace(/'/g, "''"); // en dan ' escapen

  const asDate: PartialFunction1<fltr.ValueType, string> = fltr.stringValue; // Uiteraard nog te verfijnen
  const asDateTime: PartialFunction1<fltr.ValueType, string> = fltr.stringValue; // Uiteraard nog te verfijnen

  const quoteString: Endomorphism<string> = text => `'${text}'`;

  const stringGenerator: Generator<fltr.Literal> = literal =>
    fltr
      .stringValue(literal.value)
      .map(escapeText)
      .map(quoteString);

  const integerGenerator: Generator<fltr.Literal> = literal =>
    fltr
      .numberValue(literal.value)
      .filter(Number.isInteger)
      .map(value => value.toString());

  const doubleGenerator: Generator<fltr.Literal> = literal => fltr.numberValue(literal.value).map(value => value.toString());

  const dateTimeGenerator: Generator<fltr.Literal> = flow(
    fltr.literalValueGetter.get,
    fltr.dateValue,
    option.map(formateerDateAsDefaultDate)
  );

  // In principe heeft de gebruiker niet veel zeggenschap over de properties. Maar ingeval van eigen data kan dat dus om
  // het even wat zijn (voor zover het in een shape file past). We verwachten dat de gebruikers geen "rare" kolomnamen
  // gebruiken. We filteren aan de bron properties weg die toch vreemde kolommen gebruiken. De featureserver laat ons
  // immers niet toe om kolomnamen te quoten zoals dat wel kan bij ruwe SQL.
  const propertyRef: Function1<fltr.Property, String> = property => `properties.${property.ref}`;

  const literalCql: Generator<fltr.Literal> = fltr.matchLiteral({
    boolean: literal => fltr.boolValue(literal.value).map(value => (value ? "true" : "false")),
    string: stringGenerator,
    integer: integerGenerator,
    double: doubleGenerator,
    date: dateTimeGenerator,
    range: () => option.none
  });

  const stringBinaryOperator: Function4<fltr.Property, fltr.BinaryComparisonOperator, fltr.Literal, boolean, option.Option<string>> = (
    property,
    operator,
    literal,
    caseSensitive
  ) =>
    fltr.matchBinaryComparisonOperatorWithFallback({
      equality: () => option.some(`${propertyRef(property)} ${like(caseSensitive)} '${literal.value}'`),
      inequality: () => option.some(`not (${propertyRef(property)} ${like(caseSensitive)} '${literal.value}')`),
      starts: () => option.some(`${propertyRef(property)} ${like(caseSensitive)} '${literal.value}%'`),
      ends: () => option.some(`${propertyRef(property)} ${like(caseSensitive)} '%${literal.value}'`),
      contains: () => option.some(`${propertyRef(property)} ${like(caseSensitive)} '%${literal.value}%'`),
      fallback: () => option.none // de andere operators worden niet ondersteund
    })(operator);

  const defaultSqlFormat = "DD/MM/YYYY";
  const datetimeBinaryOperator = (
    property: fltr.Property,
    operator: fltr.BinaryComparisonOperator,
    literal: fltr.Literal
  ): option.Option<string> => {
    const dateTerm = () =>
      property.sqlFormat.foldL(
        () => `${propertyRef(property)}`, // geen sqlFormat, we gaan er van uit dat veld al date is, mogelijk bij flat tables in nosqlfs
        sqlFormat => `to_date(${propertyRef(property)}, '${sqlFormat}')`
      );

    return fltr.matchBinaryComparisonOperatorWithFallback({
      within: () =>
        pipe(
          literal.value,
          option.fromRefinement(fltr.Range.isRelativeDateRange),
          option.chain(fltr.Range.withinValueToDuration),
          option.map(formateerDateAsDefaultDate),
          option.map(formattedDate => `(${dateTerm()} >= to_date('${formattedDate}', '${defaultSqlFormat}'))`)
        ),
      fallback: () =>
        pipe(
          dateBinaryOperatorSymbols[operator],
          option.fromNullable,
          option.chain(symbol =>
            pipe(
              literalCql(literal),
              option.map(formattedDate => `(${dateTerm()} ${symbol} to_date('${formattedDate}', '${defaultSqlFormat}'))`)
            )
          )
        )
    })(operator);
  };

  const numberBinaryOperatorSymbols = {
    equality: "=",
    inequality: "!=",
    smaller: "<",
    smallerOrEqual: "<=",
    larger: ">",
    largerOrEqual: ">="
  };

  const dateBinaryOperatorSymbols = numberBinaryOperatorSymbols; // Toevallig gelijk

  const numberBinaryOperator = (
    property: fltr.Property,
    operator: fltr.BinaryComparisonOperator,
    literal: fltr.Literal
  ): option.Option<string> =>
    option
      .fromNullable(numberBinaryOperatorSymbols[operator])
      .chain(symbol => literalCql(literal).map(value => `${propertyRef(property)} ${symbol} ${value}`));

  const both: Function3<option.Option<string>, option.Option<string>, string, option.Option<string>> = (maybeLeft, maybeRight, separator) =>
    maybeLeft.fold(
      maybeRight, //
      left => option.some(maybeRight.fold(left, right => `(${left} ${separator} ${right})`))
    );

  const unaryOperator: Function2<fltr.Property, fltr.UnaryComparisonOperator, option.Option<string>> = (property, operator) =>
    fltr.matchUnaryComparisonOperator({
      isEmpty: () => option.some(`${propertyRef(property)} is null`),
      isNotEmpty: () => option.some(`${propertyRef(property)} is not null`)
    })(operator);

  const expressionCql: Generator<fltr.Expression> = fltr.matchExpression({
    And: expr => both(expressionCql(expr.left), expressionCql(expr.right), "AND"),
    Or: expr => both(expressionCql(expr.left), expressionCql(expr.right), "OR"),
    BinaryComparison: (expr: fltr.BinaryComparison) =>
      fltr.matchTypeTypeWithFallback({
        string: () => stringBinaryOperator(expr.property, expr.operator, expr.value, expr.caseSensitive),
        date: () => datetimeBinaryOperator(expr.property, expr.operator, expr.value),
        double: () => numberBinaryOperator(expr.property, expr.operator, expr.value),
        integer: () => numberBinaryOperator(expr.property, expr.operator, expr.value),
        boolean: () => numberBinaryOperator(expr.property, expr.operator, expr.value),
        fallback: () => option.none
      })(expr.property.type),
    UnaryComparison: expr => unaryOperator(expr.property, expr.operator)
  });

  export const cql: Function1<fltr.Filter, option.Option<string>> = fltr.matchFilter({
    EmptyFilter: constant(option.none),
    ExpressionFilter: expr => expressionCql(expr.expression)
  });
}
