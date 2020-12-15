import { flow, pipe } from "fp-ts/lib/function";

/**
 * Converteert een getal naar een hexadecimale voorstelling met een even aantal digits
 */
export const paddedHexBytes: (c: number) => string = (c) => {
  const hex = c.toString(16);
  return hex.length % 2 === 1 ? "0" + hex : hex;
};
/**
 * Convert een getal in het bereik [0, 255] naar een hexadecimaal getal. Als het getal groter of kleiner is,
 * dan wordt de dichtstbijzinde grens gebruikt.
 */
export const hexByte: (n: number) => string = flow(
  Math.round,
  (n) => Math.min(255, n),
  (n) => Math.max(0, n),
  paddedHexBytes
);
