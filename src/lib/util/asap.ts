/**
 * Voer een functie, met side-effects, zo snel als mogelijk uit nadat de huidige call-stack afgehandeld is.
 * @param f De actie om uit te voeren.
 */
export const asap = (f: () => any) => setTimeout(f, 0);
