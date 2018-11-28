import { AfterContentInit, ContentChildren, Input, NgZone, OnDestroy, OnInit, QueryList } from "@angular/core";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";

import { KaartComponentBase } from "../../kaart/kaart-component-base";
import { Laag, Laaggroep } from "../../kaart/kaart-elementen";
import { Legende } from "../../kaart/kaart-legende";
import * as prt from "../../kaart/kaart-protocol";
import { KaartClassicComponent } from "../kaart-classic.component";
import { ClassicLegendeItemComponent } from "../legende/classic-legende-item.component";
import { KaartClassicMsg, logOnlyWrapper } from "../messages";

export abstract class ClassicLaagComponent extends KaartComponentBase implements AfterContentInit, OnDestroy, OnInit {
  @Input()
  titel = "";
  @Input()
  zichtbaar = true;
  @Input()
  groep: Laaggroep | undefined; // Heeft voorrang op std ingesteld via laaggroep
  @Input()
  minZoom = 2;
  @Input()
  maxZoom = 16;
  @Input()
  stijlInLagenKiezer?: string;

  @ContentChildren(ClassicLegendeItemComponent)
  legendeItems: QueryList<ClassicLegendeItemComponent>;

  protected laag: Option<Laag> = none;

  constructor(protected readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit() {
    super.ngOnInit();
    this.voegLaagToe(); // We gaan de laag later updaten indien nodig
  }

  ngAfterContentInit(): void {
    // De legende kan maar toegevoegd worden wanneer de child components beschikbaar zijn.
    // Zoals het nu is, ondersteunen we enkel een statische legende, enkel diegene die gedefineerd is bij de start van de laag.
    // We hebben geen use case voor het dynamische geval.
    this.voegLegendeToe();
  }

  ngOnDestroy(): void {
    this.verwijderLaag();
    super.ngOnDestroy();
  }

  protected voegLaagToe() {
    const lg = this.createLayer();
    this.laag = some(lg);
    this.dispatch({
      type: "VoegLaagToe",
      positie: Number.MAX_SAFE_INTEGER,
      laag: lg,
      laaggroep: this.gekozenLaagGroep(),
      magGetoondWorden: this.zichtbaar,
      legende: none,
      stijlInLagenKiezer: fromNullable(this.stijlInLagenKiezer),
      wrapper: logOnlyWrapper
    });
  }

  protected voegLegendeToe() {
    if (this.legendeItems.length > 0) {
      const legende = Legende(this.legendeItems.map(item => item.maakLegendeItem()));
      this.dispatch(prt.ZetLaagLegendeCmd(this.titel, legende, logOnlyWrapper));
    }
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
