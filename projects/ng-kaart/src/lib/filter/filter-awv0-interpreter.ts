import * as array from "fp-ts/lib/Array";

import * as oi from "../stijl/json-object-interpreting";

import { Filter as fltr } from "./filter-model";

export namespace AwvV0FilterInterpreters {
  const byKind: <A>(interpretersByKind: { [k: string]: oi.Interpreter<A> }) => oi.Interpreter<A> = interpretersByKind =>
    oi.byTypeDiscriminator("kind", interpretersByKind);

  const pureFilter: oi.Interpreter<fltr.EmptyFilter> = oi.pure(fltr.EmptyFilter);

  const typeType: oi.Interpreter<fltr.TypeType> = oi.enu<fltr.TypeType>(
    "boolean",
    "string",
    "double",
    "geometry",
    "date",
    "datetime",
    "boolean",
    "json"
  );

  const property: oi.Interpreter<fltr.Property> = oi.interpretRecord({
    kind: oi.field("kind", oi.value("Property")),
    type: oi.field("type", typeType),
    ref: oi.field("ref", oi.str),
    label: oi.field("label", oi.str)
  });

  const literal: oi.Interpreter<fltr.Literal> = oi.interpretRecord({
    kind: oi.field("kind", oi.value("Literal")),
    type: oi.field("type", typeType),
    value: oi.field(
      "value",
      oi.mapFailureTo(oi.firstOf<fltr.ValueType>(oi.bool, oi.num, oi.str), "De waarde moet een bool, number of string zijn")
    )
  });

  const binaryComparisonOperator: oi.Interpreter<fltr.BinaryComparisonOperator> = oi.enu("equality", "inequality");

  const binaryComparison: oi.Interpreter<fltr.BinaryComparison> = oi.suchThat(
    oi.interpretRecord({
      kind: oi.field("kind", oi.value("BinaryComparison")),
      operator: oi.field("operator", binaryComparisonOperator),
      property: oi.field("property", property),
      value: oi.field("value", literal)
    }),
    fltr.propertyAndValueCompatible,
    `Het type van de property komt niet overeen met dat van de waarde`
  );

  const comparison: oi.Interpreter<fltr.Comparison> = byKind<fltr.Comparison>({
    BinaryComparison: binaryComparison
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
    EmptyFilter: pureFilter
  });
}
