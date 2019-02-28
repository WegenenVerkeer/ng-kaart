import { Predicate } from "fp-ts/lib/function";

export const isOfSize: (_: number) => <K, V>(_: Map<K, V>) => boolean = size => map => map.size === size;

export const isEmpty: <K, V>(_: Map<K, V>) => boolean = isOfSize(0);

export const isNonEmpty: <K, V>(_: Map<K, V>) => boolean = map => map.size > 0;

export const remove: <K, V>(_: Map<K, V>) => (_: K) => Map<K, V> = kvs => key => {
  kvs.delete(key);
  return kvs;
};

export const clear: <K, V>(_: Map<K, V>) => Map<K, V> = kvs => {
  kvs.clear();
  return kvs;
};

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
