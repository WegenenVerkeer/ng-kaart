import { Option, none, some } from "fp-ts/lib/Option";
import * as option from "fp-ts/lib/Option";
import * as array from "fp-ts/lib/Array";
import * as ol from "openlayers";

import { Interpreter, ok, fail, Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";
import { shortcutOrFullStyle } from "./json-awv-v0-stijl";
import { monoidString } from "fp-ts/lib/Monoid";

///////////////////////////////////////////
// De types die alles in goede banen leiden
//

// De exported types zijn ook bruikbaar voor clients zodat de compiler ze kan assisteren met het schrijven van geldige definities.

export interface AWV0StyleFunctionDescription {
  readonly version: "awv-v0";
  readonly definition: RuleConfig;
}

// Een lijst van Rules. De eerste Rule die als waar geëvalueerd wordt, bepaalt de stijl.
export interface RuleConfig {
  readonly rules: Rule[];
}

// Rules worden beschreven adhv expressies die een boolean opleveren en een beschrijving van de stijl.
export interface Rule {
  readonly condition: Expression;
  readonly style: object; // dit zou een verwijzing naar het type van de custom stijl kunnen zijn mochten we dat hebben
}

// Net zoals een RuleConfig, maar het verschil is dat de individuele rules al een OL style hebben ipv een een definitie.
interface RuleStyleConfig {
  readonly rules: RuleStyle[];
}

// Net zoals een Rule, maar met een gegenereerde OL style ipv een definitie.
interface RuleStyle {
  readonly condition: Expression;
  readonly style: ol.style.Style;
}

export type Expression = Literal | EnvironmentExtraction | FeatureExtraction | FunctionEvaluation;

export type TypeType = "boolean" | "string" | "number";

export type ValueType = boolean | string | number;

export interface Literal {
  readonly kind: "Literal";
  readonly value: ValueType;
}

export interface FeatureExtraction {
  readonly kind: "Feature";
  readonly type: TypeType;
  readonly ref: string;
}

export interface EnvironmentExtraction {
  readonly kind: "Environment";
  readonly type: TypeType;
  readonly ref: string;
}

export type FunctionEvaluation = Exists | Comparison | Combination | Negation | Between;

export interface Exists {
  readonly kind: "FeatureExists" | "EnvironmentExists";
  readonly ref: string;
}

export type ComparisonOperator = "<" | ">" | "<=" | ">=" | "==" | "!=";

export interface Comparison {
  readonly kind: ComparisonOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export interface Combination {
  readonly kind: "&&" | "||";
  readonly left: Expression;
  readonly right: Expression;
}

export interface Negation {
  readonly kind: "!";
  readonly expression: Expression;
}

export interface Between {
  readonly kind: "<=>";
  readonly value: Expression;
  readonly lower: Expression;
  readonly upper: Expression;
}

//////////////////////
// Record constructors
//

const RuleStyleConfig = (rules: RuleStyle[]) => ({ rules: rules });
const RuleStyle = (condition: Expression, style: ol.style.Style) => ({
  condition: condition,
  style: style
});
const Literal = (value: ValueType) => ({ kind: "Literal", value: value } as Literal);
const FeatureExtraction = (typeName: TypeType, ref: string) =>
  ({
    kind: "Feature",
    type: typeName,
    ref: ref
  } as FeatureExtraction);
const EnvironmentExtraction = (typeName: TypeType, ref: string) =>
  ({
    kind: "Environment",
    type: typeName,
    ref: ref
  } as EnvironmentExtraction);
const Exists = (kind: "FeatureExists" | "EnvironmentExists") => (ref: String) =>
  ({
    kind: kind,
    ref: ref
  } as Exists);
const Comparison = (kind: ComparisonOperator) => (left: Expression, right: Expression) =>
  ({
    kind: kind,
    left: left,
    right: right
  } as Comparison);
const Combination = (kind: "&&" | "||") => (left: Expression, right: Expression) =>
  ({
    kind: kind,
    left: left,
    right: right
  } as Combination);
const Negation = (expression: Expression) => ({
  kind: "!",
  expression: expression
});
const Between = (value: Expression, lower: Expression, upper: Expression) => ({
  kind: "<=>",
  value: value,
  lower: lower,
  upper: upper
});

/////////////////////////////////////////////////////////////////
// Typechecking en compilatie van de regels tot een StyleFunction
//

function compileRules(ruleCfg: RuleStyleConfig): Validation<ol.StyleFunction> {
  // Een abstractie van het tuple (feature, resolution). Laat toe om de functies hierna wat compacter te schrijven, minder gegevens op de
  // stack te moeten zetten en eventueel eenvoudig andere "environment"-variabelen toe te voegen.
  interface Context {
    feature: ol.Feature;
    resolution: number;
  }

  // Evaluator is een functie die at runtime aangeroepen wordt en de context omzet in misschien een waarde.
  // De Option is nodig omdat properties in een feature niet noodzakelijk aanwezig zijn (met het correcte type).
  type Evaluator = (ctx: Context) => Option<ValueType>;

  // Tijdens de compilatiefase hebben we het resultaattype van de toekomstige evaluatie nodig zodat we kunnen garanderen dat we enkel
  // operaties samenstellen die type-compatibel zijn.
  interface TypedEvaluator {
    evaluator: Evaluator;
    typeName: TypeType;
  }

  // Om de foutboodschappen tijdens het compileren door te geven wordt alles ingepakt in een Validation.
  type ValidatedTypedEvaluator = Validation<TypedEvaluator>;

  // Een constructor voor een TypedEvaluator.
  const TypedEvaluator = <V extends ValueType>(evaluator: Evaluator, typeName: TypeType) =>
    ({ evaluator: evaluator, typeName: typeName } as TypedEvaluator);

  // Run-time helpers
  const getFeat = (key: string, typeName: TypeType) => (ctx: Context) =>
    option
      .fromNullable(ctx.feature.get("properties"))
      .chain(properties => option.fromNullable(properties[key]))
      .filter(value => typeof value === typeName);
  const checkFeatureDefined = (key: string) => (ctx: Context) =>
    option.fromNullable(ctx.feature.get("properties")).map(properties => properties.hasOwnProperty(key));
  const getResolution = (ctx: Context) => some(ctx.resolution);

  // Type check functies
  const typeIs = (targetType: TypeType) => (t1: TypeType) =>
    t1 === targetType ? ok({}) : fail(`typecontrole: '${t1}' gevonden, maar '${targetType}' verwacht`);
  const allTypes2 = (targetType: TypeType) => (t1: TypeType, t2: TypeType) =>
    t1 === targetType && t2 === targetType
      ? ok({})
      : fail(`typecontrole: '${t1}' en '${t2}' gevonden, maar telkens '${targetType}' verwacht`);
  const allTypes3 = (targetType: TypeType) => (t1: TypeType, t2: TypeType, t3: TypeType) =>
    t1 === targetType && t2 === targetType && t3 === targetType
      ? ok({})
      : fail(`typecontrole: '${t1}', '${t2}' en '${t3}' gevonden, maar telkens '${targetType}' verwacht`);
  const equalType = (t1: TypeType, t2: TypeType) =>
    t1 === t2 ? ok({}) : fail(`typecontrole: verwacht dat '${t1}' en '${t2}' gelijk zijn`);

  // De expressie op het hoogste niveau moet tot een boolean evalueren
  function compileCondition(expression: Expression): ValidatedTypedEvaluator {
    return compile(expression).chain(
      evaluator => (evaluator.typeName === "boolean" ? ok(evaluator) : fail(`typecontrole: een conditie moet een 'boolean' opleveren`))
    );
  }

  // Het hart van de compiler
  function compile(expression: Expression): ValidatedTypedEvaluator {
    switch (expression.kind) {
      case "&&":
        return leftRight((a, b) => a && b, allTypes2("boolean"), "boolean", expression);
      case "||":
        return leftRight((a, b) => a || b, allTypes2("boolean"), "boolean", expression);
      case "!":
        return apply1(a => !a, typeIs("boolean"), "boolean", compile(expression.expression));
      case "==":
        return leftRight((a, b) => a === b, equalType, "boolean", expression);
      case "!=":
        return leftRight((a, b) => a !== b, equalType, "boolean", expression);
      case "<":
        return leftRight((a, b) => a < b, allTypes2("number"), "boolean", expression);
      case "<=":
        return leftRight((a, b) => a <= b, allTypes2("number"), "boolean", expression);
      case ">":
        return leftRight((a, b) => a > b, allTypes2("number"), "boolean", expression);
      case ">=":
        return leftRight((a, b) => a >= b, allTypes2("number"), "boolean", expression);
      case "FeatureExists":
        return ok(TypedEvaluator(checkFeatureDefined(expression.ref), "boolean"));
      case "EnvironmentExists": {
        const envIsResolution = some(expression.ref === "resolution"); // berekenen at compile time!
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
            () => some(expression.value),
            typeof expression.value as TypeType // Het type van ValueType is TypeType bij constructie
          )
        );
      case "Feature":
        return ok(TypedEvaluator(getFeat(expression.ref, expression.type), expression.type));
      case "Environment":
        return expression.ref === "resolution" && expression.type === "number"
          ? ok(TypedEvaluator(getResolution, "number"))
          : fail(`Enkel 'resolution' en type 'number' wordt ondersteund, maar '${expression.ref} en '${expression.type}' zijn gevonden`);
    }
  }

  // Hulpfunctie voor minder codeduplicatie
  function leftRight(
    f: (a1: ValueType, a2: ValueType) => ValueType,
    check: (t1: TypeType, t2: TypeType) => Validation<{}>,
    resultType: TypeType,
    expression: Comparison | Combination
  ) {
    return apply2(f, check, resultType, compile(expression.left), compile(expression.right));
  }

  // Type checking en aaneenrijgen van de lagere boomknopen in een run-time functie
  function apply1(
    f: (a1: ValueType) => ValueType,
    check: (t1: TypeType) => Validation<{}>,
    resultType: TypeType,
    validation1: ValidatedTypedEvaluator
  ): ValidatedTypedEvaluator {
    return validation1.chain(val1 => check(val1.typeName).map(() => TypedEvaluator(liftEvaluator1(f)(val1.evaluator), resultType)));
  }

  function apply2(
    f: (a1: ValueType, a2: ValueType) => ValueType,
    check: (t1: TypeType, t2: TypeType) => Validation<{}>,
    resultType: TypeType,
    validation1: ValidatedTypedEvaluator,
    validation2: ValidatedTypedEvaluator
  ): ValidatedTypedEvaluator {
    return validation1.chain(val1 =>
      validation2.chain(val2 =>
        check(val1.typeName, val2.typeName).map(() => TypedEvaluator(liftEvaluator2(f)(val1.evaluator, val2.evaluator), resultType))
      )
    );
  }

  function apply3(
    f: (a1: ValueType, a2: ValueType, a3: ValueType) => ValueType,
    check: (t1: TypeType, t2: TypeType, t3: TypeType) => Validation<{}>,
    resultType: TypeType,
    validation1: ValidatedTypedEvaluator,
    validation2: ValidatedTypedEvaluator,
    validation3: ValidatedTypedEvaluator
  ): ValidatedTypedEvaluator {
    return validation1.chain(val1 =>
      validation2.chain(val2 =>
        validation3.chain(val3 =>
          check(val1.typeName, val2.typeName, val3.typeName).map(() =>
            TypedEvaluator(liftEvaluator3(f)(val1.evaluator, val2.evaluator, val3.evaluator), resultType)
          )
        )
      )
    );
  }

  // "platte" functies omzetten tot Evaluator functies.
  function liftEvaluator1(f: (v1: ValueType) => ValueType): (ev1: Evaluator) => Evaluator {
    return (ev1: Evaluator) => (ctx: Context) => ev1(ctx).map(r1 => f(r1));
  }

  function liftEvaluator2(f: (v1: ValueType, v2: ValueType) => ValueType): (ev1: Evaluator, ev2: Evaluator) => Evaluator {
    return (ev1: Evaluator, ev2: Evaluator) => (ctx: Context) => ev1(ctx).chain(r1 => ev2(ctx).map(r2 => f(r1, r2)));
  }

  function liftEvaluator3(
    f: (v1: ValueType, v2: ValueType, v3: ValueType) => ValueType
  ): (ev1: Evaluator, ev2: Evaluator, ev3: Evaluator) => Evaluator {
    return (ev1: Evaluator, ev2: Evaluator, ev3: Evaluator) => (ctx: Context) =>
      ev1(ctx).chain(r1 => ev2(ctx).chain(r2 => ev3(ctx).map(r3 => f(r1, r2, r3))));
  }

  type RuleExpression = (ctx: Context) => Option<ol.style.Style>;

  // De regels controleren en combineren zodat at run-time ze één voor één geprobeerd worden totdat er een match is
  const validatedCombinedRuleExpression: Validation<RuleExpression> = array.reduce(
    (combinedRuleValidation: Validation<RuleExpression>, rule: RuleStyle) =>
      // Hang een regel bij de vorige regels
      combinedRuleValidation.chain(combinedRule =>
        // De conditie moet kosjer zijn
        compileCondition(rule.condition).map(typedEvaluator => (ctx: Context) =>
          combinedRule(ctx).fold(
            () => typedEvaluator.evaluator(ctx).chain(outcome => ((outcome as boolean) ? some(rule.style) : none)),
            stl => some(stl) // (orElse ontbreekt) De verse regel wordt niet meer uitgevoerd als er al een resultaat is.
          )
        )
      ),
    ok(() => none),
    ruleCfg.rules
  );

  return validatedCombinedRuleExpression.map(
    (ruleExpression: RuleExpression) => (feature: ol.Feature, resolution: number) =>
      ruleExpression({ feature: feature, resolution: resolution }).getOrElseValue(undefined) // openlayers kan undefined wel smaken
  );
}

///////////////////////////////////////////////////
// De externe input valideren als een StyleFunction
//

// type StyleFunction = (feature: (ol.Feature | ol.render.Feature), resolution: number) => (ol.style.Style | ol.style.Style[]);
export function definitieToStyleFunction(encoding: string, definitieText: string): Validation<ol.StyleFunction> {
  if (encoding === "json") {
    return jsonDefinitieStringToRuleExecutor(definitieText);
  } else {
    return oi.fail(`Formaat '${encoding}' wordt niet ondersteund`);
  }
}

function jsonDefinitieStringToRuleExecutor(definitieText: string): Validation<ol.StyleFunction> {
  try {
    const unvalidatedJson = JSON.parse(definitieText);
    return compileRuleJson(unvalidatedJson);
  } catch (error) {
    return oi.fail("De gegeven definitie was geen geldige JSON");
  }
}

function compileRuleJson(definitie: Object): Validation<ol.StyleFunction> {
  return oi
    .field("version", oi.str)(definitie)
    .chain(version => {
      switch (version) {
        case "awv-v0":
          return oi.field("definition", jsonAwvV0RuleCompiler)(definitie);
        default:
          return oi.fail(`Versie '${version}' wordt niet ondersteund`);
      }
    });
}

//////////////////////////////////////////////
// Valideer de regels en controleer de stijlen
//

const jsonAwvV0RuleConfig: Interpreter<RuleStyleConfig> = (json: Object) => {
  const typeType: Interpreter<TypeType> = (o: string) =>
    o === "boolean" || o === "string" || o === "number" ? ok(o as TypeType) : fail(`Het type moet 'boolean' of 'string' of 'number' zijn`);
  const literal: Interpreter<Expression> = oi.map(Literal, oi.field("value", oi.firstOf<ValueType>(oi.str, oi.bool, oi.num)));
  const environment: Interpreter<Expression> = oi.map2(EnvironmentExtraction, oi.field("type", typeType), oi.field("ref", oi.str));
  const feature: Interpreter<Expression> = oi.map2(FeatureExtraction, oi.field("type", typeType), oi.field("ref", oi.str));
  const featureExists: Interpreter<Expression> = oi.map(Exists("FeatureExists"), oi.field("ref", oi.str));
  const environmentExists: Interpreter<Expression> = oi.map(Exists("EnvironmentExists"), oi.field("ref", oi.str));
  const comparison: (kind: ComparisonOperator) => Interpreter<Expression> = (kind: ComparisonOperator) =>
    oi.map2(Comparison(kind), oi.field("left", o => expression(o)), oi.field("right", o => expression(o)));
  const combination = (kind: "&&" | "||") =>
    oi.map2(Combination(kind), oi.field("left", o => expression(o)), oi.field("right", o => expression(o)));
  const negation = oi.map(Negation, oi.field("expression", o => expression(o)));
  const between = oi.map3(
    Between,
    oi.field("value", o => expression(o)),
    oi.field("lower", o => expression(o)),
    oi.field("upper", o => expression(o))
  );
  const expression = oi.byTypeDiscriminator("kind", {
    Literal: literal,
    Feature: feature,
    Environment: environment,
    FeatureExists: featureExists,
    EnvironmentExists: environmentExists,
    "<": comparison("<"),
    "<=": comparison("<="),
    ">": comparison(">"),
    ">=": comparison(">="),
    "==": comparison("=="),
    "!=": comparison("!="),
    "&&": combination("&&"),
    "||": combination("||"),
    "!": negation,
    "<=>": between
  });

  const rule = oi.map2(RuleStyle, oi.field("condition", expression), oi.field("style", shortcutOrFullStyle));

  const ruleConfig = oi.map(RuleStyleConfig, oi.arr(rule));

  return oi
    .field("rules", ruleConfig)(json)
    .mapFailure(monoidString)(msg => `syntaxcontrole: ${msg}`);
};

const jsonAwvV0RuleCompiler: Interpreter<ol.StyleFunction> = (json: Object) => jsonAwvV0RuleConfig(json).chain(compileRules);
