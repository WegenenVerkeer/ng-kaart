import * as ol from "openlayers";

import { definitieToStyle } from "./stijl-interpreter";
import { ok, fail } from "./json-object-interpreting";

describe("De stijl interpreter", () => {
  beforeEach(() => {});

  describe("bij het converteren van een geldige stijldefinite", () => {
    describe("een simple stijldefinitie", () => {
      it("moet een stroke met kleur en breedte maken", () => {
        const result = definitieToStyle(
          "json",
          JSON.stringify({
            versie: "awv-v0",
            definitie: {
              stroke: {
                color: "#FF0",
                width: 5
              }
            }
          })
        );
        expect(result).toEqual(
          ok(
            new ol.style.Style({
              stroke: new ol.style.Stroke({
                color: "#FF0",
                width: 5
              })
            })
          )
        );
      });

      it("moet een fill met kleur maken", () => {
        const result = definitieToStyle(
          "json",
          JSON.stringify({
            versie: "awv-v0",
            definitie: {
              fill: {
                color: "green"
              }
            }
          })
        );
        expect(result).toEqual(
          ok(
            new ol.style.Style({
              fill: new ol.style.Fill({
                color: "green"
              })
            })
          )
        );
      });

      it("moet een circle met fill en stroke maken", () => {
        const result = definitieToStyle(
          "json",
          JSON.stringify({
            versie: "awv-v0",
            definitie: {
              circle: {
                stroke: {
                  color: "yellow",
                  width: 2
                },
                fill: {
                  color: "maroon"
                },
                radius: 4
              }
            }
          })
        );
        expect(result).toEqual(
          ok(
            new ol.style.Style({
              image: new ol.style.Circle({
                fill: new ol.style.Fill({
                  color: "maroon"
                }),
                stroke: new ol.style.Stroke({
                  color: "yellow",
                  width: 2
                }),
                radius: 4
              })
            })
          )
        );
        pending("Jasmine struikelt over het 'canvas' element dat openlayers aanmaakt.");
      });
    });
  });

  describe("bij het converteren van een samengestelde stijl", () => {
    it("moet een stijl met stroke en fill maken", () => {
      const result = definitieToStyle(
        "json",
        JSON.stringify({
          versie: "awv-v0",
          definitie: {
            stroke: {
              color: "red",
              width: 1
            },
            fill: {
              color: "green"
            }
          }
        })
      );
      expect(result).toEqual(
        ok(
          new ol.style.Style({
            stroke: new ol.style.Stroke({
              color: "red",
              width: 1
            }),
            fill: new ol.style.Fill({
              color: "green"
            })
          })
        )
      );
    });
  });

  describe("Bij het converteren van een ongeldige stijl", () => {
    describe("wanneer het format niet ondersteund is", () => {
      it("moet een fout mbt tot het ontbrekende veldje geven", () => {
        const result = definitieToStyle("xml", "<style></style>");
        expect(result.isFailure()).toBe(true);
        expect(result.value).toEqual("Formaat 'xml' wordt niet ondersteund");
      });
    });

    describe("wanneer een verplicht veldje ontbreekt", () => {
      it("moet een fout mbt tot het ontbrekende veldje geven", () => {
        const result = definitieToStyle(
          "json",
          JSON.stringify({
            versie: "awv-v0",
            diefnty: {}
          })
        );
        expect(result.isFailure()).toBe(true);
        expect(result.value).toContain("geen veld 'definitie'");
      });
    });
  });
});
