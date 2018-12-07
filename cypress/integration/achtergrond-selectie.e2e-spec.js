/// <reference types="cypress" />

function allAchtergrondTiles() {
  return cy.get("awv-kaart-achtergrond-tile");
}

function zichtbareTiles() {
  // Er is ook gewoon een :visible selector, maar die is niet slim genoeg voor onze CSS
  return allAchtergrondTiles().filter("[style = 'opacity: 1; max-width: 80px;']");
}

function zichtbareTilesMetTitel(titel) {
  return allAchtergrondTiles().find(".title").contains(titel).parent().parent().filter("[style = 'opacity: 1; max-width: 80px;']");
}

describe("Als ik de testapp met de configurator-kaart bekijk", function() {
  beforeEach(() => {
    cy.visit("/test");
  });

  it("dan is de achtergrond selector zichtbaar", () => {
    cy.get("awv-kaart-achtergrond-selector").should('be.visible');
  });

  it("dan wordt de 'dienstkaart grijs' achtergrond tile getoond", () => {
    zichtbareTilesMetTitel("Dienstkaart grijs").should('have.length', 1);
  });

  it("dan worden er 5 achtergrond tiles aangemaakt", () => {
    allAchtergrondTiles().should('have.length', 5);
  });

  it("dan is er maar 1 van die 5 tiles zichtbaar", () => {
    zichtbareTiles().should('have.length', 1);
  });

  it("dan wordt de 'dienstkaart kleur' achtergrond tile niet getoond", () => {
    zichtbareTilesMetTitel("Dienstkaart kleur").should('have.length', 0);
  });

  describe("wanneer op de enige tile geklikt wordt", () => {
    beforeEach(() => {
      zichtbareTiles().first().click();
    });

    it("dan worden alle 5 tiles zichtbaar", () => {
      zichtbareTiles().should('have.length', 5);
    });

    describe("wanneer dan op de 'Dienstkaart kleur' tile geklikt wordt", () => {
      beforeEach(() => {
        zichtbareTilesMetTitel("Dienstkaart kleur").first().click();
      });

      it("is 'Dienstkaart kleur' zichtbaar", () => {
        zichtbareTilesMetTitel("Dienstkaart kleur").should('have.length', 1);
      });

      it("zijn er geen andere tiles meer zichtbaar", () => {
        zichtbareTiles().should('have.length', 1);
      });
    });
  });
});
