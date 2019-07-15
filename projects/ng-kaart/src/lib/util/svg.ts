import * as ol from "openlayers";

function vervangKleur(pin: string, kleur: ol.Color): string {
  function vullFillIn(nodes: HTMLCollectionOf<SVGGraphicsElement>, fillKleur: string) {
    for (let i = 0; i < nodes.length; i++) {
      const node: SVGGraphicsElement = nodes.item(i)!;
      if (!node.hasAttribute("fill")) {
        node.setAttribute("fill", fillKleur);
      }
    }
  }

  // Openlayers zijn color replacement werkt niet zoals we verwachten. Wit wordt vervangen door de opgegeven kleur.
  // Wij hebben juist wit in ons icoon nodig.
  // Daarom gaan we zelf de svg processen. We gaan er van uit dat alle path en text elementen waar geen fill op zit,
  // we de vervangende kleur moeten gebruiken.
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(pin, "text/xml");

  const kleurString = "#" + kleur[0].toString(16) + kleur[1].toString(16) + kleur[2].toString(16);

  vullFillIn(xmlDoc.getElementsByTagName("path"), kleurString);
  vullFillIn(xmlDoc.getElementsByTagName("text"), kleurString);

  return "data:image/svg+xml;utf8," + encodeURIComponent(new XMLSerializer().serializeToString(xmlDoc.documentElement!));
}

/**
 * Maak een icon obv een SVG image in de gegeven kleur. We hebben een afzonderlijke functie nodig omdat Openlayers (4.5)
 * dit niet correct doet.
 */
export function maakIconImage(kleur: [number, number, number, number], anchor: [0.5, 1.0], marker: string): ol.style.Icon {
  return new ol.style.Icon({
    anchor: anchor,
    anchorXUnits: "fraction",
    anchorYUnits: "fraction",
    scale: 1,
    opacity: 1,
    src: vervangKleur(marker, kleur)
  });
}
