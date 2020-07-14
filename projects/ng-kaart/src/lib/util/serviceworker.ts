import { option } from "fp-ts";

const sendMessage = (message: any) => {
  option
    .fromNullable(navigator.serviceWorker)
    .chain(sw => option.fromNullable(sw.controller))
    .map(swc => swc.postMessage(message))
    .orElse(() => {
      throw new Error("Geen navigator.serviceWorker.controller object gevonden. Werd ng-kaart-service-worker.js correct geïnitialiseerd?");
    });
};

export const registreerRoute = (cacheName: any, requestPattern: string) => {
  sendMessage({
    action: "REGISTER_ROUTE",
    payload: {
      requestPattern: requestPattern,
      cacheName: cacheName
    }
  });
};
