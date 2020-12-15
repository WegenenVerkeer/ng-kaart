import { Lens, Prism } from "monocle-ts";

import { AwvV0StaticStyle } from "./stijl-static-types";

/// ////////////////////////////////////////
// De types die alles in goede banen leiden
//

// De exported types zijn ook bruikbaar voor clients zodat de compiler ze kan assisteren met het schrijven van geldige definities.

export type AwvV0DynamicStyle = RuleConfig;

// Een lijst van Rules. De eerste Rule die als waar geëvalueerd wordt, bepaalt de stijl.
export interface RuleConfig {
  readonly rules: Rule[];
}

export const rulesLens: Lens<RuleConfig, Rule[]> = Lens.fromProp<RuleConfig>()(
  "rules"
);

// Rules worden beschreven adhv expressies die een boolean opleveren en een beschrijving van de stijl.
export interface Rule {
  readonly condition: Expression;
  readonly style: { definition: AwvV0StaticStyle }; // definition voegt niet veel toe, maar is omwille van backwards compatibility
}

export type Expression =
  | Literal
  | EnvironmentExtraction
  | PropertyExtraction
  | FunctionEvaluation;

export type TypeType = "boolean" | "string" | "number";

export type ValueType = boolean | string | number | string[];

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

export type FunctionEvaluation =
  | Exists
  | Comparison
  | Combination
  | Negation
  | Between;

export type ExistsOperator = "PropertyExists" | "EnvironmentExists";
export interface Exists {
  readonly kind: ExistsOperator;
  readonly ref: string;
}

export type ComparisonOperator =
  | "<"
  | ">"
  | "<="
  | ">="
  | "=="
  | "!="
  | "L=="
  | "CONTAINS"
  | "!CONTAINS";
export interface Comparison {
  readonly kind: ComparisonOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export type CombinationOperator = "&&" | "||";
export interface Combination {
  readonly kind: CombinationOperator;
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

/// ///////////////////
// Record constructors
//
export const RuleConfig: (rules: Rule[]) => RuleConfig = (rules) => ({
  rules: rules,
});
export const Rule: (expression: Expression, style: AwvV0StaticStyle) => Rule = (
  expression,
  style
) => ({
  condition: expression,
  style: { definition: style },
});
export const Literal: (vaulue: ValueType) => Literal = (value) => ({
  kind: "Literal",
  value: value,
});
export const PropertyExtraction: (
  typeName: TypeType,
  ref: string
) => PropertyExtraction = (typeName, ref) => ({
  kind: "Property",
  type: typeName,
  ref: ref,
});
export const EnvironmentExtraction: (
  typeName: TypeType,
  ref: string
) => EnvironmentExtraction = (typeName, ref) => ({
  kind: "Environment",
  type: typeName,
  ref: ref,
});
export const Exists: (kind: ExistsOperator) => (ref: string) => Exists = (
  kind
) => (ref) => ({
  kind: kind,
  ref: ref,
});
export const Comparison: (
  kind: ComparisonOperator
) => (left: Expression, right: Expression) => Comparison = (kind) => (
  left,
  right
) => ({
  kind: kind,
  left: left,
  right: right,
});
export const Combination: (
  kind: CombinationOperator
) => (left: Expression, right: Expression) => Combination = (kind) => (
  left,
  right
) => ({
  kind: kind,
  left: left,
  right: right,
});
export const Negation: (expression: Expression) => Negation = (expression) => ({
  kind: "!",
  expression: expression,
});
export const Between: (
  value: Expression,
  lower: Expression,
  upper: Expression
) => Between = (value, lower, upper) => ({
  kind: "<=>",
  value: value,
  lower: lower,
  upper: upper,
});
