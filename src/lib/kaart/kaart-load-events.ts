export type DataLoadEvent = LoadStart | PartReceived | LoadComplete | LoadError;

export interface LoadStart {
  type: "LoadStart";
}

export interface PartReceived {
  type: "PartReceived";
}

export interface LoadComplete {
  type: "LoadComplete";
}

export interface LoadError {
  type: "LoadError";
  error: string;
}

export const LoadStart: LoadStart = { type: "LoadStart" };
export const PartReceived: PartReceived = { type: "PartReceived" };
export const LoadComplete: LoadComplete = { type: "LoadComplete" };
export const LoadError: (_: string) => LoadError = msg => ({ type: "LoadError", error: msg });
