import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { KaartClassicComponent } from "../kaart/kaart-classic.component";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { FormControl } from "@angular/forms";
import { KaartCmdDispatcher } from "../kaart/kaart-event-dispatcher";

@Component({
  selector: "awv-zoeker-input",
  templateUrl: "./zoeker-input.component.html",
  styleUrls: ["./zoeker-input.component.scss"]
})
export class ZoekerInputComponent implements OnInit {
  zoekVeld = new FormControl();
  @Output() toonResultaat = new EventEmitter<boolean>();
  @Output() toonHelp = new EventEmitter<boolean>();
  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg>;

  private toonHelpStatus = false;
  private toonResultaatStatus = true;

  constructor(kaart?: KaartClassicComponent) {
    if (kaart) {
      this.dispatcher = kaart;
    }
  }

  ngOnInit(): void {
    this.zoekVeld.valueChanges
      .debounceTime(800)
      .distinctUntilChanged()
      .subscribe(value => {
        this.toonResultaatStatus = true;
        this.toonResultaat.emit(this.toonResultaatStatus);
        this.dispatcher.dispatch({ type: "Zoek", input: value, wrapper: kaartLogOnlyWrapper });
      });
  }

  toggleResultaat() {
    this.toonResultaatStatus = !this.toonResultaatStatus;
    this.toonResultaat.emit(this.toonResultaatStatus);
  }

  toggleHelp() {
    this.toonHelpStatus = !this.toonHelpStatus;
    this.toonHelp.emit(this.toonHelpStatus);
  }
}
