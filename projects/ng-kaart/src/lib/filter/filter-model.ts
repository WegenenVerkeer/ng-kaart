import { Function1, Function2 } from "fp-ts/lib/function";

export interface IsExact {
  readonly operator: "=";
  readonly beschrijving: "is exact";
}

export type TypeType = "boolean" | "string" | "number";

export type ValueType = boolean | string | number;

export interface Literal {
  readonly kind: "Literal";
  readonly value: ValueType;
}

export interface Property {
  readonly kind: "Property";
  readonly type: TypeType;
  readonly ref: string;
}

export interface Comparison {
  readonly kind: IsExact;
  readonly left: Property;
  readonly right: Literal;
}

export type Filter = Comparison;

const value: Function2<Property, Literal, string> = (property, literal) => {
  switch (property.type) {
    case "string":
      return `'${literal.value}'`;
    case "number":
      return `${literal.value}`;
    case "boolean":
      return literal.value ? "true" : "false";
  }
};

const IsExact: IsExact = {
  operator: "=",
  beschrijving: "is exact"
};

export const cql: Function1<Filter, string> = comparison =>
  `${comparison.left.ref} ${comparison.kind.operator} ${value(comparison.left, comparison.right)}`;

export const Property: Function2<TypeType, string, Property> = (typetype, name) => ({
  kind: "Property",
  type: typetype,
  ref: name
});

export const IsExactFilter: Function2<Property, ValueType, Comparison> = (property, value) => ({
  kind: IsExact,
  left: property,
  right: {
    kind: "Literal",
    value: value
  }
});
