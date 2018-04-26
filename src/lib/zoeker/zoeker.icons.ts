export const pin_c_vierkant =
  // tslint:disable-next-line:max-line-length
  '<svg x="0px" y="0px" width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414"><path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 3.3c1.49 0 2.7 1.21 2.7 2.7 0 1.49-1.21 2.7-2.7 2.7-1.49 0-2.7-1.21-2.7-2.7 0-1.49 1.21-2.7 2.7-2.7zM18 16H6v-.9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.9z" fill-rule="nonzero" stroke="#fff" stroke-width=".3"/><path fill="none" d="M0 0h24v24H0z"/><path d="M4.886 3.837h14.229v14.229H4.886z"/><text x="6.777" y="16.651" font-family="Roboto-Medium,Roboto" font-weight="500" font-size="16" fill="#fff">C</text></svg>';
export const pin_g_vierkant =
  // tslint:disable-next-line:max-line-length
  '<svg x="0px" y="0px" width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414"><path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 3.3c1.49 0 2.7 1.21 2.7 2.7 0 1.49-1.21 2.7-2.7 2.7-1.49 0-2.7-1.21-2.7-2.7 0-1.49 1.21-2.7 2.7-2.7zM18 16H6v-.9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.9z" fill-rule="nonzero" stroke="#fff" stroke-width=".3"/><path fill="none" d="M0 0h24v24H0z"/><path d="M4.886 3.837h14.229v14.229H4.886z"/><text x="6.555" y="16.622" font-family="Roboto-Medium,Roboto" font-weight="500" font-size="16" fill="#fff">G</text></svg>';
export const pin_w_vierkant =
  // tslint:disable-next-line:max-line-length
  '<svg x="0px" y="0px" width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414"><path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 3.3c1.49 0 2.7 1.21 2.7 2.7 0 1.49-1.21 2.7-2.7 2.7-1.49 0-2.7-1.21-2.7-2.7 0-1.49 1.21-2.7 2.7-2.7zM18 16H6v-.9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.9z" fill-rule="nonzero" stroke="#fff" stroke-width=".3"/><path fill="none" d="M0 0h24v24H0z"/><path d="M4.886 3.837h14.229v14.229H4.886z"/><text x="4.961" y="16.633" font-family="Roboto-Medium,Roboto" font-weight="500" font-size="16" fill="#fff">W</text></svg>';

export function pin_data(pin: string): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(pin);
}

export function pin_ol(pin: string, kleur: [number, number, number, number]): string {
  function vullFillIn(nodes: NodeListOf<SVGGraphicsElement>, fillKleur: string) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes.item(i);
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

  return "data:image/svg+xml;utf8," + encodeURIComponent(new XMLSerializer().serializeToString(xmlDoc.documentElement));
}
