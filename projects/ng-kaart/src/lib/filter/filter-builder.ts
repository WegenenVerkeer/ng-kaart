import { Function2 } from "fp-ts/lib/function";

import { Filter as fltr } from "./filter-model";

// Hulp bij het opbouwen van een filter

export namespace FilterBuilder {
  export type FilterBuildElement = ComparisonBuilder; // later ook voor PropertyRangeOperator, enz

  interface ComparisonBuilder {
    readonly description: string;
    readonly build: Function2<fltr.Property, fltr.Literal, fltr.Comparison>;
  }

  export const comparisonBuilders: ComparisonBuilder[] = [
    { description: "is", build: fltr.Equality },
    { description: "is niet", build: fltr.Inequality }
  ];
}
