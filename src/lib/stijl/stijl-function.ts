import * as ol from "openlayers";

import { Validation } from "./json-object-interpreting";
import { jsonAwvV0RuleCompiler } from "./json-awv-v0-stijlfunctie";
import * as oi from "./json-object-interpreting";

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

export type Expression = Literal | EnvironmentExtraction | PropertyExtraction | FunctionEvaluation;

export type TypeType = "boolean" | "string" | "number";

export type ValueType = boolean | string | number;

export interface Literal {
  readonly kind: "Literal";
  readonly value: ValueType;
}

export interface PropertyExtraction {
  readonly kind: "Property";
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
  readonly kind: "PropertyExists" | "EnvironmentExists";
  readonly ref: string;
}

export type ComparisonOperator = "<" | ">" | "<=" | ">=" | "==" | "!=" | "L==";

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

export const Literal = (value: ValueType) => ({ kind: "Literal", value: value } as Literal);
export const PropertyExtraction = (typeName: TypeType, ref: string) =>
  ({
    kind: "Property",
    type: typeName,
    ref: ref
  } as PropertyExtraction);
export const EnvironmentExtraction = (typeName: TypeType, ref: string) =>
  ({
    kind: "Environment",
    type: typeName,
    ref: ref
  } as EnvironmentExtraction);
export const Exists = (kind: "PropertyExists" | "EnvironmentExists") => (ref: String) =>
  ({
    kind: kind,
    ref: ref
  } as Exists);
export const Comparison = (kind: ComparisonOperator) => (left: Expression, right: Expression) =>
  ({
    kind: kind,
    left: left,
    right: right
  } as Comparison);
export const Combination = (kind: "&&" | "||") => (left: Expression, right: Expression) =>
  ({
    kind: kind,
    left: left,
    right: right
  } as Combination);
export const Negation = (expression: Expression) => ({
  kind: "!",
  expression: expression
});
export const Between = (value: Expression, lower: Expression, upper: Expression) => ({
  kind: "<=>",
  value: value,
  lower: lower,
  upper: upper
});

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
