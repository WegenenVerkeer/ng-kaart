import { Function1, Function2 } from "fp-ts/lib/function";

import * as oi from "../stijl/json-object-interpreting";
import { properlyJsonDeclaredText, textToJson } from "../stijl/text-json";
import { validationChain as chain, validationChain2 } from "../util/validation";

import { FilterAwv0Json } from "./filter-awv0-export";
import { AwvV0FilterInterpreters } from "./filter-awv0-interpreter";
import { Filter as fltr } from "./filter-model";

const Version0 = "awv-v0";

export const definitieToFilter: Function2<string, string, oi.Validation<fltr.Filter>> = (encoding, definitieText) =>
  validationChain2(properlyJsonDeclaredText(encoding, definitieText), textToJson, interpretJsonAsSpec);

export const interpretJsonAsSpec: oi.Interpreter<fltr.Filter> = json =>
  chain(oi.field("version", oi.str)(json), version => {
    switch (version) {
      case Version0:
        return oi.field("definition", AwvV0FilterInterpreters.jsonAwv0Definition)(json);
      default:
        return oi.fail(`Versie '${version}' wordt niet ondersteund`);
    }
  });

export interface EncodedFilter {
  readonly filterDefinitie: string;
  readonly encoding: string;
}

export const filterToDefinitie: Function1<fltr.Filter, EncodedFilter> = filter => ({
  filterDefinitie: FilterAwv0Json.encode(filter),
  encoding: Version0
});
