import { awvLogging, exceptionOption, tagsOption } from "@awv/awv-clientlogging";
import * as log from "loglevel";

export const kaartLogger = log.getLogger("ng-kaart");
kaartLogger.setDefaultLevel("info");

const kaartLogger2 = awvLogging.getLoggerForName("ng-kaart");
kaartLogger2.debug("debug");
kaartLogger2.info("info");
kaartLogger2.warn("warn");
kaartLogger2.warnWithOptions("warn o", tagsOption("rood", "groen"));
kaartLogger2.error("error o", { a: 1 }, exceptionOption("Kaboom"));

setTimeout(() => {
  kaartLogger2.debug("debug");
  kaartLogger2.info("info");
  kaartLogger2.warn("warn");
  kaartLogger2.error("error");
}, 15000);
