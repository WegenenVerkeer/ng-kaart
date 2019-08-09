import { awvLogging, LogLevel } from "@awv/awv-clientlogging";
import * as log from "loglevel";

export const kaartLogger = log.getLogger("ng-kaart");
kaartLogger.setDefaultLevel("info");

const kaartLogger2 = awvLogging.getLoggerForName("ng-kaart");
kaartLogger2.debug("debug");
kaartLogger2.info("info");
kaartLogger2.warn("warn");
kaartLogger2.error("error");

setTimeout(() => {
  kaartLogger2.debug("debug");
  kaartLogger2.info("info");
  kaartLogger2.warn("warn");
  kaartLogger2.error("error");
}, 15000);
