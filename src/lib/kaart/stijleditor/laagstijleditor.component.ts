import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { concat, Curried2, Function1, tuple } from "fp-ts/lib/function";
import { none, Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { filter, map, mapTo, shareReplay, startWith, switchMap, take, tap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { jsonAwvV0Style } from "../../stijl/json-awv-v0-stijl";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import * as ss from "../stijl-selector";

import { isAanpassingBezig, LaagstijlAanpassend } from "./state";

const kleurViaSelector: Function1<Option<ss.StyleSelector>, clr.Kleur> = maybeStyleSelector =>
  maybeStyleSelector.map(() => clr.groen).getOrElse(clr.rood);

const kleurenpaletKlein = array.catOptions([
  clr.toKleur("groen", "#46af4a"),
  clr.toKleur("geel", "#ffec16"),
  clr.toKleur("rood", "#f44336"),
  clr.toKleur("indigo", "#3d4db7"),
  clr.toKleur("bruin", "#7a5547"),
  clr.toKleur("lichtgroen", "#88d440"),
  clr.toKleur("amber", "#ffc100"),
  clr.toKleur("roze", "#eb1460"),
  clr.toKleur("blauw", "#2196f3"),
  clr.toKleur("grijs", "#9d9d9d"),
  clr.toKleur("limoengroen", "#ccdd1e"),
  clr.toKleur("oranje", "#ff9800"),
  clr.toKleur("paars", "#9c1ab1"),
  clr.toKleur("lichtblauw", "#03a9f4"),
  clr.toKleur("grijsblauw", "#5e7c8b"),
  clr.toKleur("groenblauw", "#009687"),
  clr.toKleur("donkeroranje", "#ff5505"),
  clr.toKleur("donkerpaars", "#6633b9"),
  clr.toKleur("cyaan", "#00bbd5")
]);

const kleurenpaletExtra = array.catOptions([
  clr.toKleur("grijsblauw", "#455a64"),
  clr.toKleur("grasgroen", "#388e3c"),
  clr.toKleur("zalm", "#ff6e40"),
  clr.toKleur("bordeau", "#c2185b"),
  clr.toKleur("turquoise", "#0097a7"),
  clr.toKleur("taupe", "#8d6e63"),
  clr.toKleur("donkergroen", "#1b5e20"),
  clr.toKleur("donkergeel", "#ffd740"),
  clr.toKleur("donkerrood", "#d50000"),
  clr.toKleur("donkerblauw", "#1a237e"),
  clr.toKleur("zwart", "#212121"),
  clr.toKleur("zachtgroen", "#81c784"),
  clr.toKleur("zachtgeel", "#fff59d"),
  clr.toKleur("zachtrood", "#ef5350"),
  clr.toKleur("zachtblauw", "#7986cb"),
  clr.toKleur("zachtgrijs", "#cfd8dc")
]);

const kleurenpaletGroot = concat(kleurenpaletKlein, kleurenpaletExtra);

const markeerKleur: Curried2<clr.Kleur, clr.Kleur[], clr.Kleur[]> = doelkleur => kleuren =>
  kleuren.map(kleur => ({ ...kleur, gekozen: kleur.code === doelkleur.code }));

const enkelvoudigeKleurStijl: Function1<clr.Kleur, ss.StyleSelector> = kleur =>
  ss.StaticStyle(
    jsonAwvV0Style({
      stroke: {
        color: clr.kleurRGBAValue(kleur),
        width: 4
      },
      fill: {
        color: clr.kleurRGBAValue(clr.setOpacity(0.25)(kleur))
      },
      circle: {
        fill: { color: clr.kleurRGBAValue(kleur) },
        // stroke: { color: clr.kleurRGBAValue(kleur), width: 1.25 },
        radius: 5
      }
    }).getOrElseL(errs => {
      throw new Error("Het stijlformaat is niet geldig (meer)");
    })
  );
const stijlCmdVoorLaag: Curried2<ke.ToegevoegdeVectorLaag, clr.Kleur, prt.ZetStijlVoorLaagCmd<KaartInternalMsg>> = laag => kleur =>
  prt.ZetStijlVoorLaagCmd(laag.titel, enkelvoudigeKleurStijl(kleur), none, kaartLogOnlyWrapper);

@Component({
  selector: "awv-laagstijleditor",
  templateUrl: "./laagstijleditor.component.html",
  styleUrls: ["./laagstijleditor.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LaagstijleditorComponent extends KaartChildComponentBase {
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;
  readonly laagkleur$: rx.Observable<clr.Kleur>;
  readonly kiezerZichtbaar$: rx.Observable<boolean>;
  readonly kleinPaletZichtbaar$: rx.Observable<boolean>;
  readonly grootPaletZichtbaar$: rx.Observable<boolean>;
  readonly nietToepassen$: rx.Observable<boolean>;
  readonly paletKleuren$: rx.Observable<clr.Kleur[]>;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    const aanpassing$: rx.Observable<LaagstijlAanpassend> = kaart.modelChanges.laagstijlaanpassingState$.pipe(
      filter(isAanpassingBezig),
      tap(state => console.log("****new state", state)),
      shareReplay(1)
    );
    this.titel$ = aanpassing$.pipe(map(state => state.laag.titel), shareReplay(1));

    // we zouden ook de laag zelf kunnen volgen, maar in de praktijk gaat die toch niet veranderen
    const origineleKleur$ = aanpassing$.pipe(map(state => kleurViaSelector(state.laag.stijlSel)));
    // zetten van de nieuwe en bestaande kleuren
    const selectieKleur$ = this.actionDataFor$("kiesLaagkleur", clr.isKleur).pipe(shareReplay(1));
    selectieKleur$.subscribe(kleur => console.log("****kl1", kleur));
    this.rawActionDataFor$("kiesLaagkleur").subscribe(kleur => console.log("****kl2", kleur));
    this.laagkleur$ = rx
      .merge(
        origineleKleur$, // begin met kleur in huidige stijl
        selectieKleur$ // schakel over naar het net gekozen kleur
      )
      .pipe(tap(kleur => console.log("****kleur", kleur)), shareReplay(1));

    // zichtbaarheid van hoofdpaneel
    this.zichtbaar$ = kaart.modelChanges.laagstijlaanpassingState$.pipe(map(isAanpassingBezig));
    this.bindToLifeCycle(this.actionFor$("sluitLaagstijleditor")).subscribe(() => this.dispatch(prt.StopVectorlaagstijlBewerkingCmd()));

    // zichtbaarheid voor het zijpaneel met het kleurenpalet
    this.kiezerZichtbaar$ = aanpassing$.pipe(
      // begin elke keer dat de component geopend wordt opnieuw
      switchMap(() =>
        rx.merge(
          rx.of(false), // begin onzichtbaar
          this.actionFor$("openKleineKleurkiezer").pipe(mapTo(true)), // zichtbaar als op huidig kleur geklikt
          this.actionFor$("sluitKleurkiezer").pipe(mapTo(false)), // onzichtbaar wanneer gesloten
          this.actionFor$("kiesLaagkleur").pipe(mapTo(false)) // onzichtbaar wanneer kleur gekozen
        )
      ),
      shareReplay(1)
    );

    // zichtbaarheid van de 2 kleurpaletten
    this.kleinPaletZichtbaar$ = this.kiezerZichtbaar$.pipe(
      filter(z => z), // wanneer de kiezer zichtbaar wordt
      switchMap(() =>
        rx.merge(
          rx.of(true), // in het begin zichtbaar
          this.actionFor$("openGroteKleurkiezer").pipe(mapTo(false)) // sluit wanneer groot palet gevraagd wordt
        )
      ),
      shareReplay(1)
    );
    this.grootPaletZichtbaar$ = this.kleinPaletZichtbaar$.pipe(map(z => !z));

    // voeg "gekozen" attribuut toe aan de kleur van het palet zodat we het vinkje kunnen zetten
    this.paletKleuren$ = rx
      .combineLatest(this.laagkleur$, this.kleinPaletZichtbaar$, tuple)
      .pipe(
        switchMap(([laagkleur, kp]) => (kp ? rx.of(kleurenpaletKlein) : rx.of(kleurenpaletGroot)).pipe(map(markeerKleur(laagkleur)))),
        shareReplay(1)
      );

    // Toepassen knop actief of niet. Uitgedrukt als een negatief statement wegens gebruik voor HTML 'disabled'.
    this.nietToepassen$ = rx.combineLatest(origineleKleur$, selectieKleur$, clr.setoidKleurOpCode.equals).pipe(startWith(true));

    // Luisteren op de "pas toe" knop. de take(1) is er.
    const stijlCmd$ = aanpassing$.pipe(
      switchMap(aanpassing => selectieKleur$.pipe(map(stijlCmdVoorLaag(aanpassing.laag)))), // kleur omzetten naar commando
      take(1) // omdat er anders ook een commando gegenereerd wordt de volgende keer dat aanpassing$ een waarde emit
    );
    this.bindToLifeCycle(this.actionFor$("pasLaagstijlToe"))
      .pipe(switchMap(() => stijlCmd$))
      .subscribe(cmd => this.dispatch(cmd));
  }
}
