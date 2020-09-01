import * as rx from "rxjs";

export function exponentialTimer(
  firstDelay: number,
  periodBase: number
): rx.Observable<number> {
  return rx.Observable.create((observer) => {
    const trigger = new rx.ReplaySubject<[number, number]>();
    const subscription2 = trigger.subscribe(([delay, n]) => {
      observer.next(n);
      rx.timer(delay * periodBase).subscribe(() =>
        trigger.next([delay * 2, n + 1])
      ); // zou ook unsubscribed moeten worden
    });
    const subscription1 = rx
      .timer(firstDelay)
      .subscribe(() => trigger.next([1, 0]));
    return () => {
      subscription1.unsubscribe();
      subscription2.unsubscribe();
    };
  });
}
