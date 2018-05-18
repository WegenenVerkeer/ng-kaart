import { List } from "immutable";

import { fromNullable } from "fp-ts/lib/Option";

export class TileLoader {
  private images: List<HTMLImageElement> = List.of<HTMLImageElement>();

  public abort(): void {
    this.images.map(htmlImage => {
      fromNullable(htmlImage).map(img => {
        img.src = "";
      });
    });
    this.images = this.images.clear();
  }

  get tileLoadFunction(): (tile: ol.Tile, url: string) => void {
    const that = this;

    const removeImage: (this: HTMLImageElement, ev: Event) => any = function(evt) {
      that.images = that.images.filter(img => img !== this).toList();
    };

    const tf: (tile: ol.Tile, url: string) => void = function(tile, url) {
      const imageTile = tile as ol.ImageTile;
      const htmlImage = imageTile.getImage() as HTMLImageElement;
      htmlImage.src = url;
      htmlImage.addEventListener<"load">("load", removeImage);
      htmlImage.addEventListener<"error">("error", removeImage);
      that.images = that.images.push(htmlImage);
    };
    return tf;
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
