import { Function1, Function2, Function3 } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { Pipeable } from "./operators";

const byteToText: Pipeable<Uint8Array, string> = obs => obs.pipe(map(arr => new TextDecoder().decode(arr)));

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
  rx.from(fetchWithTimeout(url, options, timeout)).pipe(
    responseToReader,
    switchMap(readerToObservable),
    byteToText
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
            observable.complete();
          }
        })
        .catch(err => observable.error(err));
    push();
  });

const timeoutPromise: Function1<number, Promise<Response>> = timeout =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Geen request binnen ${timeout} ms`)), timeout));

const fetchWithTimeout: Function3<string, RequestInit, number, Promise<Response>> = (url, options, timeout) =>
  Promise.race([fetch(url, options), timeoutPromise(timeout)]);
