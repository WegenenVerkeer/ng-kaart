import { Function3, Predicate } from "fp-ts/lib/function";

export const isOfSize: (_: number) => <K, V>(_: Map<K, V>) => boolean = size => map => map.size === size;

export const isNonEmpty: <K, V>(_: Map<K, V>) => boolean = map => map.size > 0;

export const find: <K, V>(_: Map<K, V>) => (_: Predicate<V>) => V | undefined = kvs => pred => {
  kvs.forEach(v => {
    if (pred(v)) {
      return v;
    }
  });
  return undefined;
};

export const filter: <K, V>(_: Map<K, V>) => (_: Predicate<V>) => Map<K, V> = kvs => pred => {
  const newMap = new Map();
  kvs.forEach((v, k) => {
    if (pred(v)) {
      newMap.set(k, v);
    }
  });
  return newMap;
};

export const reverse: <K, V>(_: Map<K, V>) => Map<K, V> = kvs => {
  return new Map(Array.from(kvs.entries()).reverse());
};

export const concat: <K, V>(_: Map<K, V>) => (_: Map<K, V>) => Map<K, V> = m1 => m2 =>
  new Map(Array.from(m1.entries()).concat(Array.from(m2.entries())));

export const fold: <K, V>(_: Map<K, V>) => <B>(_: Function3<K, V, B, B>) => (_: B) => B = mp => foldF => init =>
  Array.from(mp.entries()).reduce((acc, kv) => foldF(kv[0], kv[1], acc), init);
