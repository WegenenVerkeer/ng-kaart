import { option } from "fp-ts";
import * as array from "fp-ts/lib/Array";
import { Predicate } from "fp-ts/lib/function";
import * as strmap from "fp-ts/lib/StrMap";

export function find<A>(strMap: strmap.StrMap<A>, p: Predicate<A>): option.Option<A> {
  return array.head(values(strMap.filter(p)));
}

export function values<A>(strMap: strmap.StrMap<A>): Array<A> {
  return strmap.toArray(strMap).map(kv => kv[1]);
}
