import { Function1, Function3, identity, Predicate } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";

export const isOfSize: (_: number) => <K, V>(_: Map<K, V>) => boolean = size => map => map.size === size;

export const isNonEmpty: <K, V>(_: Map<K, V>) => boolean = map => map.size > 0;

export function findFirst<K, V>(kvs: Map<K, V>, predicate: Predicate<V>): Option<V> {
  for (const entry of kvs.entries()) {
    if (predicate(entry[1])) {
      return some(entry[1]);
    }
  }
  return none;
}

export function filter<K, V>(kvs: Map<K, V>, predicate: Predicate<V>): Map<K, V> {
  const newMap = new Map<K, V>();
  for (const entry of kvs.entries()) {
    if (predicate(entry[1])) {
      newMap.set(entry[0], entry[1]);
    }
  }
  return newMap;
}

export function filterKey<K, V>(kvs: Map<K, V>, predicate: Predicate<K>): Map<K, V> {
  const newMap = new Map<K, V>();
  for (const entry of kvs.entries()) {
    if (predicate(entry[0])) {
      newMap.set(entry[0], entry[1]);
    }
  }
  return newMap;
}

export const reverse: <K, V>(_: Map<K, V>) => Map<K, V> = kvs => {
  return new Map(Array.from(kvs.entries()).reverse());
};

export const concat: <K, V>(_: Map<K, V>) => (_: Map<K, V>) => Map<K, V> = m1 => m2 =>
  new Map(Array.from(m1.entries()).concat(Array.from(m2.entries())));

export const fold: <K, V>(_: Map<K, V>) => <B>(_: Function3<K, V, B, B>) => (_: B) => B = mp => foldF => init =>
  Array.from(mp.entries()).reduce((acc, kv) => foldF(kv[0], kv[1], acc), init);

export function toMapByKeyAndValue<A, K, V>(
  array: ReadonlyArray<A>,
  keyExtractor: Function1<A, K>,
  valueExtractor: Function1<A, V>
): Map<K, V> {
  return new Map<K, V>(array.map(a => [keyExtractor(a), valueExtractor(a)] as [K, V]));
}

export function toMapByKey<K, V>(array: ReadonlyArray<V>, extractor: Function1<V, K>): Map<K, V> {
  return toMapByKeyAndValue(array, extractor, identity);
}

export const map: <A, B>(_: Function1<A, B>) => <K>(_: Map<K, A>) => Map<K, B> = f => mp =>
  toMapByKeyAndValue(Array.from(mp.entries()), e => e[0], e => f(e[1]));
