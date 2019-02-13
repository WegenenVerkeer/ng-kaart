import { Observable } from "rxjs";
import { from } from "rxjs";

function timeoutPromise(timeout: number): Promise<Response> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`Geen request binnen ${timeout} ms`)), timeout));
}

export function fetchWithTimeout(url, options, timeout): Observable<Response> {
  return from(Promise.race([fetch(url, options), timeoutPromise(timeout)]));
}
