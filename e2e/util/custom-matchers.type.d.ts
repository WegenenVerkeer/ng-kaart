declare module jasmine {
  interface Matchers {
    toBeSome<A>(): boolean;
    toBeNone<A>(): boolean;
  }
}
