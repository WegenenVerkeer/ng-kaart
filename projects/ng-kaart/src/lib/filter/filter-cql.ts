import { constant, Curried2, Endomorphism, flow, Function1, Function2, Function3, Function4 } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";

import { Filter as fltr } from "../filter/filter-model";
import { formateerDate, formateerDateAsDefaultDate } from "../util/date-time";
import { PartialFunction1 } from "../util/function";

export namespace FilterCql {
  type Generator<A> = Function1<A, Option<string>>;
  type Generator2<A> = Curried2<Option<string>, A, Option<string>>;

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

  const dateTimeGenerator: Generator<fltr.Literal> = literal => fltr.dateValue(literal.value).map(formateerDateAsDefaultDate);

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
    datetime: dateTimeGenerator,
    quantity: () => none // FIXME
  });

  const stringBinaryOperator: Function4<fltr.Property, fltr.BinaryComparisonOperator, fltr.Literal, boolean, Option<string>> = (
    property,
    operator,
    literal,
    caseSensitive
  ) =>
    fltr.matchBinaryComparisonOperatorWithFallback({
      equality: () => some(`${propertyRef(property)} ${like(caseSensitive)} '${literal.value}'`),
      inequality: () => some(`not (${propertyRef(property)} ${like(caseSensitive)} '${literal.value}')`),
      starts: () => some(`${propertyRef(property)} ${like(caseSensitive)} '${literal.value}%'`),
      ends: () => some(`${propertyRef(property)} ${like(caseSensitive)} '%${literal.value}'`),
      contains: () => some(`${propertyRef(property)} ${like(caseSensitive)} '%${literal.value}%'`),
      fallback: () => none // de andere operators worden niet ondersteund
    })(operator);

  const datetimeBinaryOperator = (
    property: fltr.Property,
    operator: fltr.BinaryComparisonOperator,
    literal: fltr.Literal
  ): Option<string> => {
    const format = property.sqlFormat.getOrElse("DD/MM/YYYY");
    if (operator === "within") {
      return fltr
        .withinValueToDuration(<fltr.Quantity>literal.value)
        .map(formateerDate(none))
        .map(formattedDate => `(to_date(${propertyRef(property)}, '${format}') >= to_date('${formattedDate}', 'DD/MM/YYYY'))`);
    } else {
      return fromNullable(numberBinaryOperatorSymbols[operator]).chain(symbol =>
        literalCql(literal).map(value => `(to_date(${propertyRef(property)}, '${format}') ${symbol} to_date('${value}', 'DD/MM/YYYY'))`)
      );
    }
  };

  const numberBinaryOperatorSymbols = {
    equality: "=",
    inequality: "!=",
    smaller: "<",
    smallerOrEqual: "<=",
    larger: ">",
    largerOrEqual: ">="
  };

  const numberBinaryOperator = (property: fltr.Property, operator: fltr.BinaryComparisonOperator, literal: fltr.Literal): Option<string> =>
    fromNullable(numberBinaryOperatorSymbols[operator]).chain(symbol =>
      literalCql(literal).map(value => `${propertyRef(property)} ${symbol} ${value}`)
    );

  const both: Function3<Option<string>, Option<string>, string, Option<string>> = (maybeLeft, maybeRight, separator) =>
    maybeLeft.fold(
      maybeRight, //
      left => some(maybeRight.fold(left, right => `(${left} ${separator} ${right})`))
    );

  const unaryOperator: Function2<fltr.Property, fltr.UnaryComparisonOperator, Option<string>> = (property, operator) =>
    fltr.matchUnaryComparisonOperator({
      isEmpty: () => some(`${propertyRef(property)} is null`),
      isNotEmpty: () => some(`${propertyRef(property)} is not null`)
    })(operator);

  const expressionCql: Generator<fltr.Expression> = fltr.matchExpression({
    And: expr => both(expressionCql(expr.left), expressionCql(expr.right), "AND"),
    Or: expr => both(expressionCql(expr.left), expressionCql(expr.right), "OR"),
    BinaryComparison: expr =>
      fltr.matchTypeTypeWithFallback({
        string: () => stringBinaryOperator(expr.property, expr.operator, expr.value, expr.caseSensitive),
        date: () => datetimeBinaryOperator(expr.property, expr.operator, expr.value),
        datetime: () => datetimeBinaryOperator(expr.property, expr.operator, expr.value),
        double: () => numberBinaryOperator(expr.property, expr.operator, expr.value),
        integer: () => numberBinaryOperator(expr.property, expr.operator, expr.value),
        boolean: () => numberBinaryOperator(expr.property, expr.operator, expr.value),
        fallback: () => none
      })(expr.property.type),
    UnaryComparison: expr => unaryOperator(expr.property, expr.operator)
  });

  export const cql: Function1<fltr.Filter, Option<string>> = fltr.matchFilter({
    EmptyFilter: constant(none),
    ExpressionFilter: expr => expressionCql(expr.expression)
  });
}
