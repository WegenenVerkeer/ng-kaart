import { AfterContentInit, ContentChildren, Input, NgZone, OnDestroy, OnInit, QueryList } from "@angular/core";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";

import { KaartComponentBase } from "../../kaart/kaart-component-base";
import { Laag, Laaggroep } from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import { KaartClassicComponent } from "../kaart-classic.component";
import { ClassicLegendeItemComponent } from "../legende/classic-legende-item.component";
import { KaartClassicMsg, logOnlyWrapper } from "../messages";

export abstract class ClassicLaagComponent extends KaartComponentBase implements AfterContentInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;
  @Input() groep: Laaggroep | undefined; // Heeft voorrang op std ingesteld via laaggroep
  @Input() minZoom = 2;
  @Input() maxZoom = 16;
  @Input() stijlInLagenKiezer?: string;

  @ContentChildren(ClassicLegendeItemComponent) legendeItems: QueryList<ClassicLegendeItemComponent>;

  protected voegLaagToeBijStart = true;
  protected laag: Option<Laag> = none;

  constructor(protected readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngAfterContentInit(): void {
    if (this.voegLaagToeBijStart) {
      this.voegLaagToe();
    }
  }

  ngOnDestroy(): void {
    this.verwijderLaag();
    super.ngOnDestroy();
  }

  protected voegLaagToe() {
    const legende = fromNullable(this.legendeItems)
      .map(children => ({
        items: List.of(...children.map(item => item.maakLegendeItem()))
      }))
      .filter(l => !l.items.isEmpty());
    const lg = this.createLayer();
    this.laag = some(lg);
    this.dispatch({
      type: "VoegLaagToe",
      positie: Number.MAX_SAFE_INTEGER,
      laag: lg,
      laaggroep: this.gekozenLaagGroep(),
      magGetoondWorden: this.zichtbaar,
      legende: legende,
      stijlInLagenKiezer: fromNullable(this.stijlInLagenKiezer),
      wrapper: logOnlyWrapper
    });
  }

  protected verwijderLaag() {
    this.dispatch(prt.VerwijderLaagCmd(this.titel, logOnlyWrapper));
  }

  protected gekozenLaagGroep(): Laaggroep {
    return fromNullable(this.groep).getOrElse(this.laaggroep());
  }

  protected dispatch(evt: prt.Command<KaartClassicMsg>) {
    this.kaart.dispatch(evt);
  }

  abstract createLayer(): Laag;

  abstract laaggroep(): Laaggroep;
}
