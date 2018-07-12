export const LoadStart = "LoadStart";
export const PartReceived = "ChunkReceived";
export const LoadComplete = "LoadComplete";
export const LoadError = "LoadError";
export type DataLoadEvent = typeof LoadStart | typeof PartReceived | typeof LoadComplete | typeof LoadError;
