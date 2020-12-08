import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";

const sendMessage = (message: any) => {
  pipe(
    option.fromNullable(navigator.serviceWorker),
    option.chain((sw) => option.fromNullable(sw.controller)),
    option.map((swc) => swc.postMessage(message)),
    option.alt(() => {
      throw new Error(
        "Geen navigator.serviceWorker.controller object gevonden. Werd ng-kaart-service-worker.js correct geïnitialiseerd?"
      );
    })
  );
};

export const registreerRoute = (cacheName: any, requestPattern: string) => {
  sendMessage({
    action: "REGISTER_ROUTE",
    payload: {
      requestPattern: requestPattern,
      cacheName: cacheName,
    },
  });
};
