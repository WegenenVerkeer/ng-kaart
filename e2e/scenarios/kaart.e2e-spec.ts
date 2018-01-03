import { KaartPage } from "../pages/kaart.po";

describe("Als ik de kaart component bekijk", function() {
  const page: KaartPage = new KaartPage();

  beforeAll(async function(): Promise<any> {
    await page.gaNaarPagina();
  });

  it("dan is de kaart zichtbaar", async function(): Promise<any> {
    expect(await page.kaartComponent.isPresent()).toBeTruthy();
  });
});
