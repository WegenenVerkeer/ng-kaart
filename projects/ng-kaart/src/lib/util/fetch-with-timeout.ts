function timeoutPromise(timeout: number): Promise<Response> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`Geen request binnen ${timeout} ms`)), timeout));
}

export function fetchWithTimeout(url, options, timeout): Promise<Response> {
  return Promise.race([fetch(url, options), timeoutPromise(timeout)]);
}
