import { AfterContentInit, ContentChildren, ElementRef, Injector, Input, OnDestroy, OnInit } from "@angular/core";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";

import { Laag, Laaggroep } from "../../kaart/kaart-elementen";
import { Legende } from "../../kaart/kaart-legende";
import * as prt from "../../kaart/kaart-protocol";
import * as val from "../classic-validators";

import { ClassicBaseComponent } from "../classic-base.component";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";
import { ClassicLegendeItemComponent } from "../legende/classic-legende-item.component";
import { KaartClassicMsg, logOnlyWrapper } from "../messages";

export abstract class ClassicLaagComponent extends ClassicBaseComponent implements AfterContentInit, OnDestroy, OnInit {
  @Input()
  titel = "";
  @Input()
  stijlInLagenKiezer?: string;

  legendeItems: ClassicLegendeItemComponent[] = [];

  protected laag: Option<Laag> = none;

  _zichtbaar = true;
  _groep: Laaggroep | undefined;
  _minZoom = 2;
  _maxZoom = 16;

  @Input()
  set zichtbaar(param: string | boolean) {
    val.bool(param, val => (this._zichtbaar = val));
  }

  @Input()
  set groep(param: string | Laaggroep | undefined) {
    val.enu<Laaggroep>(param, val => (this._groep = val), "Achtergrond", "Voorgrond.Hoog", "Voorgrond.Laag", "Tools");
  }

  @Input()
  set minZoom(param: string | number) {
    val.num(param, val => (this._minZoom = val));
  }

  @Input()
  set maxZoom(param: string | number) {
    val.num(param, val => (this._maxZoom = val));
  }

  constructor(injector: Injector) {
    super(injector);
    const locatorService = injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<ClassicLaagComponent>;
    const el: ElementRef<Element> = injector.get(ElementRef);
    locatorService.registerComponent(this, el);
  }

  ngOnInit() {
    super.ngOnInit();
    this.voegLaagToe(); // We gaan de laag later updaten indien nodig
  }

  ngAfterContentInit(): void {
    this.voegLegendeToe();
  }

  ngOnDestroy(): void {
    this.verwijderLaag();
    super.ngOnDestroy();
  }

  addLegendeItem(item: ClassicLegendeItemComponent) {
    this.legendeItems.push(item);
    this.voegLegendeToe();
  }

  protected voegLaagToe() {
    const lg = this.createLayer();
    this.laag = some(lg);
    this.dispatch({
      type: "VoegLaagToe",
      positie: Number.MAX_SAFE_INTEGER,
      laag: lg,
      laaggroep: this.gekozenLaagGroep(),
      magGetoondWorden: this._zichtbaar,
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
    return fromNullable(this._groep).getOrElse(this.laaggroep());
  }

  protected dispatch(evt: prt.Command<KaartClassicMsg>) {
    this.kaart.dispatch(evt);
  }

  abstract createLayer(): Laag;

  abstract laaggroep(): Laaggroep;
}
