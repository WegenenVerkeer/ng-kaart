import { Observable } from "rxjs/Observable";
import { map, filter } from "rxjs/operators";
import { Option, isSome } from "fp-ts/lib/Option";

/**
 * Transformeert waarden van A naar waarden van B mbv f, maar verhindert propagatie als
 * f undefined of null oplevert.
 *
 * @param f een transformatie van A naar B
 */
export function collect<A, B>(f: (a: A) => B): (o: Observable<A>) => Observable<B> {
  return (o: Observable<A>) =>
    o.pipe(
      map(f), //
      filter(b => b !== undefined && b !== null)
    );
}

/**
 * Transformeert waarden van optionele A's naar waarden van B mbv f indien de A's gedefinieerd zijn.
 *
 * @param f een transformatie van A naar B
 */
export function collectOption<A, B>(f: (a: A) => Option<B>): (o: Observable<A>) => Observable<B> {
  return (o: Observable<A>) =>
    o.pipe(
      map(f), //
      filter(isSome),
      map(v => v.value)
    );
}

/**
 * Transformeert waarden van optionele A's naar waarden van B mbv f indien de A's gedefinieerd zijn.
 *
 * @param f een transformatie van A naar B
 */
export const emitSome: <A>(o: Observable<Option<A>>) => Observable<A> = <A>(o: Observable<Option<A>>) =>
  o.pipe(
    filter(isSome), // emit niet als none
    map(v => v.value) // omwill van filter hierboven nooit undefined
  );

export interface TypedRecord {
  type: string;
}

export const ofType = <Target extends TypedRecord>(type: string) => (o: Observable<TypedRecord>) =>
  o.pipe(filter(a => a.type === type)) as Observable<Target>;
