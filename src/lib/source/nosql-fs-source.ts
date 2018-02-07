import * as ol from "openlayers";

export class NosqlFsSource extends ol.source.Vector {
  private featureDelimiter = "\n";
  private xhr = null;
  private currentPosition = 0;

  constructor(
    public database: string,
    public collection: string,
    public url = "/geolatte-nosqlfs",
    public view = "default",
    public filter?: string
  ) {
    super({
      format: new ol.format.GeoJSON(),
      loader: function(extent, resolution, projection) {
        const params = {
          bbox: extent.join(","),
          "with-view": encodeURIComponent(view),
          ...filter ? { query: encodeURIComponent(filter) } : {}
        };

        const httpUrl = `${url}/api/databases/${database}/${collection}/query?${Object.keys(params)
          .map(function(key) {
            return key + "=" + params[key];
          })
          .join("&")}`;

        this.xhr = new XMLHttpRequest();
        this.xhr.open("GET", httpUrl, true);
        this.xhr.setRequestHeader("Accept", "application/json");

        this.xhr.addEventListener("progress", this.xhrProgressFunction.bind(this), false);
        this.xhr.addEventListener("load", this.xhrLoadFunction.bind(this), false);

        this.xhr.addEventListener("error", this.xhrFailFunction.bind(this), false);
        this.xhr.addEventListener("timeout", this.xhrFailFunction.bind(this), false);

        this.xhr.send();
      },
      strategy: ol.loadingstrategy.bbox
    });
  }

  private xhrLoadFunction() {
    console.log("Load");
  }

  private xhrFailFunction() {
    console.log("Failed");
  }

  private xhrProgressFunction() {
    console.log("Progress");

    if (this.xhr.status !== 200) {
      return;
    }

    const positionLastDelimiter = this.xhr.response.lastIndexOf(this.featureDelimiter);
    if (positionLastDelimiter === -1) {
      return;
    }

    const tokens: string[] = this.xhr.response.slice(this.currentPosition, positionLastDelimiter).split(this.featureDelimiter);
    this.currentPosition = positionLastDelimiter;

    tokens.map(function(token) {
      this.addFeature(this.getFormat().readFeature(token));
    }, this);
  }
}
