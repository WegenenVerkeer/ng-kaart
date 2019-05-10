import { Filter as fltr } from "./filter-model";
import { definitieToFilter, filterToDefinitie } from "./filter-persistence";

describe("De filterinterpreter", () => {
  it("moet een roundtrip serialisatie/deserialisatie van een filter kunnen uitvoeren", () => {
    const filter: fltr.Filter = fltr.empty();
    const definitie = filterToDefinitie(filter);
    const result = definitieToFilter(definitie.encoding, definitie.filterDefinitie);

    expect(result.isSuccess()).toBe(true);
    expect(result.getOrElse(undefined)).toEqual(filter);
  });
});
