export type Key = string | number | symbol;

export interface Kinded<K extends Key> {
  readonly kind: K;
}
