import { BBox } from "./rectangle";

// De expectations houden rekening met het algoritme waar eerste verticale slices genomen worden. Een equivalent
// algoritme met horizontale slices bijvoorbeeld zou onterecht falen.
describe("Het verschil tussen 2 bounding boxes", () => {
  const bbox1: BBox = [0, 0, 10, 10];
  it("moet een array met enkel de eerste opleveren als er geen overlap is", () => {
    const bbox2: BBox = [20, 20, 30, 30];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toEqual([bbox1]);
  });
  it("moet een lege array opleveren als de twee gelijk zijn", () => {
    const diff = BBox.difference(bbox1, bbox1);
    expect(diff).toEqual([]);
  });
  it("moet één rechthoek links opleveren bij een verschuiving naar rechts met overlap", () => {
    const bbox2: BBox = [2, 0, 12, 10];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toEqual([[0, 0, 2, 10]]);
  });
  it("moet één rechthoek rechts opleveren bij een verschuiving naar links met overlap", () => {
    const bbox2: BBox = [-2, 0, 8, 10];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toEqual([[8, 0, 10, 10]]);
  });
  it("moet één rechthoek boven opleveren bij een verschuiving naar onder met overlap", () => {
    const bbox2: BBox = [0, 2, 10, 12];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toEqual([[0, 0, 10, 2]]);
  });
  it("moet één rechthoek onder opleveren bij een verschuiving naar boven met overlap", () => {
    const bbox2: BBox = [0, -2, 10, 8];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toEqual([[0, 8, 10, 10]]);
  });
  it("moet lege array opleveren wanneer de eerste rechthoek in de tweede omvat is", () => {
    const bbox2: BBox = [-2, -2, 12, 12];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toEqual([]);
  });
  it("moet een array met 4 rechthoeken opleveren wanneer de tweede rechthoek in de eerste omvat is en die niet raakt", () => {
    const bbox2: BBox = [2, 2, 8, 8];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toContain([0, 0, 2, 10]);
    expect(diff).toContain([8, 0, 10, 10]);
    expect(diff).toContain([2, 0, 8, 2]);
    expect(diff).toContain([2, 8, 8, 10]);
  });
  it("moet een array met 2 rechthoeken opleveren wanneer de tweede rechthoek de eerste rechtsonder snijdt", () => {
    const bbox2: BBox = [5, 5, 15, 15];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toContain([0, 0, 5, 10]);
    expect(diff).toContain([5, 0, 10, 5]);
  });
  it("moet een array met 3 rechthoeken opleveren wanneer de tweede rechthoek de eerste links in het midden snijdt", () => {
    const bbox2: BBox = [0, 4, 5, 6];

    const diff = BBox.difference(bbox1, bbox2);
    expect(diff).toContain([0, 0, 5, 4]);
    expect(diff).toContain([0, 6, 5, 10]);
    expect(diff).toContain([5, 0, 10, 10]);
  });
});
