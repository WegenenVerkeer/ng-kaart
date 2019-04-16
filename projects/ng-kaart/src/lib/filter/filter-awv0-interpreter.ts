import { constant } from "fp-ts/lib/function";

import * as oi from "../stijl/json-object-interpreting";

import {
  BaseExpression,
  Comparison,
  Conjunction,
  Disjunction,
  Equality,
  Expression,
  ExpressionFilter,
  Filter,
  Inequality,
  Literal,
  Property,
  propertyAndValueCompatible,
  PropertyValueOperator,
  PureFilter,
  TypeType,
  ValueType
} from "./filter-new-model";

export namespace AwvV0FilterInterpreters {
  const byKind: <A>(interpretersByKind: { [k: string]: oi.Interpreter<A> }) => oi.Interpreter<A> = interpretersByKind =>
    oi.byTypeDiscriminator("kind", interpretersByKind);

  const pureFilter: oi.Interpreter<PureFilter> = oi.pure(PureFilter);

  const typeType: oi.Interpreter<TypeType> = oi.enu<TypeType>(
    "boolean",
    "string",
    "double",
    "geometry",
    "date",
    "datetime",
    "boolean",
    "json"
  );

  const property: oi.Interpreter<Property> = oi.interpretRecord({
    kind: oi.field("kind", oi.value("Property")),
    type: oi.field("type", typeType),
    ref: oi.field("ref", oi.str)
  });

  const literal: oi.Interpreter<Literal> = oi.interpretRecord({
    kind: oi.field("kind", oi.value("Literal")),
    type: oi.field("type", typeType),
    value: oi.field("value", oi.firstOf<ValueType>(oi.bool, oi.num, oi.str))
  });

  const propertyValueOperator: oi.Interpreter<PropertyValueOperator> = oi.suchThat(
    oi.interpretRecord<PropertyValueOperator>({
      property: oi.field("property", property),
      value: oi.field("literal", literal)
    }),
    propertyAndValueCompatible,
    `Het type van de property komt niet overeen met dat van de waarde`
  );

  const equality: oi.Interpreter<Equality> = oi.map(pvo => ({ kind: "Equality", ...pvo }), propertyValueOperator);
  const inequality: oi.Interpreter<Inequality> = oi.map(pvo => ({ kind: "Inequality", ...pvo }), propertyValueOperator);

  const comparison: oi.Interpreter<Comparison> = byKind<Comparison>({
    Equality: equality,
    Inequality: inequality
  });

  const baseExpression: oi.Interpreter<BaseExpression> = oi.firstOf<BaseExpression>(conjunction, comparison);

  // Een functie ipv een const omdat het een recursieve definitie betreft en consts strikt na elkaar
  // gedefinieerd moeten zijn.
  function conjunction(json: Object): oi.Validation<Conjunction> {
    return oi.interpretRecord<Conjunction>({
      kind: oi.field("kind", oi.value("And")),
      left: oi.field("left", baseExpression),
      right: oi.field("right", comparison)
    })(json);
  }

  const disjunction: oi.Interpreter<Disjunction> = oi.interpretRecord({
    kind: oi.field("kind", oi.value("Or")),
    left: oi.field("left", baseExpression),
    right: oi.field("right", baseExpression)
  });

  const expression: oi.Interpreter<Expression> = oi.firstOf<Expression>(conjunction, disjunction, comparison);

  const expressionFilter: oi.Interpreter<ExpressionFilter> = oi.interpretRecord({
    kind: oi.pure("ExpressionFilter"),
    name: oi.field("name", oi.str),
    expression: oi.field("expression", expression)
  });

  export const jsonAwv0Definition: oi.Interpreter<Filter> = byKind<Filter>({
    ExpressionFilter: expressionFilter,
    PureFilter: pureFilter
  });
}
