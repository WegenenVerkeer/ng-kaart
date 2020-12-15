import { Validator } from "../util/validation";

import * as oi from "./json-object-interpreting";

export const textToJson: Validator<string, object> = (text) => {
  try {
    const json: any = JSON.parse(text);
    if (typeof json === "object") {
      return oi.ok(json);
    } else {
      return oi.fail(
        `De gegeven stijldefinitie was geen geldig JSON object maar een '${typeof json}'`
      );
    }
  } catch (error) {
    return oi.fail(`De gegeven stijldefinitie was geen geldige JSON: ${error}`);
  }
};

export const properlyJsonDeclaredText: (
  encoding: string,
  text: string
) => oi.Validation<string> = (encoding, text) =>
  encoding === "json"
    ? oi.ok(text)
    : oi.fail(`Encoding '${encoding}' wordt niet ondersteund`);
