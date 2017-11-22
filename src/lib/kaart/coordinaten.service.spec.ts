import {inject, TestBed} from "@angular/core/testing";
import {CoordinatenService} from "./coordinaten.service";
import {KaartModule} from "./index";

describe("CoordinatenService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({imports: [KaartModule]});
  });

  let coordinatenService: CoordinatenService;

  beforeEach(
    inject([CoordinatenService], (_coordinatenService: CoordinatenService) => {
      coordinatenService = _coordinatenService;
    })
  );

  describe("#transform", () => {
    describe("Happy", () => {
      it("transformeert coordinaten", () => {
        const result = coordinatenService.transform([4.7970553, 51.0257317], "EPSG:4326");
        expect(result).toEqual([180048.06920228814, 190702.69932892825]);
      });
    });
  });

  describe("#transformWgs84", () => {
    describe("Happy", () => {
      it("transformeert coordinaten", () => {
        const result = coordinatenService.transformWgs84(4.7970553, 51.0257317);
        expect(result).toEqual([180048.06920228814, 190702.69932892825]);
      });
    });
  });
});
