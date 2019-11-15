import { option } from "fp-ts";
import { Endomorphism, Function1, Function3, identity, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";

export const isOfSize: (_: number) => <K, V>(_: Map<K, V>) => boolean = size => map => map.size === size;

export const isNonEmpty: <K, V>(_: Map<K, V>) => boolean = map => map.size > 0;

export function findFirst<K, V>(kvs: Map<K, V>, predicate: Predicate<V>): Option<V> {
  for (const entry of kvs.entries()) {
    if (predicate(entry[1])) {
      return option.some(entry[1]);
    }
  }
  return option.none;
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

export function set<V>(kvs: Map<string, V>, key: string, value: V): Map<string, V> {
  const newMap = new Map<string, V>(kvs.entries());
  newMap.set(key, value);
  return newMap;
}

export function modify<V>(kvs: Map<string, V>, key: string, f: Endomorphism<V>): Map<string, V> {
  return pipe(
    kvs.get(key),
    option.fromNullable,
    option.fold(() => kvs, value => set(kvs, key, f(value)))
  );
}

export function mapValues<K, A, B>(kvs: Map<K, A>, f: Function1<A, B>): Map<K, B> {
  return new Map<K, B>(Array.from(kvs.entries()).map(e => [e[0], f(e[1])] as [K, B]));
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

export const values: <K, A>(_: Map<K, A>) => A[] = mp => Array.from(mp.values());
