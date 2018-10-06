import { by, element } from "protractor";

import { KaartPage } from "../pages/kaart.po";

import { initTesting } from "./base-scenario";

describe("Als ik de test-app met de configurator-kaart bekijk", function() {
  initTesting();

  it("dan is de kaart zichtbaar", async () => {
    return expect(await element(by.id("qa-protractor")).isPresent()).toBe(true);
  });
});
