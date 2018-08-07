import { Endomorphism } from "fp-ts/lib/function";
import * as rx from "rxjs";

export function updateBehaviorSubject<A>(subject: rx.BehaviorSubject<A>, f: Endomorphism<A>): void {
  subject.next(f(subject.getValue()));
}
