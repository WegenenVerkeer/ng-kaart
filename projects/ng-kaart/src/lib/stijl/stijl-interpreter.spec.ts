import { either } from "fp-ts";
import * as ol from "../util/openlayers-compat";

import { ok } from "./json-object-interpreting";
import { definitieToStyle } from "./stijl-static";

describe("De stijl interpreter", () => {
  describe("bij het converteren van een geldige stijldefinite", () => {
    describe("een simpele stijldefinitie", () => {
      it("moet een stroke met kleur en breedte maken", () => {
        const result = definitieToStyle(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              stroke: {
                color: "#FF0",
                width: 5,
              },
            },
          })
        );
        expect(result).toEqual(
          ok(
            new ol.style.Style({
              stroke: new ol.style.Stroke({
                color: "#FF0",
                width: 5,
              }),
            })
          )
        );
      });

      it("moet een fill met kleur maken", () => {
        const result = definitieToStyle(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              fill: {
                color: "green",
              },
            },
          })
        );
        expect(result).toEqual(
          ok(
            new ol.style.Style({
              fill: new ol.style.Fill({
                color: "green",
              }),
            })
          )
        );
      });

      it("moet een circle met fill en stroke maken", () => {
        const result = definitieToStyle(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              circle: {
                stroke: {
                  color: "yellow",
                  width: 2,
                },
                fill: {
                  color: "maroon",
                },
                radius: 4,
              },
            },
          })
        );
        expect(result).toEqual(
          ok(
            new ol.style.Style({
              image: new ol.style.Circle({
                fill: new ol.style.Fill({
                  color: "maroon",
                }),
                stroke: new ol.style.Stroke({
                  color: "yellow",
                  width: 2,
                }),
                radius: 4,
              }),
            })
          )
        );
        pending(
          "Jasmine struikelt over het 'canvas' element dat openlayers aanmaakt."
        );
      });
    });
  });

  describe("bij het converteren van een samengestelde stijl", () => {
    it("moet een stijl met stroke en fill maken", () => {
      const result = definitieToStyle(
        "json",
        JSON.stringify({
          version: "awv-v0",
          definition: {
            stroke: {
              color: "red",
              width: 1,
            },
            fill: {
              color: "green",
            },
          },
        })
      );
      expect(result).toEqual(
        ok(
          new ol.style.Style({
            stroke: new ol.style.Stroke({
              color: "red",
              width: 1,
            }),
            fill: new ol.style.Fill({
              color: "green",
            }),
          })
        )
      );
    });
  });

  describe("Bij het converteren van een ongeldige stijl", () => {
    describe("wanneer het format niet ondersteund is", () => {
      it("moet een fout mbt tot het niet-ondersteunde formaat geven", () => {
        const result = definitieToStyle("xml", "<style></style>");
        expect(either.isLeft(result)).toBe(true);
        expect((result as either.Left<string[]>).left).toEqual([
          "Encoding 'xml' wordt niet ondersteund",
        ]);
      });
    });

    describe("wanneer een verplicht veldje ontbreekt", () => {
      it("moet een fout mbt tot het ontbrekende veldje geven", () => {
        const result = definitieToStyle(
          "json",
          JSON.stringify({
            version: "awv-v0",
            diefnty: {},
          })
        );
        expect(either.isLeft(result)).toBe(true);
        expect((result as either.Left<string[]>).left[0]).toContain(
          "geen veld 'definition'"
        );
      });
    });
  });
});
