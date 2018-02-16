interface RuleConfig {
  rules: Rule[];
}

interface Rule {
  condition: RuleCondition;
  style: StijlDefinitie;
}

interface StijlDefinitie {
  versie: string;
  definitie: string;
}

type RuleOperand = RuleCondition | TypedExpression;

// noinspection TsLint
type RuleCondition = Predicate | (Constant & { type: "boolean", value: "false" | "true" });

interface Predicate {
  kind: "Predicate";
  operator: "==" | ">" | ">=" | "<" | "<=" | "<=>" | "!=" | "&&" | "||" | "!";
  operands: RuleOperand[];
}

type TypedExpression = Constant | EnvironmentExtraction | FeatureExtraction;

interface Constant {
  kind: "Constant";
  type: "boolean" | "string" | "number";
  value: string;
}

interface FeatureExtraction {
  kind: "Feature";
  type: "boolean" | "string" | "number";
  ref: string;
}

interface EnvironmentExtraction {
  kind: "Environment";
  type: "boolean" | "string" | "number";
  ref: string;
}

const cfg1: RuleConfig = {
  rules: [
    {
      condition: {
        kind: "Constant",
        type: "boolean",
        value: "true"
      },
      style: {
        versie: "awv-v0",
        definitie: "stijl1"
      }
    }
  ]
};

// noinspection TsLint
const cfg2: RuleConfig = {
  rules: [
    {
      condition: {
        kind: "Predicate", operator: "&&", operands: [
          { kind: "Predicate", operator: "==", operands: [
              { kind: "Feature", type: "string", ref: "offsetZijde" },
              { kind: "Constant", type: "string", value: "R" }
            ]},
          { kind: "Predicate", operator: "<=>", operands: [
              { kind: "Environment", type: "number", ref: "scale" },
              { kind: "Constant", type: "number", value: "0" },
              { kind: "Constant", type: "number", value: "5000" }
            ]}
        ]},
      style: {
        versie: "awv-v0",
        definitie: "offsetLijn: {\"offset\":-25,\"width\":5,\"color\":\"#FFFF00\"}"
      }
    }
  ]
};
