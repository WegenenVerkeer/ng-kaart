import { eq, option } from "fp-ts";
import { constant, Function1, Lazy } from "fp-ts/lib/function";

export type Progress<A> = Requested | TimedOut | Received<A>;

export type Requested = "Requested";
export type TimedOut = "TimedOut";
export interface Received<A> {
  readonly value: A;
}

export type ProgressStatus = "Requested" | "TimedOut" | "Received";

export const withProgress = <A, B>(ifRequested: Lazy<B>, ifTimedOut: Lazy<B>, ifReceived: Function1<A, B>) => (progress: Progress<A>) => {
  if (progress === "Requested") {
    return ifRequested();
  } else if (progress === "TimedOut") {
    return ifTimedOut();
  } else {
    return ifReceived(progress.value);
  }
};

export const Requested: Requested = "Requested";
export const TimedOut: TimedOut = "TimedOut";
export const Received: <A>(_: A) => Received<A> = a => ({ value: a });

export function map<A, B>(pr: Progress<A>, f: Function1<A, B>): Progress<B> {
  return withProgress<A, Progress<B>>(constant(Requested), constant(TimedOut), a => Received(f(a)))(pr);
}

export const proceed: <A>(pr1: Progress<A>, pr2: Progress<A>) => Progress<A> = (pr1, pr2) =>
  withProgress(
    () => pr2, // indien requested, vervang door opvolger
    () => pr1, // TimedOut is een finale toestand
    () => pr1 // Received is een finale toestand
  )(pr1);

export const toOption: <A>(_: Progress<A>) => option.Option<A> = withProgress(
  () => option.none, //
  () => option.none,
  a => option.some(a)
);

export const toProgressStatus: <A>(_: Progress<A>) => ProgressStatus = withProgress(
  () => "Requested" as ProgressStatus,
  () => "TimedOut" as ProgressStatus,
  () => "Received" as ProgressStatus
);

// Regels zijn vrij arbitrair, maar moet wel symmetrisch zijn: combineStatus(ps1, ps2) === combineStatus(ps2, ps1 )
export const combineStatus: (ps1: ProgressStatus, ps2: ProgressStatus) => ProgressStatus = (ps1, ps2) => {
  switch (ps1) {
    case "Requested":
      // Rq + T -> T, Rq + Rq -> Rq, Rq + Rc -> Rq
      return "Requested";
    case "TimedOut":
      // T + T -> T , T + Rq -> T , T + Rc -> T
      return ps2 === "Requested" ? "Requested" : "TimedOut";
    case "Received":
      // Rc + T -> T, Rc + Rq -> Rq, Rc + Rc -> Rc
      return ps2;
  }
};

export const setoidProgressStatus: eq.Eq<ProgressStatus> = eq.eqString;
