import { option } from "fp-ts";

import * as ol from "../util/openlayers-compat";

/**
 * Indien OL een fout krijgt bij het ophalen van een tile (bvb 401 bij niet langer ingelogd zijn) dan zal OL niet opnieuw proberen om die
 * tile op te halen, als de gebruiker er terug naartoe pant. Het gevolg is dat die tile altijd als wit of wazig wordt afgebeeld. Door de
 * mislukte tiles bij te houden en een expliciete load() ervan te triggeren wanneer we terug een goede of geauthoriseerde netwerk
 * connectie hebben, zal succesvol opgehaalde tile wel opgeslagen worden in de interne tilecache van OL en bijgevolg correct afgebeeld
 * worden. Het is aangeraden om bij het definieren van ol.Source de cacheSize op maxAantalTiles tiles te zetten. Bvb:
 *
 *  source: new ol.source.TileWMS({
 *       cacheSize: kaart.tileLoader.maxMislukteTiles,
 *       ...
 */
class MislukteTiles {
  private mislukteTiles: Array<ol.Tile> = [];

  constructor(private maxAantalTiles: number) {}

  voegtoe(tile: ol.Tile) {
    this.mislukteTiles.push(tile);
    if (this.mislukteTiles.length > this.maxAantalTiles) {
      this.mislukteTiles.shift();
    }
  }

  verwijder(tile: ol.Tile) {
    this.mislukteTiles = this.mislukteTiles.filter((t) => tile !== t);
  }

  herlaad() {
    this.mislukteTiles.forEach((tile) => tile!.load());
  }
}

export class TileLoader {
  // https://openlayers.org/en/latest/apidoc/module-ol_source_TileWMS.html#~Options
  // cacheSize	number	<optional> 2048 Cache size.
  // neem over in definitie van de TileWMS
  readonly maxMislukteTiles = 512;

  private inTeLadenImages: Array<HTMLImageElement> = [];

  private mislukteTiles: MislukteTiles = new MislukteTiles(
    this.maxMislukteTiles
  );

  private laatsteResultaat = "";

  public abort(): void {
    this.inTeLadenImages.map((htmlImage) => {
      option.fromNullable(htmlImage).map((img) => {
        img.src = "";
      });
    });
    this.inTeLadenImages = [];
  }

  private checkMislukteTiles(eventType: string, tile: ol.Tile) {
    // bewaar of verwijder eventueel mislukte tiles
    if (eventType === "error") {
      this.mislukteTiles.voegtoe(tile);
    } else if (eventType === "load") {
      this.mislukteTiles.verwijder(tile);
    }

    // indien we terug een succesvolle tile load hebben, herprobeer om de mislukte tiles op te halen
    if (this.laatsteResultaat === "error" && eventType === "load") {
      this.mislukteTiles.herlaad();
    }

    // bewaar het laatste load resultaat
    this.laatsteResultaat = eventType;
  }

  get tileLoadFunction(): (tile: ol.Tile, url: string) => void {
    const that = this;

    return function (tile, url) {
      const imageTile = tile as ol.ImageTile;
      const htmlImage = imageTile.getImage() as HTMLImageElement;

      const onHtmlImageEvent: (
        this: HTMLImageElement,
        ev: Event
      ) => any = function (evt) {
        that.inTeLadenImages = that.inTeLadenImages.filter(
          (img) => img !== this
        );
        that.checkMislukteTiles(evt.type, tile);
      };

      htmlImage.src = url;
      htmlImage.addEventListener<"load">("load", onHtmlImageEvent);
      htmlImage.addEventListener<"error">("error", onHtmlImageEvent);
      that.inTeLadenImages.push(htmlImage);
    };
  }

  // als referentie
  public blankTileLoadFunction(tile: ol.Tile, url: string): void {
    const imageTile = tile as ol.ImageTile;
    const htmlImage = imageTile.getImage() as HTMLImageElement;
    htmlImage.src = "";
  }

  // als referentie
  public defaultTileLoadFunction(tile: ol.Tile, url: string): void {
    const imageTile = tile as ol.ImageTile;
    const htmlImage = imageTile.getImage() as HTMLImageElement;
    htmlImage.src = url;
  }
}
