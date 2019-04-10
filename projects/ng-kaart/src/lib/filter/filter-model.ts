import { Function1, Function2, Function3 } from "fp-ts/lib/function";

// Simple filter defs

export interface Is {
  readonly operator: "=";
  readonly beschrijving: "is exact";
}

export interface IsNiet {
  readonly operator: "!=";
  readonly beschrijving: "is niet";
}

export type Operator = Is | IsNiet;

// TODO: laten we voorlopig overeen komen met alle veldtypes uit VeldInfo
export type TypeType = "string" | "integer" | "double" | "geometry" | "date" | "datetime" | "boolean" | "json";

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

export interface SimpleFilter {
  readonly kind: Is | IsNiet;
  readonly left: Property;
  readonly right: Literal;
}

export type Filter = SimpleFilter;

const Is: Is = {
  operator: "=",
  beschrijving: "is exact"
};

const IsNiet: IsNiet = {
  operator: "!=",
  beschrijving: "is niet"
};

export const Property: Function2<TypeType, string, Property> = (typetype, name) => ({
  kind: "Property",
  type: typetype,
  ref: name
});

export const Operator: Function1<string, Operator> = symbool => {
  switch (symbool) {
    case Is.operator:
      return Is;
    case IsNiet.operator:
      return IsNiet;
    default:
      // fallback equality
      return Is;
  }
};

export const SimpleFilter: Function3<Property, ValueType, Operator, SimpleFilter> = (property, value, operator) => ({
  kind: operator,
  left: property,
  right: {
    kind: "Literal",
    value: value
  }
});

// Make some CQL

const value: Function2<Property, Literal, string> = (property, literal) => {
  switch (property.type) {
    case "string":
      return `'${literal.value}'`;
    case "integer":
      return `${literal.value}`;
    case "boolean":
      return literal.value ? "true" : "false";
    default:
      return `'${literal.value}'`; // beschouw al de rest als string. Zie TODO bij TypeType
  }
};

export const cql: Function1<Filter, string> = filter => `${filter.left.ref} ${filter.kind.operator} ${value(filter.left, filter.right)}`;
