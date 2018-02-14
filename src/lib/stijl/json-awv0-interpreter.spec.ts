import * as ol from "openlayers";

import { jsonAwvV0Style, circle } from "./json-awv0-interpreter";
import { ok, fail, Validation } from "./json-object-interpreting";

describe("De json AWV V0 interpreter", () => {
  // const htmlNodeEquality = (o1: any, o2: any) => {
  //   console.log("comparing ", o1, " to ", o2);
  //   const isHtmlNode = (o: any) => o !== null && o !== undefined && o.hasOwnProperty("innerHTML");
  //   if (isHtmlNode(o1) && isHtmlNode(o2)) {
  //     console.log("got one");
  //     return true;
  //   } else {
  //     return undefined;
  //   }
  // };

  // beforeEach(() => jasmine.addCustomEqualityTester(htmlNodeEquality));

  it("moet een Fill met alle opties maken", () => {
    const result = jsonAwvV0Style({
      fill: {
        color: "#FF0"
      }
    });
    expect(result).toEqual(
      ok(
        new ol.style.Style({
          fill: new ol.style.Fill({
            color: "#FF0"
          })
        })
      )
    );
  });

  it("moet een Stroke met alle opties maken", () => {
    const result = jsonAwvV0Style({
      stroke: {
        color: "#FF0",
        lineCap: "square",
        lineJoin: "bevel",
        lineDash: [5, 0, 2, 0],
        miterLimit: 8,
        width: 5
      }
    });
    expect(result).toEqual(
      ok(
        new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: "#FF0",
            lineCap: "square",
            lineJoin: "bevel",
            lineDash: [5, 0, 2, 0],
            miterLimit: 8,
            width: 5
          })
        })
      )
    );
  });

  it("moet een Circle met alle opties maken", () => {
    const result = jsonAwvV0Style({
      circle: {
        radius: 10,
        fill: {
          color: "green"
        },
        stroke: {
          width: 3
        }
      }
    });
    expect(result).toEqual(
      ok(
        new ol.style.Style({
          image: new ol.style.Circle({
            radius: 10,
            stroke: new ol.style.Stroke({
              width: 3
            }),
            fill: new ol.style.Fill({
              color: "green;"
            })
          })
        })
      )
    );
    pending("Jasmine struikelt over het 'canvas' element dat openlayers aanmaakt.");
  });

  it("mag geen Circle zonder radius maken", () => {
    const result = jsonAwvV0Style({
      circle: {
        fill: {
          color: "blue"
        }
      }
    });
    expect(result.isFailure()).toBe(true);
    expect(result.value).toContain("geen veld 'radius'");
  });
});
