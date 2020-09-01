import { lambert72ToWgs84, wgs84ToLambert72 } from "./coordinaten.service";

describe("CoordinatenService", () => {
  describe("#transform Lambert72 -> Wgs84", () => {
    describe("Happy", () => {
      it("transformeert coordinaten", () => {
        const result = wgs84ToLambert72([4.7970553, 51.0257317]);
        expect(result).toEqual([180048.06920228814, 190702.69932892825]);
      });
    });
  });

  describe("#transform Wgs84 -> Lambert72", () => {
    describe("Happy", () => {
      it("transformeert coordinaten", () => {
        const result = lambert72ToWgs84([
          180048.06920228814,
          190702.69932892825,
        ]);
        expect(result).toEqual([4.7970552913413025, 51.02573170365698]);
      });
    });
  });
});
