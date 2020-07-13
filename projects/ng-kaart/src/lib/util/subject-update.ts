import { eq } from "fp-ts";
import { Endomorphism } from "fp-ts/lib/function";
import * as rx from "rxjs";

export function updateBehaviorSubject<A>(subject: rx.BehaviorSubject<A>, f: Endomorphism<A>): void {
  subject.next(f(subject.getValue()));
}

export function updateBehaviorSubjectIfChanged<A>(subject: rx.BehaviorSubject<A>, eq: eq.Eq<A>, f: Endomorphism<A>): void {
  const current = subject.getValue();
  const next = f(current);
  if (!eq.equals(next, current)) {
    subject.next(next);
  }
}
