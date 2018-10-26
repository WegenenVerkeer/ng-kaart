import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { concat, Curried2, Function1, tuple } from "fp-ts/lib/function";
import { Setter } from "monocle-ts";
import * as rx from "rxjs";
import { filter, map, mapTo, share, shareReplay, startWith, switchMap, take, tap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { Circle, Color, Fill, FullStyle, fullStylePrism } from "../../stijl/stijl-static-types";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import * as ss from "../stijl-selector";

import { isAanpassingBezig, LaagstijlAanpassend } from "./state";

// De hardgecodeerde kleuren
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

// Alle kleuren die dezelfde zijn als de doelkleur krijgen een gekozen veldje
interface KiesbareKleur extends clr.Kleur {
  gekozen?: boolean; // enkel voor gebruik in HTML
}
const markeerKleur: Curried2<clr.Kleur, clr.Kleur[], KiesbareKleur[]> = doelkleur => kleuren =>
  kleuren.map(kleur => (kleur.code === doelkleur.code ? { ...kleur, gekozen: true } : kleur));

// Voorlopig geven we alle lagen dezelfde, eenvoudige stijl op het kleur na
const enkelvoudigeKleurStijl: Function1<clr.Kleur, ss.Awv0StyleSpec> = kleur => ({
  type: "StaticStyle",
  definition: {
    fill: {
      color: clr.kleurcodeValue(kleur)
    },
    stroke: {
      color: clr.kleurcodeValue(kleur),
      width: 4
    },
    circle: {
      radius: 5,
      fill: {
        color: clr.kleurcodeValue(clr.setOpacity(0.75)(kleur))
      }
    }
  }
});

const stijlCmdVoorLaag: Curried2<ke.ToegevoegdeVectorLaag, clr.Kleur, prt.ZetStijlSpecVoorLaagCmd<KaartInternalMsg>> = laag => kleur =>
  prt.ZetStijlSpecVoorLaagCmd(laag.titel, enkelvoudigeKleurStijl(kleur), kaartLogOnlyWrapper);

// Op het niveau van een stijl is er geen eenvoudige kleur. We gaan dit proberen af leiden van het bolletje in de stijl.
interface AfgeleideKleur extends clr.Kleur {
  gevonden: boolean; // enkel voor gebruik in HTML
}
const gevonden: Function1<clr.Kleur, AfgeleideKleur> = kleur => ({ ...kleur, gevonden: true });
const nietGevonden: AfgeleideKleur = { ...clr.toKleurUnsafe("grijs", "#6d6d6d"), gevonden: false }; // kleurcode mag niet voorkomen in palet

// We gaan er van uit dat de stijl er een is die we zelf gezet hebben. Dat wil zeggen dat we het kleurtje van het bolletje
// uit de stijlspec  kunnen peuteren.
// We moeten vrij diep in de hierarchie klauteren om het gepaste attribuut te pakken te krijgen. Vandaar het gebruik van Lenses e.a.
const kleurViaLaag: Function1<ke.ToegevoegdeVectorLaag, AfgeleideKleur> = laag =>
  ke.ToegevoegdeVectorLaag.stijlSelBronLens
    .composeIso(ss.Awv0StaticStyleSpecIso)
    .composePrism(fullStylePrism)
    .compose(FullStyle.circleOptional)
    .compose(Circle.fillOptional)
    .composeLens(Fill.colorLens)
    .getOption(laag)
    .chain(clr.olToKleur)
    .map(gevonden)
    .getOrElse(nietGevonden);

// De setter wordt interessant op het moment dat we maar een bepaald aspect van de stijl willen aanpassen.
const zetKleur: Setter<ss.Awv0StyleSpec, clr.Kleur> = ss.Awv0StaticStyleSpecIso.composePrism(fullStylePrism)
  .composeOptional(Circle.fillOptional)
  .composeLens(Fill.colorLens)
  .compose(Color.kleurOptional)
  .asSetter();

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
  readonly paletKleuren$: rx.Observable<KiesbareKleur[]>;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    const aanpassing$: rx.Observable<LaagstijlAanpassend> = kaart.modelChanges.laagstijlaanpassingState$.pipe(
      filter(isAanpassingBezig),
      shareReplay(1)
    );
    this.titel$ = aanpassing$.pipe(
      map(state => state.laag.titel),
      shareReplay(1)
    );

    // we zouden ook de laag zelf kunnen volgen, maar in de praktijk gaat die toch niet veranderen
    const origineleKleur$ = aanpassing$.pipe(map(state => kleurViaLaag(state.laag)));
    // zetten van de nieuwe en bestaande kleuren
    const selectieKleur$ = this.actionDataFor$("kiesLaagkleur", clr.isKleur).pipe(
      map(gevonden),
      shareReplay(1)
    );
    this.laagkleur$ = rx
      .merge(
        origineleKleur$, // begin met kleur in huidige stijl
        selectieKleur$ // schakel over naar het net gekozen kleur
      )
      .pipe(shareReplay(1));

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
    this.paletKleuren$ = rx.combineLatest(this.laagkleur$, this.kleinPaletZichtbaar$, tuple).pipe(
      switchMap(([laagkleur, kp]) => (kp ? rx.of(kleurenpaletKlein) : rx.of(kleurenpaletGroot)).pipe(map(markeerKleur(laagkleur)))),
      shareReplay(1)
    );

    // Luisteren op de "pas toe" knop.
    const pasToeGeklikt$ = this.actionFor$("pasLaagstijlToe").pipe(share());
    const stijlCmd$ = aanpassing$.pipe(
      switchMap(aanpassing => selectieKleur$.pipe(map(stijlCmdVoorLaag(aanpassing.laag)))), // kleur omzetten naar commando
      take(1) // omdat er anders ook een commando gegenereerd wordt de volgende keer dat aanpassing$ een waarde emit
    );
    this.bindToLifeCycle(pasToeGeklikt$)
      .pipe(switchMap(() => stijlCmd$))
      .subscribe(cmd => this.dispatch(cmd));

    // Toepassen knop actief of niet. Uitgedrukt als een negatief statement wegens gebruik voor HTML 'disabled'.
    // Een alternatief voor gezetteKleur$ zou zijn om de state aan te passen. Dan zou origineleKleur de nieuwe waarde emitten,
    // er zouden echter neveneffecten zijn zoals sluiten van de lagenkiezer als die ondertussen open gedaan zou zijn.
    const gezetteKleur$ = rx.merge(
      origineleKleur$,
      selectieKleur$.pipe(
        // herstart wanneer er een nieuwe kleur geselecteerd is
        switchMap(selectieKleur =>
          pasToeGeklikt$.pipe(
            // selectieKleur vanaf er toegepast is
            switchMap(() => rx.of(selectieKleur))
          )
        )
      )
    );
    this.nietToepassen$ = rx.combineLatest(gezetteKleur$, selectieKleur$, clr.setoidKleurOpCode.equals).pipe(startWith(true));
  }
}
