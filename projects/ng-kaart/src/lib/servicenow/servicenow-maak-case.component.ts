import { animate, style, transition, trigger } from "@angular/animations";
import { HttpClient } from "@angular/common/http";
import { Component, Input } from "@angular/core";
import { FormControl, Validators } from "@angular/forms";

import { kaartLogger } from "../kaart/log";

interface ServiceNowResultaat {
  readonly boodschap: string;
  readonly caseNummer?: string;
}

@Component({
  selector: "awv-servicenow-maak-case",
  templateUrl: "./servicenow-maak-case.component.html",
  styleUrls: ["./servicenow-maak-case.component.scss"],
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ opacity: 0, "max-height": 0 }),
        animate(
          "0.35s cubic-bezier(.62,.28,.23,.99)",
          style({ opacity: 1, "max-height": "400px" })
        ),
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "400px" }),
        animate(
          "0.35s cubic-bezier(.62,.28,.23,.99)",
          style({ opacity: 0, "max-height": 0 })
        ),
      ]),
    ]),
  ],
})
export class ServicenowMaakCaseComponent {
  @Input()
  installatieId: string;

  serviceNowSuccessBoodschap = "";
  serviceNowFoutBoodschap = "";

  toonServiceNowCaseForm = false;
  serviceNowInputControl = new FormControl("", [Validators.required]);

  constructor(private http: HttpClient) {}

  toggleToonCaseForm() {
    this.toonServiceNowCaseForm = !this.toonServiceNowCaseForm;
    this.serviceNowInputControl.setValue("");
  }

  verstuurMelding() {
    const boodschap = this.serviceNowInputControl.value;

    this.http
      .post<ServiceNowResultaat>("/geoloket/rest/servicenow/maak/case", {
        installatieId: this.installatieId,
        omschrijving: boodschap,
      })
      .subscribe(
        (res) => {
          this.serviceNowSuccessBoodschap = res.boodschap;
          this.serviceNowFoutBoodschap = "";
          this.toggleToonCaseForm();
        }, //
        (err) => {
          const errorboodschap = `Kon ServiceNow case niet aanmaken: ${err.boodschap}`;
          this.serviceNowSuccessBoodschap = "";
          this.serviceNowFoutBoodschap = errorboodschap;
          kaartLogger.error(errorboodschap);
        }
      );
  }
}
