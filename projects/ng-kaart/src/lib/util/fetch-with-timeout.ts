import { Function1, Function2, Function3 } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { map, switchMap, timeoutWith } from "rxjs/operators";

import { Pipeable } from "./operators";

const byteToText: Pipeable<Uint8Array, string> = obs => {
  const decoder = new TextDecoder();
  return obs.pipe(map(arr => decoder.decode(arr)));
};

const responseToReader: Pipeable<Response, ReadableStreamReader> = obs =>
  obs.pipe(
    map(response => {
      if (!response.ok) {
        throw Error(`Probleem bij ontvangen nosql data: status ${response.status} ${response.statusText}`);
      }
      if (!response.body) {
        throw Error(`Probleem bij ontvangen nosql data: response.body is leeg`);
      }
      if (response.status !== 200) {
        throw Error(`Probleem bij ontvangen nosql data: response status code ${response.status}`);
      }

      return response.body.getReader();
    })
  );

export const fetchObs$: Function2<string, RequestInit, rx.Observable<string>> = (url, options) =>
  rx.from(fetch(url, options)).pipe(
    responseToReader,
    switchMap(readerToObservable),
    byteToText
  );

export const fetchWithTimeoutObs$: Function3<string, RequestInit, number, rx.Observable<string>> = (url, options, timeout) =>
  rx.from(fetch(url, options)).pipe(
    responseToReader,
    switchMap(readerToObservable),
    byteToText,
    timeoutWith(timeout, rx.throwError(new Error(`Geen antwoord binnen ${timeout} ms`)))
  );

const readerToObservable: Function1<ReadableStreamReader, rx.Observable<Uint8Array>> = reader =>
  new rx.Observable(observable => {
    const push = () =>
      reader
        .read()
        .then(({ done, value }) => {
          if (!done) {
            observable.next(value);
            push();
          } else {
            reader.releaseLock();
            observable.complete();
          }
        })
        .catch(err => observable.error(err));
    push();
  });
