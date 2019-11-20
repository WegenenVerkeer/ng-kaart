import { option } from "fp-ts";
import * as array from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/pipeable";

import * as oi from "../stijl/json-object-interpreting";
import { asString } from "../util";
import { parseDefaultDate } from "../util/date-time";

import { Filter as fltr } from "./filter-model";

export namespace AwvV0FilterInterpreters {
  const byKind: <A>(interpretersByKind: { [k: string]: oi.Interpreter<A> }) => oi.Interpreter<A> = interpretersByKind =>
    oi.byTypeDiscriminator("kind", interpretersByKind);

  const emptyFilter: oi.Interpreter<fltr.EmptyFilter> = oi.pure(fltr.EmptyFilter);

  const typeType: oi.Interpreter<fltr.TypeType> = oi.enu<fltr.TypeType>(
    "boolean",
    "string",
    "double",
    "integer",
    "date",
    "datetime",
    "boolean",
    "range"
  );

  const property: oi.Interpreter<fltr.Property> = oi.interpretRecord({
    kind: oi.field("kind", oi.value("Property")),
    type: oi.field("type", typeType),
    ref: oi.field("ref", oi.str),
    label: oi.field("label", oi.str),
    sqlFormat: oi.optField("sqlFormat", oi.str)
  });

  const range: oi.Interpreter<fltr.Range> = oi.interpretRecord({
    unit: oi.field("unit", oi.str), // de controle van de specifieke units gebeurt later (propertyAndValueCompatible)
    magnitude: oi.field("magnitude", oi.num)
  });

  const value: oi.Interpreter<fltr.ValueType> = oi.mapFailureTo(
    oi.firstOf<fltr.ValueType>(oi.bool, oi.num, oi.str, range),
    "De waarde moet een bool, number of string zijn"
  );

  // In JSON kunnen we enkel boolean, number en string kwijt. De rest moeten we op basis daarvan interpreteren.
  const checkRawLiteral: (rawLiteral: fltr.Literal) => oi.Interpreter<fltr.Literal> = fltr.matchLiteral({
    boolean: lit => oi.succeed({ ...lit, value: lit.value !== "false" }),
    date: lit =>
      pipe(
        lit.value,
        asString,
        option.chain(parseDefaultDate),
        option.fold(
          () => oi.failed<fltr.Literal>(`Ongeldige datum ${lit.value}`),
          date =>
            oi.succeed({
              ...lit,
              value: date
            })
        )
      ),
    datetime: lit => oi.succeed(lit), // TODO parse
    double: lit => oi.succeed(lit),
    integer: lit => oi.succeed(lit),
    string: lit => oi.succeed(lit),
    range: lit => oi.succeed(lit)
  });

  const literal: oi.Interpreter<fltr.Literal> = oi.chain(
    oi.interpretRecord({
      kind: oi.field("kind", oi.value("Literal")),
      type: oi.field("type", typeType),
      value: oi.field("value", value)
    }),
    checkRawLiteral
  );

  // Vanaf TS 3.4 kunnen we de as const syntax gebruiken om de array van operators en het type automatisch gelijk te
  // laten lopen. Zie https://stackoverflow.com/questions/44480644/typescript-string-union-to-string-array
  const binaryComparisonOperator: oi.Interpreter<fltr.BinaryComparisonOperator> = oi.enu(
    "equality",
    "inequality",
    "contains",
    "starts",
    "ends",
    "smaller",
    "smallerOrEqual",
    "larger",
    "largerOrEqual",
    "within"
  );

  const unaryComparisonOperator: oi.Interpreter<fltr.UnaryComparisonOperator> = oi.enu("isEmpty", "isNotEmpty");

  const binaryComparison: oi.Interpreter<fltr.BinaryComparison> = oi.suchThat(
    oi.suchThat(
      oi.interpretRecord({
        kind: oi.field("kind", oi.value("BinaryComparison")),
        operator: oi.field("operator", binaryComparisonOperator),
        property: oi.field("property", property),
        value: oi.field("value", literal),
        caseSensitive: oi.field("caseSensitive", oi.bool)
      }),
      fltr.propertyAndValueCompatible,
      `Het type van de property komt niet overeen met dat van de waarde`
    ),
    fltr.operatorPropertyAndValueCompatible,
    "De operator, property en de waarde komen niet overeen"
  );

  const unaryComparison: oi.Interpreter<fltr.UnaryComparison> = oi.interpretRecord({
    kind: oi.field("kind", oi.value("UnaryComparison")),
    operator: oi.field("operator", unaryComparisonOperator),
    property: oi.field("property", property)
  });

  const comparison: oi.Interpreter<fltr.Comparison> = byKind<fltr.Comparison>({
    BinaryComparison: binaryComparison,
    UnaryComparison: unaryComparison
  });

  const conjunctionExpression: oi.Interpreter<fltr.ConjunctionExpression> = oi.mapFailureTo(
    oi.firstOf<fltr.ConjunctionExpression>(conjunction, comparison),
    "We verwachten een 'and' of een vergelijking"
  );

  // Een functie ipv een const omdat het een recursieve definitie betreft en consts strikt na elkaar
  // gedefinieerd moeten zijn.
  function conjunction(json: Object): oi.Validation<fltr.Conjunction> {
    return oi.interpretRecord<fltr.Conjunction>({
      kind: oi.field("kind", oi.value("And")),
      left: oi.field("left", conjunctionExpression),
      right: oi.field("right", comparison)
    })(json);
  }

  const disjunction: oi.Interpreter<fltr.Disjunction> = oi.interpretRecord({
    kind: oi.field("kind", oi.value("Or")),
    left: oi.field("left", expression),
    right: oi.field("right", expression)
  });

  // functie omwille van recursie
  function expression(json: Object): oi.Validation<fltr.Expression> {
    return oi.mapFailure(oi.firstOf<fltr.Expression>(conjunction, disjunction, comparison), fls =>
      array.snoc(fls, "We verwachten een 'and', 'or' of vergelijking")
    )(json);
  }

  const expressionFilter: oi.Interpreter<fltr.ExpressionFilter> = oi.interpretRecord({
    kind: oi.pure("ExpressionFilter" as "ExpressionFilter"), // volgt op byKind
    name: oi.optional(oi.field("name", oi.str)),
    expression: oi.field("expression", expression)
  });

  export const jsonAwv0Definition: oi.Interpreter<fltr.Filter> = byKind<fltr.Filter>({
    ExpressionFilter: expressionFilter,
    EmptyFilter: emptyFilter
  });
}
