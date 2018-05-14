import { ChangeDetectionStrategy, Component, Input, NgZone, OnInit } from "@angular/core";
import * as rx from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { ToegevoegdeLaag } from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";
import { observeOnAngular } from "../util/observe-on-angular";

@Component({
  // Atribuut selector om geen tussentijdse dom elementen te creëeren. Die gooien roet in het eten van de CSS.
  // tslint:disable-next-line
  selector: "[awvLaagmanipulatie]",
  templateUrl: "./laagmanipulatie.component.html",
  styleUrls: ["./laagmanipulatie.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LaagmanipulatieComponent extends KaartChildComponentBase implements OnInit {
  private readonly zoom$: rx.Observable<number>;
  zichtbaar$: rx.Observable<boolean>;
  onzichtbaar$: rx.Observable<boolean>;

  @Input() laag: ToegevoegdeLaag;

  constructor(private readonly parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
    this.zoom$ = parent.modelChanges.zoomInstellingen$.pipe(map(zi => zi.zoom), distinctUntilChanged(), observeOnAngular(zone));
  }

  ngOnInit() {
    this.zichtbaar$ = this.zoom$.pipe(
      map(zoom => zoom >= this.laag.bron.minZoom && zoom <= this.laag.bron.maxZoom),
      observeOnAngular(this.zone)
    );
    this.onzichtbaar$ = this.zichtbaar$.pipe(map(m => !m));
  }

  get title(): string {
    return this.laag.titel;
  }

  get gekozen(): boolean {
    return this.laag.magGetoondWorden;
  }

  toggleGekozen() {
    this.dispatch(
      this.laag.magGetoondWorden
        ? cmd.MaakLaagOnzichtbaarCmd(this.laag.titel, kaartLogOnlyWrapper)
        : cmd.MaakLaagZichtbaarCmd(this.laag.titel, kaartLogOnlyWrapper)
    );
  }

  remove() {
    this.dispatch(cmd.VerwijderLaagCmd(this.laag.titel, kaartLogOnlyWrapper));
  }
}
