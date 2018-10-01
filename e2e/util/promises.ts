import { Function1, Lazy } from "fp-ts/lib/function";
import { by, element, promise } from "protractor";

// JS Promises zijn zoals Scala Futures: eens ze aangemaakt zijn beginnen ze uit te voeren. Wij willen wachten tot we
// het resultaat nodig hebben. Vandaar dat we ze Lazy maken.
export type LazyPromise<A> = Lazy<Promise<A>>;

// Map een functie over een lazy promise
export function map<A, B>(lp: LazyPromise<A>, f: Function1<A, B>): LazyPromise<B> {
  return () => lp().then(f);
}

// Converteer een Protractor Promise naar een ES7 Promise. Op die manier kunnen we de std operaties gebruiken.
export const asPromise = <A>(a: promise.Promise<A>) =>
  new Promise<A>((resolve, reject) =>
    a.then(resolve).catch(err => {
      // console.log(">>>>", err instanceof Error, typeof err);
      if (err instanceof Error) {
        console.error(">>>>", err.message);
        if (err.message.includes("No element found using locator:")) {
          // we stoppen de error hier. Het Protractor gedrag om te stoppen wanneer een element niet bestaat is niet wenselijk.
          return;
        }
      }
      reject(err);
    })
  );

export const asLazyPromise = <A>(a: promise.Promise<A>): LazyPromise<A> => () => asPromise(a);
