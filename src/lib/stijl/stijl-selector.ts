import { Option, none, some } from "fp-ts/lib/Option";
import * as option from "fp-ts/lib/Option";
import * as array from "fp-ts/lib/Array";
import * as ol from "openlayers";

import { Interpreter, ok, fail, Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";
import { interpretJson as interpretStyleJson } from "./stijl-interpreter";

///////////////////////////////////////////
// De types die alles in goede banen leiden
//

// Een lijst van Rules. De eerste Rule die als waar geëvalueerd wordt, bepaalt de stijl.
export interface RuleConfig {
  rules: Rule[];
}

// Rules worden beschreven adhv expressies die een boolean opleven en een beschrijving van de stijl.
export interface Rule {
  condition: Expression;
  style: object;
}

// Net zoals een RuleConfig, maar het verschil is dat de individuele rules al een OL style hebben ipv een een definitie.
interface RuleStyleConfig {
  rules: RuleStyle[];
}

// Net zoals een Rule, maar met een gegenereerde OL style ipv een definitie.
interface RuleStyle {
  condition: Expression;
  style: ol.style.Style;
}

export type Expression = Constant | EnvironmentExtraction | FeatureExtraction | FunctionEvaluation;

export type TypeType = "boolean" | "string" | "number";

export type ValueType = boolean | string | number;

export interface Constant {
  kind: "Constant";
  value: ValueType;
}

export interface FeatureExtraction {
  kind: "Feature";
  type: TypeType;
  ref: string;
}

export interface EnvironmentExtraction {
  kind: "Environment";
  type: TypeType;
  ref: string;
}

export type FunctionEvaluation = Exists | Comparison | Combination | Negation | Between;

export interface Exists {
  kind: "FeatureExists" | "EnvironmentExists";
  ref: string;
}

export type ComparisonOperator = "<" | ">" | "<=" | ">=" | "==" | "!=";

export interface Comparison {
  kind: ComparisonOperator;
  left: Expression;
  right: Expression;
}

export interface Combination {
  kind: "&&" | "||";
  left: Expression;
  right: Expression;
}

export interface Negation {
  kind: "!";
  expression: Expression;
}

export interface Between {
  kind: "<=>";
  value: Expression;
  lower: Expression;
  upper: Expression;
}

//////////////////////
// Record constructors
//

const RuleStyleConfig = (rules: RuleStyle[]) => ({ rules: rules });
const RuleStyle = (condition: Expression, style: ol.style.Style) => ({
  condition: condition,
  style: style
});
const Constant = (value: ValueType) => ({ kind: "Constant", value: value } as Constant);
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

function compileRules(ruleCfg: RuleConfig): Validation<ol.StyleFunction> {
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
  const getFeat = (key: string, typeName: TypeType) => (ctx: Context) => {
    const value: any = ctx.feature.get(key);
    if (value && typeof value === typeName) {
      return option.fromNullable(ctx.feature.get(key));
    } else {
      return none;
    }
  };
  const checkFeatureDefined = (key: string) => (ctx: Context) => {
    const value: any = ctx.feature.get(key);
    return some(value !== null && value !== undefined);
  };
  const getResolution = (ctx: Context) => some(ctx.resolution);

  // Type check functies
  const typeIs = (targetType: TypeType) => (t1: TypeType) => (t1 === targetType ? ok({}) : fail(`${t1} moet ${targetType} zijn`));
  const allTypes2 = (targetType: TypeType) => (t1: TypeType, t2: TypeType) =>
    t1 === targetType && t2 === targetType ? ok({}) : fail(`${t1} en ${t2} moeten ${targetType} zijn`);
  const allTypes3 = (targetType: TypeType) => (t1: TypeType, t2: TypeType, t3: TypeType) =>
    t1 === targetType && t2 === targetType && t3 === targetType ? ok({}) : fail(`${t1}, ${t2} en ${t3}) moeten ${targetType} zijn`);
  const equalType = (t1: TypeType, t2: TypeType) => (t1 === t2 ? ok({}) : fail(`(${t1}, ${t2}) moeten gelijk zijn`));

  // De expressie op het hoogste niveau moet tot een boolean evalueren
  function compileCondition(expression: Expression): ValidatedTypedEvaluator {
    return compile(expression).chain(
      evaluator => (evaluator.typeName === "boolean" ? ok(evaluator) : fail(`Een conditie moet een boolean opleveren`))
    );
  }

  // Het hart van de compiler
  function compile(expression: Expression): ValidatedTypedEvaluator {
    switch (expression.kind) {
      case "&&":
        return apply2((a, b) => a && b, allTypes2("boolean"), "boolean", compile(expression.left), compile(expression.right));
      case "||":
        return apply2((a, b) => a || b, allTypes2("boolean"), "boolean", compile(expression.left), compile(expression.right));
      case "!":
        return apply1(a => !a, typeIs("boolean"), "boolean", compile(expression.expression));
      case "==":
        return apply2((a, b) => a === b, equalType, "boolean", compile(expression.left), compile(expression.right));
      case "!=":
        return apply2((a, b) => a !== b, equalType, "boolean", compile(expression.left), compile(expression.right));
      case "<":
        return apply2((a, b) => a < b, allTypes2("number"), "boolean", compile(expression.left), compile(expression.right));
      case "<=":
        return apply2((a, b) => a <= b, allTypes2("number"), "boolean", compile(expression.left), compile(expression.right));
      case ">":
        return apply2((a, b) => a > b, allTypes2("number"), "boolean", compile(expression.left), compile(expression.right));
      case ">=":
        return apply2((a, b) => a >= b, allTypes2("number"), "boolean", compile(expression.left), compile(expression.right));
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
      case "Constant":
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

  type RuleExpression = (ctx: Context) => Option<ol.style.Style>;

  // De regels controleren en combineren zodat at run-time ze één voor één geprobeerd worden totdat er een match is
  const validatedCombinedRuleExpression: Validation<RuleExpression> = array.reduce(
    (combinedRuleValidation: Validation<RuleExpression>, rule: Rule) =>
      // Hang een regel bij de vorige regels
      combinedRuleValidation.chain(combinedRule =>
        // De stijldefinitie moet kosjer zijn
        interpretStyleJson(rule.style).chain(style =>
          // De conditie moet kosjer zijn
          compileCondition(rule.condition).map(typedEvaluator => (ctx: Context) =>
            combinedRule(ctx).fold(
              () => typedEvaluator.evaluator(ctx).chain(outcome => ((outcome as boolean) ? some(style) : none)),
              stl => some(stl) // (orElse ontbreekt) De verse regel wordt niet meer uitgevoerd als er al een resultaat is.
            )
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
export function definitieToRuleExecutor(encoding: string, definitieText: string): Validation<ol.StyleFunction> {
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
    .field("versie", oi.str)(definitie)
    .chain(versie => {
      switch (versie) {
        case "awv-v0":
          return oi.field("definitie", jsonAwvV0RuleCompiler)(definitie);
        default:
          return oi.fail(`Versie '${versie}' wordt niet ondersteund`);
      }
    });
}

//////////////////////////////////////////////
// Valideer de regels en controleer de stijlen
//

const jsonAwvV0RuleConfig: Interpreter<RuleStyleConfig> = (json: Object) => {
  const typeType: Interpreter<TypeType> = (o: string) =>
    o === "boolean" || o === "string" || o === "number" ? ok(o as TypeType) : fail(`Het type moet 'boolean' of 'string' of 'number' zijn`);
  const constant: Interpreter<Expression> = oi.map(Constant, oi.field("value", oi.str));
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
    Constant: constant,
    Feature: environment,
    Environment: feature,
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
    "!": negation("!"),
    "<=>": between("<=>")
  });

  const rule = oi.map2(RuleStyle, oi.field("condition", expression), oi.field("style", interpretStyleJson));

  const ruleConfig = oi.map(RuleStyleConfig, oi.arr(rule));

  return oi.field("rules", ruleConfig)(json);
};

const jsonAwvV0RuleCompiler: Interpreter<ol.StyleFunction> = (json: Object) => jsonAwvV0RuleConfig(json).chain(compileRules);

////////////////////////////////////////////////////////////////
// Evalueren van gevalideerde en voorbereidde regelconfiguraties
//

// function chooseStyle(cfg: RuleConfig): StyleFunction {
//   return (feature: ol.Feature, resolution: number) =>
//     evaluateRules(cfg.rules, feature, resolution).getOrElse(() => {
//       kaartLogger.warn("Er kon geen stijl bepaald worden");
//       return null;
//     });
// }
//
// function evaluateRules(rules: Rule[], feature: ol.Feature, resolution: number): Option<ol.style.Style> {
//   function evaluateExpression(expression: Expression): Validation<ValueType> {
//     switch (expression.kind) {
//       case "Constant":
//         return ok(expression.value); // Het type is al gevalideerd tijdens het type checken
//       case "Environment":
//         return fail("environment nog niet ondersteund");
//       case "Feature":
//         return extractFeature(expression.ref, expression.type);
//       case "∃F":
//         return featureExists(expression.ref);
//       case "<":
//         return evaluateBinaryFunction((a, b) => a < b, expression.left, expression.right);
//       case "<=":
//         return evaluateBinaryFunction((a, b) => a <= b, expression.left, expression.right);
//       case ">":
//         return evaluateBinaryFunction((a, b) => a > b, expression.left, expression.right);
//       case ">=":
//         return evaluateBinaryFunction((a, b) => a >= b, expression.left, expression.right);
//       case "==":
//         return evaluateBinaryFunction((a, b) => a === b, expression.left, expression.right);
//       case "!=":
//         return evaluateBinaryFunction((a, b) => a !== b, expression.left, expression.right);
//       case "&&":
//         return evaluateBinaryFunction((a, b) => a && b, expression.left, expression.right);
//       case "||":
//         return evaluateBinaryFunction((a, b) => a || b, expression.left, expression.right);
//       case "!":
//         return evaluateUnaryFunction(a => !a, expression.argument);
//       case "<=>":
//         return evaluateTernaryFunction((a, b, c) => a >= b && a <= c, expression.value, expression.lower, expression.upper);
//       default:
//         return fail(`Implementation error. ${expression.kind} is niet geïmpleenteerd`);
//     }
//   }
//
//   function extractFeature(key: string, typeName: TypeType): Validation<ValueType> {
//     return getRawFeatureProperty(key).chain((maybeRawValue: Option<ValueType>) =>
//       maybeRawValue.fold(
//         () => fail(`De eigenschap ${key} heeft geen waarde`),
//         rawValue => validateType(rawValue, typeName, key)
//       )
//     );
//   }
//
//   function validateType(rawValue: ValueType, typeName: TypeType, key: string): Validation<ValueType> {
//     if (typeof rawValue === typeName) {
//       return ok(rawValue);
//     } else {
//       return fail(`Een type '${typeName}' werd verwacht voor '${key}', maar '${rawValue}' werd gevonden`);
//     }
//   }
//
//   function getRawFeatureProperty(key: string): Validation<Option<ValueType>> {
//     if (feature.getKeys().indexOf(key) >= 0) {
//       return ok(option.fromNullable(feature.get(key)));
//     } else {
//       return fail(`De feature heeft geen eigenschap '${key}'`);
//     }
//   }
//
//   function featureExists(key: string): Validation<boolean> {
//     const value = feature.get(key);
//     return ok(value !== null && value !== undefined);
//   }
//
//   function evaluateUnaryFunction(f: (a: ValueType) => ValueType, arg1: Expression): Validation<ValueType> {
//     const validation1: Validation<ValueType> = evaluateExpression(arg1);
//     return validation1.map(value1 => f(value1));
//   }
//
//   function evaluateBinaryFunction(
//     f: (a: ValueType, b: ValueType) => ValueType, arg1: Expression, arg2: Expression): Validation<ValueType> {
//     const validation1 = evaluateExpression(arg1);
//     const validation2 = evaluateExpression(arg2);
//     return validation1.chain(value1 => validation2.map(value2 => f(value1, value2)));
//   }
//
//   function evaluateTernaryFunction(
//     f: (a: ValueType, b: ValueType, c: ValueType) => ValueType,
//     arg1: Expression,
//     arg2: Expression,
//     arg3: Expression
//   ): Validation<ValueType> {
//     // Dit kan ook met applicative sequence en ap, maar is niet leesbaarder
//     const validation1: Validation<ValueType> = evaluateExpression(arg1);
//     const validation2 = evaluateExpression(arg2);
//     const validation3 = evaluateExpression(arg3);
//     return validation1.chain(value1 => validation2.chain(value2 => validation3.map(value3 => f(value1, value2, value3))));
//   }
//
//   // Hier gaan we de rules 1 voor 1 af tot we er één vinden die matcht.
//   return array.reduce(
//     (maybeApplicableStyle, rule) => {
//       return maybeApplicableStyle.fold(
//         () => {
//           const validatedRule: Validation<boolean> = evaluateExpression(rule.condition) as Validation<boolean>;
//           return validatedRule.fold(failureMsg => {
//             kaartLogger.warn(`regel kon niet geëvalueerd worden wegens ${failureMsg}`, rule);
//             return none;
//           }, ruleMatches => (ruleMatches ? stijlDefinitieToStyle(rule.style) : none));
//         }, //
//         style => some(style)
//       );
//     },
//     none as Option<ol.style.Style>,
//     rules
//   );
// }
//
// function stijlDefinitieToStyle(sd: object): Option<ol.style.Style> {
//   return none; // FIXME moet Validation worden + precompute van stijlen
// }
