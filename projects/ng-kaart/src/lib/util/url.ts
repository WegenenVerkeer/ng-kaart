/**
 * Zorgt er voor dat de url eindigt op een ?. Bedoeld om dan verder request parameters aan te hangen.
 */
export function baseWithSeparator(url: string): string {
  return url ? (url.endsWith("?") ? url : url + "?") : url;
}

/**
 * Zet een javascript object met simpele attributen om naar een query string.
 */
export function encodeParams(obj: object): string {
  return Object.keys(obj)
    .filter(key => isSimpleAttribute(obj[key]))
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]))
    .join("&");
}

export function urlWithParams(urlBase: string, params: object): string {
  return baseWithSeparator(urlBase) + encodeParams(params);
}

function isSimpleAttribute(attr: string): boolean {
  const type = typeof attr;
  return type === "boolean" || type === "number" || type === "string";
}
