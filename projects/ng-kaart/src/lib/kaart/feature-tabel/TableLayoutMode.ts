import { eq } from "fp-ts";

export type TableLayoutMode = "Compact" | "Comfortable";

export namespace TableLayoutMode {
  export const eqTableLayoutMode = eq.eqString;
}
