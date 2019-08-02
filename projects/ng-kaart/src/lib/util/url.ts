export function urlWithParams(urlBase: string, params: object): string {
  const parsed = new URL(urlBase, window.location.href);
  const searchParams = parsed.searchParams;
  Object.keys(params)
    .filter(key => isSimpleAttribute(params[key]))
    .forEach(key => searchParams.set(key, params[key]));
  parsed.search = searchParams.toString();
  return parsed.href;
}

function isSimpleAttribute(attr: string): boolean {
  const type = typeof attr;
  return type === "boolean" || type === "number" || type === "string";
}

export function encodeAsSvgUrl(pin: string): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(pin);
}
