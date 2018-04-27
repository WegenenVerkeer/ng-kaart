import { InjectionToken } from "@angular/core";

export const LAGENKIEZER_CFG = new InjectionToken<LagenkiezerConfig>("LagenkiezerCfg");

export interface LagenkiezerConfig {
  readonly titel?: string;
}
