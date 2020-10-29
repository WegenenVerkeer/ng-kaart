import { HttpClient } from "@angular/common/http";
import { ChangeDetectorRef, Component, Input } from "@angular/core";
import { copyToClipboard } from "../util/clipboard";

import { kaartLogger } from "../kaart/log";

interface ServiceNowResultaat {
  readonly boodschap: string;
  readonly caseNummer?: string;
}

@Component({
  selector: "awv-servicenow-maak-case",
  templateUrl: "./servicenow-maak-case.component.html",
  styleUrls: ["./servicenow-maak-case.component.scss"],
})
export class ServicenowMaakCaseComponent {
  @Input()
  installatieId: string;

  serviceNowSuccessBoodschap = "";
  serviceNowFoutBoodschap = "";
  caseNummer: string | undefined;
  versturenBezig = false;

  constructor(
    private http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  verstuurMelding() {
    // const boodschap = this.serviceNowInputControl.value;

    this.versturenBezig = true;
    this.http
      .post<ServiceNowResultaat>("/geoloket/rest/servicenow/maak/case", {
        installatieId: this.installatieId,
      })
      .subscribe(
        (res) => {
          this.versturenBezig = false;
          this.serviceNowSuccessBoodschap = res.boodschap;
          this.serviceNowFoutBoodschap = "";
          this.caseNummer = res.caseNummer;
          this.cdr.detectChanges();
        }, //
        (err) => {
          this.versturenBezig = false;
          this.caseNummer = undefined;
          const errorboodschap = err?.error?.boodschap;
          this.serviceNowSuccessBoodschap = "";
          this.serviceNowFoutBoodschap = errorboodschap;
          kaartLogger.error(errorboodschap);
          this.cdr.detectChanges();
        }
      );
  }

  copyToClipboard(toCopy?: string) {
    if (toCopy) {
      copyToClipboard(toCopy);
    }
  }
}
