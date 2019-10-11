import { array, option } from "fp-ts";
import { constant, Endomorphism, flow, Function1, identity, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

export type SyncUpdate<A> = Endomorphism<A>;
export type AsyncUpdate<A> = Function1<A, rx.Observable<SyncUpdate<A>>>;

export interface Update<A> {
  readonly syncUpdate: SyncUpdate<A>;
  readonly asyncUpdate: AsyncUpdate<A>;
}

export namespace Update {
  export const create: <A>(s: SyncUpdate<A>) => (a: AsyncUpdate<A>) => Update<A> = syncUpdate => asyncUpdate => ({
    syncUpdate,
    asyncUpdate
  });

  // Eigenlijk definieren we hier een paar Monoids. Nog te bezien of het voordelig is
  // dat formeel te doen.
  export const mappendS: <A>(s1: SyncUpdate<A>, s2: SyncUpdate<A>) => SyncUpdate<A> = flow;
  export const mappendA = <A>(u1: AsyncUpdate<A>, u2: AsyncUpdate<A>) => (a: A) => rx.merge(u1(a), u2(a));
  export const mappend: <A>(a1: Update<A>, a2: Update<A>) => Update<A> = (u1, u2) =>
    create(mappendS(u1.syncUpdate, u2.syncUpdate))(mappendA(u1.asyncUpdate, u2.asyncUpdate));

  export const memptyS = identity;
  export const memptyA = constant(rx.EMPTY);
  export const mempty = create<never>(memptyS)(memptyA);

  export const createSync = <A>(f: SyncUpdate<A>) => create(f)(memptyA);
  export const createAsync = <A>(f: AsyncUpdate<A>) => create(memptyS)(f) as Update<A>; // geen cast in hogere TS versie (werkt in VS code)!

  export const combineAll = <A>(...updates: Update<A>[]) => array.reduce(mempty, (us: Update<A>, u: Update<A>) => mappend(us, u))(updates);

  // Opgelet! Het predicaat wordt 2x uitgevoerd. Het is mogelijk dat het een verschillend resultaat heeft en dus dat
  // syncUpdate niet maar asyncUpdate wel uitgevoerd wordt (of omgekeerd).
  export const ifOrElse = <A>(pred: Predicate<A>) => (ifTrue: Update<A>, ifFalse: Update<A>): Update<A> => ({
    syncUpdate: (a: A) => (pred(a) ? ifTrue.syncUpdate(a) : ifFalse.syncUpdate(a)),
    asyncUpdate: (a: A) => (pred(a) ? ifTrue.asyncUpdate(a) : ifFalse.asyncUpdate(a))
  });
  export const filter = <A>(pred: Predicate<A>) => (ifTrue: Update<A>): Update<A> => ifOrElse(pred)(ifTrue, mempty);

  // Vormt een Update<A> om naar een Update<B>
  export const liftUpdate: <A, B>(
    extract: Function1<B, option.Option<A>>,
    lift: Function1<Endomorphism<A>, Endomorphism<B>>
  ) => (ua: Update<A>) => Update<B> = <A, B>(extract: Function1<B, Option<A>>, lift: Function1<Endomorphism<A>, Endomorphism<B>>) => (
    ua: Update<A>
  ) => ({
    syncUpdate: lift(ua.syncUpdate),
    asyncUpdate: flow(
      extract,
      option.fold(() => rx.EMPTY, (a: A) => ua.asyncUpdate(a).pipe(map(lift)))
    )
  });
  // interface Z {
  //   a: number;
  // }
  // const zsu: SyncUpdate<Z> = memptyS;
  // const zau: AsyncUpdate<Z> = memptyA;
  // const zu: Update<Z> = mempty;

  // const zsu2: Update<Z> = createSync((z: Z) => z);
  // const zau2: Update<Z> = createAsync(z => rx.of(z => z));
  // const sum = combineAll(zu, zsu2, zau2);
}
