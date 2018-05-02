import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { CrabZoekerConfig } from "./crab-zoeker.config";
import { ZOEKER_CFG, ZoekerConfigData } from "./zoeker.config";

export interface Gemeente {
  niscode: number;
  naam: string;
}

export interface Afdeling {
  niscode: number;
  code: string;
  naam: string;
}

export interface Sectie {
  niscode: number;
  afdelingcode: string;
  code: string;
}

export interface PerceelNummer {
  capakey: string;
  perceelsnummer: string;
}

export interface Perceel {
  capakey: string;
  perceelsnummer: string;
}

export interface PerceelDetails {
  macht: string;
  capakey: string;
  sectiecode: string;
  grondnummer: string;
  afdelingcode: string;
  bisnummer: string;
  niscode: string;
  perceelsnummer: string;
  exponent: string;
  shape: string;
  boundingbox: string;
  center: string;
}

@Injectable()
export class PerceelService {
  private readonly crabZoekerConfig: CrabZoekerConfig;

  constructor(private readonly http: HttpClient, @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData) {
    this.crabZoekerConfig = new CrabZoekerConfig(zoekerConfigData.crab);
  }

  getAlleGemeenten(): Observable<Gemeente[]> {
    return this.http.get<Gemeente[]>(this.crabZoekerConfig.url + "/rest/capakey/gemeenten");
  }

  getAfdelingen(niscode: number): Observable<Afdeling[]> {
    return this.http
      .get<Afdeling[]>(this.crabZoekerConfig.url + "/rest/capakey/afdelingen/" + niscode)
      .pipe(map(afdelingen => afdelingen.map(afdeling => ({ ...afdeling, niscode: niscode }))));
  }

  getSecties(niscode: number, afdelingcode: string): Observable<Sectie[]> {
    return this.http
      .get<Sectie[]>(this.crabZoekerConfig.url + "/rest/capakey/secties/" + niscode + "/" + afdelingcode)
      .pipe(map(secties => secties.map(sectie => ({ ...sectie, niscode: niscode, afdelingcode: afdelingcode }))));
  }

  getPerceelNummers(niscode: number, afdelingcode: string, sectiecode: string): Observable<PerceelNummer[]> {
    return this.http.get<PerceelNummer[]>(
      this.crabZoekerConfig.url + "/rest/capakey/perceelsnummers/" + niscode + "/" + afdelingcode + "/" + sectiecode
    );
  }

  getPerceelDetails(capakey: string): Observable<PerceelDetails> {
    return this.http.get<PerceelDetails>(this.crabZoekerConfig.url + "/rest/capakey/perceel/" + capakey);
  }
}
