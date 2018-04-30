import { Injectable, Inject } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { HttpClient } from "@angular/common/http";
import { ZOEKER_CFG, ZoekerConfigData } from "./zoeker.config";
import { CrabZoekerConfig } from "./crab-zoeker.config";

export interface PerceelGemeente {
  niscode: number;
  naam: string;
}

@Injectable()
export class PerceelService {
  private readonly crabZoekerConfig: CrabZoekerConfig;

  constructor(private readonly http: HttpClient, @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData) {
    this.crabZoekerConfig = new CrabZoekerConfig(zoekerConfigData.crab);
  }

  getAlleGemeenten(): Observable<PerceelGemeente[]> {
    return this.http.get<PerceelGemeente[]>(this.crabZoekerConfig.url + "/rest/capakey/gemeenten");
  }
}
