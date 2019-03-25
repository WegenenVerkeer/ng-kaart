import { Function1, Lazy } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";

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
  return withProgress<A, Progress<B>>(() => Requested, () => TimedOut, a => Received(f(a)))(pr);
}

export const proceed: <A>(pr1: Progress<A>, pr2: Progress<A>) => Progress<A> = (pr1, pr2) =>
  withProgress(
    () => pr2, // indien requested, vervang door opvolger
    () => pr1, // timedout is een finale toestand
    () => pr1 // received is een finale toestand
  )(pr1);

export const toOption: <A>(_: Progress<A>) => Option<A> = withProgress(
  () => none, //
  () => none,
  a => some(a)
);

export const toProgressStatus: <A>(_: Progress<A>) => ProgressStatus = withProgress(
  () => "Requested" as ProgressStatus,
  () => "TimedOut" as ProgressStatus,
  () => "Received" as ProgressStatus
);

export const combineStatus: <A>(ps1: ProgressStatus, ps2: ProgressStatus) => ProgressStatus = (ps1, ps2) => {
  switch (ps1) {
    case "Requested":
      return "Requested";
    case "TimedOut":
      return ps2 === "Requested" ? "Requested" : "TimedOut"; // vrij arbitrair, maar moet wel symmetrisch zijn
    case "Received":
      return ps2;
  }
};
