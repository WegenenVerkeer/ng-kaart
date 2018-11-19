declare namespace jasmine {
  interface Matchers<T> {
    toBeSome<A>(): boolean;
    toBeNone<A>(): boolean;
  }
}
