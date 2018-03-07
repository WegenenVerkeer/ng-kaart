export interface ZoneLike {
  run: (fn: any, applyThis?: any, applyArgs?: any[]) => any;
  runOutsideAngular: (f: any) => any;
}
