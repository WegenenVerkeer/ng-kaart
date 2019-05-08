import { AfterViewInit, Component } from "@angular/core";

import { KaartMijnLocatieComponent, NoOpStateMachine, State, StateMachine } from "./kaart-mijn-locatie.component";

export const MijnMobieleLocatieUiSelector = "MijnMobielelocatie";

@Component({
  selector: "awv-kaart-mijn-mobiele-locatie",
  templateUrl: "./kaart-mijn-locatie.component.html",
  styleUrls: ["./kaart-mijn-locatie.component.scss"]
})
export class KaartMijnMobieleLocatieComponent extends KaartMijnLocatieComponent implements AfterViewInit {
  modus(): string {
    return MijnMobieleLocatieUiSelector;
  }

  // Dit is het statemachine van deze modus: Altijd tussen TrackingCenter en Tracking, initialstate: Tracking
  protected getStateMachine(): StateMachine {
    return {
      ...NoOpStateMachine,
      TrackingDisabled: { ...NoOpStateMachine.TrackingDisabled, ActiveerEvent: "Tracking" },
      NoTracking: { ...NoOpStateMachine.NoTracking, ActiveerEvent: "Tracking" },
      Tracking: { ...NoOpStateMachine.Tracking, ClickEvent: "TrackingCenter" },
      TrackingCenter: { ...NoOpStateMachine.TrackingCenter, ClickEvent: "Tracking", PanEvent: "Tracking" }
    };
  }
}
