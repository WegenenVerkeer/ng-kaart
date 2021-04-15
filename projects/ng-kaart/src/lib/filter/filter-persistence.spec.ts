import { either } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { Filter as fltr } from "./filter-model";
import { definitieToFilter, filterToDefinitie } from "./filter-persistence";

describe("De filterinterpreter", () => {
  it("moet een roundtrip serialisatie/deserialisatie van een filter kunnen uitvoeren", () => {
    const filter: fltr.Filter = fltr.empty();
    const definitie = filterToDefinitie(filter);
    const result = definitieToFilter(
      definitie.encoding,
      definitie.filterDefinitie
    );

    expect(either.isRight(result)).toBe(true);
    expect(
      pipe(
        result,
        either.getOrElse(() => undefined)
      )
    ).toEqual(filter);
  });
});
