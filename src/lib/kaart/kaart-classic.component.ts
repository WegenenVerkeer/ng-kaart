import { Component, ElementRef, Input, NgZone, OnDestroy, OnInit, OnChanges, SimpleChanges } from "@angular/core";
import { ReplaySubject } from "rxjs/ReplaySubject";

import { CoordinatenService } from "./coordinaten.service";
import { KaartEventDispatcher } from "./kaart-event-dispatcher";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol-events";

@Component({
  selector: "awv-kaart-classic",
  templateUrl: "./kaart-classic.component.html"
})
export class KaartClassicComponent implements OnInit, OnDestroy, OnChanges {
  @Input() zoom = 2;
  @Input() minZoom = 2; // TODO moet nog doorgegeven worden
  @Input() maxZoom = 13;
  @Input() middelpunt: ol.Coordinate = [130000, 184000]; // "extent" heeft voorrang
  @Input() breedte; // neem standaard de hele breedte in
  @Input() hoogte = 400;
  @Input() extent: ol.Extent = [18000.0, 152999.75, 280144.0, 415143.75];

  // We gebruiken ReplaySubjects omdat de observer van de subjects nog niet bestaat op het moment dat de component geïnitialiseerd wordt
  readonly zoomSubj = new ReplaySubject<number>(1);
  readonly extentSubj = new ReplaySubject<ol.Extent>(1);
  readonly viewportSizeSubj = new ReplaySubject<ol.Size>(1);

  readonly dispatcher: KaartEventDispatcher = new KaartEventDispatcher();

  constructor(private readonly zone: NgZone, private readonly coordinatenService: CoordinatenService) {}

  ngOnInit() {
    this.zoomSubj.next(this.zoom);
    this.extentSubj.next(this.extent);
    this.viewportSizeSubj.next([this.breedte, this.hoogte]);
  }

  ngOnDestroy() {}

  ngOnChanges(changes: SimpleChanges) {
    if ("zoom" in changes) {
      this.zoomSubj.next(changes.zoom.currentValue);
    }
    if ("middelpunt" in changes) {
      this.dispatcher.dispatch(new prt.MiddelpuntChanged(changes.middelpunt.currentValue));
    }
    if ("extent" in changes) {
      this.extentSubj.next(changes.extent.currentValue);
    }
    if ("breedte" in changes) {
      this.viewportSizeSubj.next([changes.breedte.currentValue, this.hoogte]);
    }
    if ("hoogte" in changes) {
      this.viewportSizeSubj.next([this.breedte, changes.hoogte.currentValue]);
    }
  }

  voegControlToe(control: ol.control.Control): ol.control.Control {
    return this.voegControlsToe([control])[0];
  }

  voegControlsToe(controls: ol.control.Control[]): ol.control.Control[] {
    // this.runAsapOutsideAngular(() => controls.forEach(c => this.kaart.addControl(c)));
    return controls;
  }

  verwijderControl(control: ol.control.Control) {
    this.verwijderControls([control]);
  }

  verwijderControls(controls: ol.control.Control[]) {
    // this.runAsapOutsideAngular(() => controls.forEach(c => this.kaart.removeControl(c)));
  }

  voegInteractionToe(interaction: ol.interaction.Interaction): ol.interaction.Interaction {
    return this.voegInteractionsToe([interaction])[0];
  }

  voegInteractionsToe(interactions: ol.interaction.Interaction[]): ol.interaction.Interaction[] {
    // this.runAsapOutsideAngular(() => interactions.forEach(i => this.kaart.addInteraction(i)));
    return interactions;
  }

  verwijderInteraction(interaction: ol.interaction.Interaction) {
    this.verwijderInteractions([interaction]);
  }

  verwijderInteractions(interactions: ol.interaction.Interaction[]) {
    // this.runAsapOutsideAngular(() => interactions.forEach(i => this.kaart.removeInteraction(i)));
  }
}
