import { AwvV0FilterInterpreters } from "./filter-awv0-interpreter";
import { Filter, PureFilter } from "./filter-new-model";

describe("De stijl interpreter", () => {
  describe("bij het interpreteren van geldige structuren", () => {
    it("moet een 'pure' filter kunnen verwerken", () => {
      const pure: Filter = PureFilter;
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(pure);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toBe(pure);
    });
  });
});
