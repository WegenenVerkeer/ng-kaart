/// <reference types="cypress" />

describe("Als ik de testapp met de configurator-kaart bekijk", function() {
  it("dan is de kaart zichtbaar", () => {
    cy.visit("/test");

    cy.get("#qa-protractor");
  });
});
