import {
  AfterContentInit,
  Directive,
  ElementRef,
  Injector,
  Input,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { ReplaySubject } from "rxjs";

import { Laag, Laaggroep } from "../../kaart/kaart-elementen";
import { Legende } from "../../kaart/kaart-legende";
import * as prt from "../../kaart/kaart-protocol";
import {
  Opaciteit,
  Transparantie,
} from "../../transparantieeditor/transparantie";
import { TypedRecord } from "../../util/typed-record";
import { ClassicBaseDirective } from "../classic-base.directive";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";
import { ClassicLegendeItemDirective } from "../legende/classic-legende-item.directive";
import { KaartClassicMsg, logOnlyWrapper } from "../messages";
import * as val from "../webcomponent-support/params";

@Directive()
export abstract class ClassicLaagDirective
  extends ClassicBaseDirective
  implements AfterContentInit, OnDestroy, OnInit {
  legendeItems: ClassicLegendeItemDirective[] = [];

  protected laag: option.Option<Laag> = option.none;

  _titel = "";
  _stijlInLagenKiezer: option.Option<string> = option.none;
  _zichtbaar = true;
  _transparantie: Transparantie = Transparantie.opaak;
  _groep: option.Option<Laaggroep> = option.none;
  _minZoom = 2;
  _maxZoom = 16;

  private _delayedDispatch = new ReplaySubject<prt.Command<TypedRecord>>();

  @Input()
  set titel(param: string) {
    this._titel = val.str(param, this._titel);
  }

  @Input()
  set stijlInLagenKiezer(param: string) {
    this._stijlInLagenKiezer = val.optStr(param);
  }

  @Input()
  set zichtbaar(param: boolean) {
    this._zichtbaar = val.bool(param, this._zichtbaar);
  }

  @Input()
  set groep(param: Laaggroep) {
    this._groep = val.optEnu<Laaggroep>(
      param,
      "Achtergrond",
      "Voorgrond.Hoog",
      "Voorgrond.Laag",
      "Tools"
    );
  }

  @Input()
  set minZoom(param: number) {
    this._minZoom = val.num(param, this._minZoom);
  }

  @Input()
  set maxZoom(param: number) {
    this._maxZoom = val.num(param, this._maxZoom);
  }

  @Input()
  set transparantie(param: number) {
    this._transparantie = pipe(
      val.optNum(param),
      option.chain(Transparantie.fromNumber),
      option.getOrElse(() => this._transparantie)
    );
  }

  @Input()
  set opacity(param: number) {
    this._transparantie = pipe(
      val.optNum(param),
      option.chain(Opaciteit.fromNumber),
      option.map(Opaciteit.toTransparantie),
      option.getOrElse(() => this._transparantie)
    );
  }

  constructor(injector: Injector) {
    super(injector);
    const locatorService = injector.get(
      KaartClassicLocatorService
    ) as KaartClassicLocatorService<ClassicLaagDirective>;
    const el: ElementRef<Element> = injector.get<ElementRef<Element>>(
      ElementRef
    );
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

  addLegendeItem(item: ClassicLegendeItemDirective) {
    this.legendeItems.push(item);
    this.voegLegendeToe();
  }

  protected delayedDispatch(cmd: prt.Command<TypedRecord>) {
    this._delayedDispatch.next(cmd);
  }

  protected voegLaagToe() {
    const lg = this.createLayer();
    this.laag = option.some(lg);
    this.dispatch({
      type: "VoegLaagToe",
      positie: Number.MAX_SAFE_INTEGER,
      laag: lg,
      laaggroep: this.gekozenLaagGroep(),
      magGetoondWorden: this._zichtbaar,
      transparantie: this._transparantie,
      legende: option.none,
      stijlInLagenKiezer: this._stijlInLagenKiezer,
      filterinstellingen: option.none,
      laagtabelinstellingen: option.none,
      wrapper: logOnlyWrapper,
    });
    this.bindToLifeCycle(this._delayedDispatch).subscribe((cmd) =>
      this.kaart.dispatch(cmd)
    );
  }

  protected voegLegendeToe() {
    if (this.legendeItems.length > 0) {
      const legende = Legende(
        this.legendeItems.map((item) => item.maakLegendeItem())
      );
      this.delayedDispatch(
        prt.ZetLaagLegendeCmd(this._titel, legende, logOnlyWrapper)
      );
    }
  }

  protected verwijderLaag() {
    this.delayedDispatch(prt.VerwijderLaagCmd(this._titel, logOnlyWrapper));
  }

  protected gekozenLaagGroep(): Laaggroep {
    return option.getOrElse(() => this.laaggroep())(this._groep);
  }

  protected dispatch(evt: prt.Command<KaartClassicMsg>) {
    this.kaart.dispatch(evt);
  }

  abstract createLayer(): Laag;

  abstract laaggroep(): Laaggroep;
}
