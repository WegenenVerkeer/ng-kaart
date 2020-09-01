import { animate, style, transition, trigger } from "@angular/animations";
import { HttpClient } from "@angular/common/http";
import { Component, Input } from "@angular/core";
import { FormControl, Validators } from "@angular/forms";

import { kaartLogger } from "../kaart/log";

interface AbbameldaResultaat {
  readonly resultaat: string;
}

@Component({
  selector: "awv-abbamelda-stuur-melding",
  templateUrl: "./abbamelda-stuurmelding.component.html",
  styleUrls: ["./abbamelda-stuurmelding.component.scss"],
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
export class AbbameldaStuurmeldingComponent {
  @Input()
  abbamelda_onderdeel: string;
  @Input()
  abbamelda_pad: string;

  abbameldaSuccesBoodschap = "";
  abbameldaFoutBoodschap = "";

  toonAbbameldaMeldingForm = false;
  abbameldaMeldingInputControl = new FormControl("", [Validators.required]);

  constructor(private http: HttpClient) {}

  toggleVerstuurAbbameldaMelding() {
    this.toonAbbameldaMeldingForm = !this.toonAbbameldaMeldingForm;
    this.abbameldaMeldingInputControl.setValue("");
  }

  verstuurMelding() {
    const boodschap = this.abbameldaMeldingInputControl.value;

    this.http
      .post<AbbameldaResultaat>("/geoloket/rest/abbamelda/melding", {
        melding: boodschap,
        onderdeel: this.abbamelda_onderdeel,
        pad: this.abbamelda_pad,
      })
      .subscribe(
        (res) => {
          this.abbameldaSuccesBoodschap = res.resultaat;
          this.abbameldaFoutBoodschap = "";
          this.toggleVerstuurAbbameldaMelding();
        }, //
        (err) => {
          const errorboodschap = `Kon Abbamelda melding niet versturen: ${err.error.resultaat}`;
          this.abbameldaSuccesBoodschap = "";
          this.abbameldaFoutBoodschap = errorboodschap;
          kaartLogger.error(errorboodschap);
        }
      );
  }
}
