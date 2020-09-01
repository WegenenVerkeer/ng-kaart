import {
  Component,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from "@angular/core";
import { Predicate } from "fp-ts/lib/function";

import {
  VerwijderUiElement,
  VoegUiElementToe,
  ZetUiElementOpties,
} from "../../kaart/kaart-protocol-commands";
import {
  defaultOpties,
  LagenUiOpties,
  LagenUiSelector,
} from "../../lagenkiezer/lagenkiezer.component";
import { asap } from "../../util/asap";
import { ClassicBaseDirective } from "../classic-base.directive";
import * as val from "../webcomponent-support/params";

/**
 * De lagenkiezer wordt getoond in het linkerpaneel en toont welke lagen er aanwezig zijn. Voor featurelagen wordt ook
 * een legende getoond. Verder kunnen lagen af en aangezet of verwijderd worden en van volgorde veranderd.
 *
 */
@Component({
  selector: "awv-kaart-lagenkiezer",
  template: "",
})
export class ClassicLagenkiezerComponent
  extends ClassicBaseDirective
  implements OnInit, OnDestroy, OnChanges {
  constructor(injector: Injector) {
    super(injector);
  }

  private _headerTitel: string = defaultOpties.headerTitel;
  private _initieelDichtgeklapt: boolean = defaultOpties.initieelDichtgeklapt;
  private _toonLegende: boolean = defaultOpties.toonLegende;
  private _toonFilters: boolean = defaultOpties.toonFilters;
  private _verwijderbareLagen: boolean = defaultOpties.verwijderbareLagen;
  private _verplaatsbareLagen: boolean = defaultOpties.verplaatsbareLagen;
  private _stijlbareVectorlagen: Predicate<string> =
    defaultOpties.stijlbareVectorlagen;
  private _filterbareLagen: boolean = defaultOpties.filterbareLagen;
  private _transparantieaanpasbareLagen: Predicate<string> =
    defaultOpties.transparantieaanpasbareLagen;

  public get headerTitel(): string {
    return this._headerTitel;
  }

  /**
   * De titel van de hoofding van de lagenkiezer. Std "Mijn legende en lagen".
   */
  @Input()
  public set headerTitel(param: string) {
    this._headerTitel = val.str(param, this._headerTitel);
  }

  public get initieelDichtgeklapt(): boolean {
    return this._initieelDichtgeklapt;
  }

  /**
   * Geeft aan of de lagenkiezer dichtgeklapt is wanneer die de eerste maal getoond wordt.
   */
  @Input()
  public set initieelDichtgeklapt(param: boolean) {
    this._initieelDichtgeklapt = val.bool(param, this._initieelDichtgeklapt);
  }

  public get toonLegende(): boolean {
    return this._toonLegende;
  }

  /**
   * Stelt in of er een tab met een legende aanwezig moet zijn. Dit vak toont standaard enkel featurelagen. Mits gebruik
   * van legende child tags, bijv. <code>&lt;awv-legende-lijn-item&gt;</code>, kunnen ook andere lagen van een legende
   * voorzien worden.
   */
  @Input()
  public set toonLegende(param: boolean) {
    this._toonLegende = val.bool(param, this._toonLegende);
  }

  public get toonFilters(): boolean {
    return this._toonFilters;
  }

  @Input()
  public set toonFilters(param: boolean) {
    this._toonFilters = val.bool(param, this._toonFilters);
  }

  public get verwijderbareLagen(): boolean {
    return this._verwijderbareLagen;
  }

  /**
   * Indien gezet kunnen gebruikers lagen verwijderen uit de kaart.
   */
  @Input()
  public set verwijderbareLagen(param: boolean) {
    this._verwijderbareLagen = val.bool(param, this._verwijderbareLagen);
  }

  public get verplaatsbareLagen(): boolean {
    return this._verplaatsbareLagen;
  }

  /**
   * Indien gezet kunnen gebruikers lagen verplaatsen van volgorde. Er zijn 2 groepen van lagen: featurelagen (groep
   * <code>"Voorgroond.hoog"</code>) en tilelagen (groep <code>"Voorgroond.laag"</code>)  Er kan enkel binnen een groep
   * verplaatst worden.
   */
  @Input()
  public set verplaatsbareLagen(param: boolean) {
    this._verplaatsbareLagen = val.bool(param, this._verplaatsbareLagen);
  }

  public get stijlbareVectorlagen(): Predicate<string> {
    return this._stijlbareVectorlagen;
  }

  /**
   * Hiermee kan een functie gezet worden die obv de titel van een laag beslist of de stijleditor aangeboden mag worden.
   * Niet bruikbaar in webcomponent mode.
   */
  @Input()
  public set stijlbareVectorlagen(param: Predicate<string>) {
    this._stijlbareVectorlagen = param;
  }

  public get filterbareLagen(): boolean {
    return this._filterbareLagen;
  }

  /**
   * Indien gezet kunnen vectorlagen gefilterd worden. Er moeten dan ook veldbeschrijvingen gezet worden.
   */
  @Input()
  public set filterbareLagen(param: boolean) {
    this._filterbareLagen = param;
  }

  public get transparantieaanpasbareLagen(): Predicate<string> {
    return this._transparantieaanpasbareLagen;
  }

  /**
   * Hiermee kan een functie gezet worden die obv de titel van een laag beslist of de transparantie-editor aangeboden
   * mag worden. Niet bruikbaar in webcomponent mode.
   */
  @Input()
  public set transparantieaanpasbareLagen(param: Predicate<string>) {
    this._transparantieaanpasbareLagen = param;
  }

  ngOnInit() {
    super.ngOnInit();
    this.kaart.dispatch(VoegUiElementToe(LagenUiSelector));
    this.kaart.dispatch(ZetUiElementOpties(LagenUiSelector, this.opties()));
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.kaart.dispatch(VerwijderUiElement(LagenUiSelector));
  }

  ngOnChanges(changes: SimpleChanges) {
    this.kaart.dispatch(ZetUiElementOpties(LagenUiSelector, this.opties()));
  }

  private opties(): LagenUiOpties {
    return {
      headerTitel: this.headerTitel,
      initieelDichtgeklapt: this.initieelDichtgeklapt,
      toonLegende: this.toonLegende,
      toonFilters: this.toonFilters,
      verwijderbareLagen: this.verwijderbareLagen,
      verplaatsbareLagen: this.verplaatsbareLagen,
      stijlbareVectorlagen: this.stijlbareVectorlagen,
      filterbareLagen: this.filterbareLagen,
      transparantieaanpasbareLagen: this.transparantieaanpasbareLagen,
    };
  }
}
