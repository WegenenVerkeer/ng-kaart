import { array, either, option } from "fp-ts";
import { flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/function";

import * as ol from "../util/openlayers-compat";
import {
  composeValidators2,
  validationChain as chain,
  Validator,
} from "../util/validation";

import {
  AwvV0StaticStyleInterpreters,
  StaticStyleEncoders,
} from "./json-awv-v0-stijl";
import * as oi from "./json-object-interpreting";
import { fail, Interpreter, ok, Validation } from "./json-object-interpreting";
import {
  AwvV0DynamicStyle,
  Between,
  Combination,
  Comparison,
  ComparisonOperator,
  EnvironmentExtraction,
  Exists,
  Expression,
  Literal,
  Negation,
  PropertyExtraction,
  Rule,
  RuleConfig,
  TypeType,
  ValueType,
} from "./stijl-function-types";

/// /////////////
// Private types
//

// Handige alias om de volgende definities wat beknopter te houden
type olStyle = ol.style.Style;

// Net zoals een RuleConfig, maar het verschil is dat de individuele rules al een OL style hebben ipv een een definitie.
interface RuleStyleConfig {
  readonly rules: RuleStyle[];
}

// Net zoals een Rule, maar met een gegenereerde OL style ipv een definitie.
interface RuleStyle {
  readonly condition: Expression;
  readonly style: olStyle;
}

const RuleStyleConfig: (arg: RuleStyle[]) => RuleStyleConfig = (rules) => ({
  rules: rules,
});
const alwaysTrue: Expression = { kind: "Literal", value: true };
const RuleStyle: (
  maybeCondition: option.Option<Expression>,
  style: olStyle
) => RuleStyle = (maybeCondition, style) => ({
  condition: pipe(
    maybeCondition,
    option.getOrElse(() => alwaysTrue)
  ),
  style: style,
});

/// ///////////////////////////////////////////
// Valideer de regels en controleer de stijlen
//

export const jsonAwvV0RuleInterpreter: Interpreter<AwvV0DynamicStyle> = (
  json: Object
) => {
  const typeType: Interpreter<TypeType> = (o: string) =>
    o === "boolean" || o === "string" || o === "number"
      ? ok(o as TypeType)
      : fail(`Het type moet 'boolean' of 'string' of 'number' zijn`);
  const literal: Interpreter<Expression> = oi.map(
    Literal,
    oi.field("value", oi.firstOf<ValueType>(oi.bool, oi.num, oi.str))
  );
  const environment: Interpreter<Expression> = oi.map2(
    EnvironmentExtraction,
    oi.field("type", typeType),
    oi.field("ref", oi.str)
  );
  const property: Interpreter<Expression> = oi.map2(
    PropertyExtraction,
    oi.field("type", typeType),
    oi.field("ref", oi.str)
  );
  const propertyExists: Interpreter<Expression> = oi.map(
    Exists("PropertyExists"),
    oi.field("ref", oi.str)
  );
  const environmentExists: Interpreter<Expression> = oi.map(
    Exists("EnvironmentExists"),
    oi.field("ref", oi.str)
  );
  const comparison: (kind: ComparisonOperator) => Interpreter<Expression> = (
    kind: ComparisonOperator
  ) =>
    oi.map2(
      Comparison(kind),
      oi.field("left", (o) => expression(o)),
      oi.field("right", (o) => expression(o))
    );
  const combination = (kind: "&&" | "||") =>
    oi.map2(
      Combination(kind),
      oi.field("left", (o) => expression(o)),
      oi.field("right", (o) => expression(o))
    );
  const negation = oi.map(
    Negation,
    oi.field("expression", (o) => expression(o))
  );
  const between = oi.map3(
    Between,
    oi.field("value", (o) => expression(o)),
    oi.field("lower", (o) => expression(o)),
    oi.field("upper", (o) => expression(o))
  );
  const expression = oi.byTypeDiscriminator("kind", {
    Literal: literal,
    Property: property,
    Environment: environment,
    PropertyExists: propertyExists,
    EnvironmentExists: environmentExists,
    "<": comparison("<"),
    "<=": comparison("<="),
    ">": comparison(">"),
    ">=": comparison(">="),
    "==": comparison("=="),
    "!=": comparison("!="),
    "L==": comparison("L=="),
    CONTAINS: comparison("CONTAINS"),
    "!CONTAINS": comparison("!CONTAINS"),
    "&&": combination("&&"),
    "||": combination("||"),
    "!": negation,
    "<=>": between,
  });

  const rule: Interpreter<Rule> = oi.map2(
    Rule,
    oi.map(
      (maybeCondition) =>
        pipe(
          maybeCondition,
          option.getOrElse(() => alwaysTrue)
        ),
      oi.optField<Expression>("condition", expression)
    ),
    oi.field(
      "style",
      oi.field("definition", AwvV0StaticStyleInterpreters.jsonAwvV0Definition)
    )
  );

  const ruleConfig: Interpreter<RuleConfig> = oi.map(RuleConfig, oi.arr(rule));

  return pipe(
    oi.field("rules", ruleConfig)(json),
    either.mapLeft((msg) => [`syntaxcontrole: ${msg}`])
  );
};

const jsonAwvV0RuleConfig: (arg: AwvV0DynamicStyle) => RuleStyleConfig = (
  style
) => ({
  rules: style.rules.map((rule) => ({
    condition: rule.condition,
    style: StaticStyleEncoders.awvV0Style.encode(rule.style.definition),
  })),
});

export const jsonAwvV0RuleCompiler: Validator<
  AwvV0DynamicStyle,
  ol.style.StyleFunction
> = flow(jsonAwvV0RuleConfig, compileRules);

/// //////////////////////////////////////////////////////////////
// Typechecking en compilatie van de regels tot een StyleFunction
//

function compileRules(
  ruleCfg: RuleStyleConfig
): Validation<ol.style.StyleFunction> {
  // Een abstractie van het tuple (feature, resolution). Laat toe om de functies hierna wat compacter te schrijven, minder gegevens op de
  // stack te moeten zetten en eventueel eenvoudig andere "environment"-variabelen toe te voegen.
  interface Context {
    feature: ol.Feature;
    resolution: number;
  }

  // Evaluator is een functie die at runtime aangeroepen wordt en de context omzet in misschien een waarde.
  // De option.Option is nodig omdat properties in een feature niet noodzakelijk aanwezig zijn (met het correcte type).
  type Evaluator = (ctx: Context) => option.Option<ValueType>;

  // Tijdens de compilatiefase hebben we het resultaattype van de toekomstige evaluatie nodig zodat we kunnen garanderen dat we enkel
  // operaties samenstellen die type-compatibel zijn.
  interface TypedEvaluator {
    evaluator: Evaluator;
    typeName: TypeType;
  }

  // Om de foutboodschappen tijdens het compileren door te geven wordt alles ingepakt in een Validation.
  type ValidatedTypedEvaluator = Validation<TypedEvaluator>;

  // Een constructor voor een TypedEvaluator.
  const TypedEvaluator = <V extends ValueType>(
    evaluator: Evaluator,
    typeName: TypeType
  ) => ({ evaluator: evaluator, typeName: typeName } as TypedEvaluator);

  // Run-time helpers
  const isDefined = (value) => value !== undefined && value !== null;
  const getNestedProperty = (propertyKey: string, object: Object) => {
    return isDefined(propertyKey)
      ? propertyKey
          .split(".")
          .reduce(
            (obj, key) =>
              isDefined(obj) && isDefined(obj[key]) ? obj[key] : null,
            object
          )
      : null;
  };
  const getProperty = (key: string, typeName: TypeType) => (
    ctx: Context
  ): option.Option<any> =>
    pipe(
      option.fromNullable(ctx.feature.get("properties")),
      option.chain((properties) =>
        option.fromNullable(getNestedProperty(key, properties))
      ),
      // TODO: beter een apart array type definieren en overal gebruiken in geval van array.
      option.filter(
        (value) => typeof value === typeName || Array.isArray(value)
      )
    );
  const checkFeatureDefined = (key: string) => (ctx: Context) =>
    pipe(
      option.fromNullable(ctx.feature.get("properties")),
      option.map((properties) => properties.hasOwnProperty(key))
    );
  const getResolution = (ctx: Context) => option.some(ctx.resolution);

  // Type check functies
  const typeIs = (targetType: TypeType) => (t1: TypeType) =>
    t1 === targetType
      ? ok({} as any)
      : fail(`typecontrole: '${t1}' gevonden, maar '${targetType}' verwacht`);
  const allTypes2 = (targetType: TypeType) => (t1: TypeType, t2: TypeType) =>
    t1 === targetType && t2 === targetType
      ? ok({})
      : fail(
          `typecontrole: '${t1}' en '${t2}' gevonden, maar telkens '${targetType}' verwacht`
        );
  const allTypes3 = (targetType: TypeType) => (
    t1: TypeType,
    t2: TypeType,
    t3: TypeType
  ) =>
    t1 === targetType && t2 === targetType && t3 === targetType
      ? ok({})
      : fail(
          `typecontrole: '${t1}', '${t2}' en '${t3}' gevonden, maar telkens '${targetType}' verwacht`
        );
  const equalType = (t1: TypeType, t2: TypeType) =>
    t1 === t2
      ? ok({})
      : fail(`typecontrole: verwacht dat '${t1}' en '${t2}' gelijk zijn`);
  const conditionIsBoolean = (evaluator: TypedEvaluator) =>
    evaluator.typeName === "boolean"
      ? ok(evaluator)
      : fail<TypedEvaluator>(
          `typecontrole: een conditie moet een 'boolean' opleveren`
        );

  // De expressie op het hoogste niveau moet tot een boolean evalueren
  const compileCondition: (
    _: Expression
  ) => ValidatedTypedEvaluator = composeValidators2(
    compile,
    conditionIsBoolean
  );

  // Het hart van de compiler
  function compile(expression: Expression): ValidatedTypedEvaluator {
    switch (expression.kind) {
      case "&&":
        return leftRight(
          (a, b) => a && b,
          allTypes2("boolean"),
          "boolean",
          expression
        );
      case "||":
        return leftRight(
          (a, b) => a || b,
          allTypes2("boolean"),
          "boolean",
          expression
        );
      case "!":
        return apply1(
          (a) => !a,
          typeIs("boolean"),
          "boolean",
          compile(expression.expression)
        );
      case "==":
        return leftRight((a, b) => a === b, equalType, "boolean", expression);
      case "!=":
        return leftRight((a, b) => a !== b, equalType, "boolean", expression);
      case "<":
        return leftRight(
          (a, b) => a < b,
          allTypes2("number"),
          "boolean",
          expression
        );
      case "<=":
        return leftRight(
          (a, b) => a <= b,
          allTypes2("number"),
          "boolean",
          expression
        );
      case ">":
        return leftRight(
          (a, b) => a > b,
          allTypes2("number"),
          "boolean",
          expression
        );
      case ">=":
        return leftRight(
          (a, b) => a >= b,
          allTypes2("number"),
          "boolean",
          expression
        );
      case "L==":
        return leftRight(
          (a: string, b: string) => a.toLowerCase() === b,
          allTypes2("string"),
          "boolean",
          expression
        );
      case "CONTAINS":
        return leftRight(
          (a: string[], b: string) => a.includes(b),
          allTypes2("string"),
          "boolean",
          expression
        );
      case "!CONTAINS":
        return leftRight(
          (a: string[], b: string) => !a.includes(b),
          allTypes2("string"),
          "boolean",
          expression
        );
      case "PropertyExists":
        return ok(
          TypedEvaluator(checkFeatureDefined(expression.ref), "boolean")
        );
      case "EnvironmentExists": {
        const envIsResolution = option.some(expression.ref === "resolution"); // berekenen at compile time!
        return ok(TypedEvaluator(() => envIsResolution, "boolean"));
      }
      case "<=>":
        return apply3(
          (v, l, u) => v >= l && v <= u,
          allTypes3("number"),
          "boolean",
          compile(expression.value),
          compile(expression.lower),
          compile(expression.upper)
        );
      case "Literal":
        return ok(
          TypedEvaluator(
            () => option.some(expression.value),
            typeof expression.value as TypeType // Het type van ValueType is TypeType bij constructie
          )
        );
      case "Property":
        return ok(
          TypedEvaluator(
            getProperty(expression.ref, expression.type),
            expression.type
          )
        );
      case "Environment":
        return expression.ref === "resolution" && expression.type === "number"
          ? ok(TypedEvaluator(getResolution, "number"))
          : fail(
              `Enkel 'resolution' en type 'number' wordt ondersteund, maar '${expression.ref} en '${expression.type}' zijn gevonden`
            );
    }
  }

  // Hulpfunctie voor minder codeduplicatie
  function leftRight(
    f: (a1: ValueType, a2: ValueType) => ValueType,
    check: (t1: TypeType, t2: TypeType) => Validation<unknown>,
    resultType: TypeType,
    expression: Comparison | Combination
  ) {
    return apply2(
      f,
      check,
      resultType,
      compile(expression.left),
      compile(expression.right)
    );
  }

  // Type checking en aaneenrijgen van de lagere boomknopen in een run-time functie
  function apply1(
    f: (a1: ValueType) => ValueType,
    check: (t1: TypeType) => Validation<unknown>,
    resultType: TypeType,
    validation1: ValidatedTypedEvaluator
  ): ValidatedTypedEvaluator {
    return chain(validation1, (val1) =>
      pipe(
        check(val1.typeName),
        either.map(() =>
          TypedEvaluator(liftEvaluator1(f)(val1.evaluator), resultType)
        )
      )
    );
  }

  function apply2(
    f: (a1: ValueType, a2: ValueType) => ValueType,
    check: (t1: TypeType, t2: TypeType) => Validation<unknown>,
    resultType: TypeType,
    validation1: ValidatedTypedEvaluator,
    validation2: ValidatedTypedEvaluator
  ): ValidatedTypedEvaluator {
    return chain(validation1, (val1) =>
      chain(validation2, (val2) =>
        pipe(
          check(val1.typeName, val2.typeName),
          either.map(() =>
            TypedEvaluator(
              liftEvaluator2(f)(val1.evaluator, val2.evaluator),
              resultType
            )
          )
        )
      )
    );
  }

  function apply3(
    f: (a1: ValueType, a2: ValueType, a3: ValueType) => ValueType,
    check: (t1: TypeType, t2: TypeType, t3: TypeType) => Validation<unknown>,
    resultType: TypeType,
    validation1: ValidatedTypedEvaluator,
    validation2: ValidatedTypedEvaluator,
    validation3: ValidatedTypedEvaluator
  ): ValidatedTypedEvaluator {
    return chain(validation1, (val1) =>
      chain(validation2, (val2) =>
        chain(validation3, (val3) =>
          pipe(
            check(val1.typeName, val2.typeName, val3.typeName),
            either.map(() =>
              TypedEvaluator(
                liftEvaluator3(f)(
                  val1.evaluator,
                  val2.evaluator,
                  val3.evaluator
                ),
                resultType
              )
            )
          )
        )
      )
    );
  }

  // "platte" functies omzetten tot Evaluator functies.
  function liftEvaluator1(
    f: (v1: ValueType) => ValueType
  ): (ev1: Evaluator) => Evaluator {
    return (ev1: Evaluator) => (ctx: Context) =>
      pipe(
        ev1(ctx),
        option.map((r1) => f(r1))
      );
  }

  function liftEvaluator2(
    f: (v1: ValueType, v2: ValueType) => ValueType
  ): (ev1: Evaluator, ev2: Evaluator) => Evaluator {
    return (ev1: Evaluator, ev2: Evaluator) => (ctx: Context) =>
      pipe(
        ev1(ctx),
        option.chain((r1) =>
          pipe(
            ev2(ctx),
            option.map((r2) => f(r1, r2))
          )
        )
      );
  }

  function liftEvaluator3(
    f: (v1: ValueType, v2: ValueType, v3: ValueType) => ValueType
  ): (ev1: Evaluator, ev2: Evaluator, ev3: Evaluator) => Evaluator {
    return (ev1: Evaluator, ev2: Evaluator, ev3: Evaluator) => (ctx: Context) =>
      pipe(
        ev1(ctx),
        option.chain((r1) =>
          pipe(
            ev2(ctx),
            option.chain((r2) =>
              pipe(
                ev3(ctx),
                option.map((r3) => f(r1, r2, r3))
              )
            )
          )
        )
      );
  }

  type RuleExpression = (arg: Context) => option.Option<ol.style.Style>;

  // De regels controleren en combineren zodat at run-time ze één voor één geprobeerd worden totdat er een match is
  const validatedCombinedRuleExpression: Validation<RuleExpression> = pipe(
    ruleCfg.rules,
    array.reduce(
      ok(() => option.none),
      (combinedRuleValidation: Validation<RuleExpression>, rule: RuleStyle) => {
        // Hang een regel bij de vorige regels
        return chain(combinedRuleValidation, (combinedRule) => {
          // WTF? Deze lambda moet blijkbaar in een {} block zitten of het faalt wanneer gebruikt in externe applicatie.
          // De conditie moet kosjer zijn
          return pipe(
            compileCondition(rule.condition),
            either.map((typedEvaluator) => (ctx: Context) =>
              pipe(
                combinedRule(ctx),
                option.alt(() =>
                  pipe(
                    typedEvaluator.evaluator(ctx),
                    option.chain((outcome) =>
                      (outcome as boolean)
                        ? option.some(rule.style)
                        : option.none
                    )
                  )
                )
              )
            )
          );
        });
      }
    )
  );

  const styleFunctionFromRuleExpression: (
    arg: RuleExpression
  ) => ol.style.StyleFunction = (ruleExpression) => (
    feature: ol.Feature,
    resolution: number
  ) =>
    pipe(
      ruleExpression({ feature: feature, resolution: resolution }),
      option.getOrElse(() => (undefined as any) as ol.style.Style)
    );

  return pipe(
    validatedCombinedRuleExpression,
    either.map(styleFunctionFromRuleExpression)
  );
}
