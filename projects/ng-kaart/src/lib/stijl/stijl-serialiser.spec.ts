import { definitieToStyle, serialiseAwvV0StaticStyle } from "./stijl-static";
import { AwvV0StaticStyle } from "./stijl-static-types";

describe("De stijl serialiaser", () => {
  describe("bij het schrijven van een statische stijl", () => {
    it("moet equivalente JSON genereren als diegene die geparsed wordt", () => {
      const staticStyle: AwvV0StaticStyle = {
        stroke: {
          color: "#FF0",
          width: 5,
        },
      };
      const jsonStyle = {
        version: "awv-v0",
        definition: staticStyle,
      };
      const serialised = serialiseAwvV0StaticStyle(staticStyle);
      const deserialisedDirect = definitieToStyle(
        "json",
        JSON.stringify(jsonStyle)
      );
      const roundTripped = definitieToStyle("json", serialised);
      expect(deserialisedDirect).toEqual(roundTripped);
    });
  });
});
