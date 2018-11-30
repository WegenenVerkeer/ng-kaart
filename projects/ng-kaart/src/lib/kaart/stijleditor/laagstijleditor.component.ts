import { ChangeDetectionStrategy, Component, ElementRef, NgZone, QueryList, ViewChildren, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatTabChangeEvent } from "@angular/material";
import * as array from "fp-ts/lib/Array";
import { Curried2, Function1, Function2, Lazy, Predicate, Refinement, tuple } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import * as rx from "rxjs";
import { delay, filter, map, mapTo, sample, scan, shareReplay, startWith, switchMap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { forEach } from "../../util";
import { expand2 } from "../../util/function";
import { collectOption, forEvery, scan2, skipOlder } from "../../util/operators";
import { negate } from "../../util/thruth";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import { Legende } from "../kaart-legende";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { AwvV0StyleSpec } from "../stijl-selector";

import { EnkeleKleur, KleurPerVeldwaarde, VeldProps, VeldwaardeKleur } from "./model";
import { kleurenpaletGroot, kleurenpaletKlein } from "./palet";
import { isAanpassingBezig, isAanpassingNietBezig, LaagstijlAanpassend } from "./state";
import {
  enkeleKleurToLegende,
  enkeleKleurToStijlSpec,
  enkeleKleurViaLaag,
  kleurPerVeldwaardeToLegende,
  kleurPerVeldWaardeToStijlSpec,
  kleurPerVeldwaardeViaLaagEnVeldnaam,
  kleurveldnaamViaLaag,
  veldenMetUniekeWaarden
} from "./stijl-manip";

const enkeleKleurStijlEnLegende: Curried2<ke.ToegevoegdeLaag, EnkeleKleur, [AwvV0StyleSpec, Legende]> = laag =>
  expand2(enkeleKleurToStijlSpec, enkeleKleurToLegende(laag.titel));

const opVeldWaardeStijlEnLegende: Function1<KleurPerVeldwaarde, [AwvV0StyleSpec, Legende]> = expand2(
  kleurPerVeldWaardeToStijlSpec,
  kleurPerVeldwaardeToLegende
);

const stijlCmdVoorLaag: Curried2<
  ke.ToegevoegdeVectorLaag,
  [AwvV0StyleSpec, Legende],
  prt.ZetStijlSpecVoorLaagCmd<KaartInternalMsg>
> = laag => ([stijl, legende]) => prt.ZetStijlSpecVoorLaagCmd(laag.titel, stijl, legende, kaartLogOnlyWrapper);

const enum StijlMode {
  EnkeleKleur,
  OpVeldWaarde
}

// We willen in de UI zo weinig mogelijk weten over wat er nu juist aangepast moet worden. Het kan de kleur
// van alle features, die voor een waarde van een featureveld of de terugvalkleur zijn. Om aan de kant van
// de component toch te weten waarover het gaat (en tegelijkertijd uniform te kunnen werken) laten we de UI
// het context object dat hij krijgt om te renderen gewoon terug geven wanneer er geklikt wordt.
// Er zijn 3 fases:
// 1. tonen van de huidige waarde in een lijst (van 1 element in geval van enkele kleur)
// 2. tonen van de kleurkiezer
// 3. kiezen van een kleur in de kleurkiezer
// De context wordt telkens doorgegeven
// Vergelijk dit met de de meer traditionele aanpak waar er gewoon met kliks zonder meer gewerkt wordt. We moeten
// dan onthouden op welke waarde er geklikt werd om dan op het moment dat de klik verwerkt wordt, de gekozen kleur
// te koppelen aan de correcte waarde. We moeten dan een Observable laatstSelecteerd oid hebben.
// Nu is dat veel eenvoudiger. Op het moment dat een klik terug komt, hebben we meteen de volledige context mee.
interface TargetCtx {
  enkeleKleur?: any;
  veldwaarde?: string;
  terugval?: any;
}

interface KleurWijzigTarget extends TargetCtx {
  kleur: clr.Kleur;
  label: string;
  afgeleid: boolean;
}

const enkeleKleurToTargetCtx: Curried2<ke.ToegevoegdeLaag, EnkeleKleur, KleurWijzigTarget[]> = laag => uk => [
  { kleur: uk.kleur, label: laag.titel, afgeleid: uk.afgeleid, enkeleKleur: {} }
];

const kleurPerVeldwaardeToTargetCtx: Function1<KleurPerVeldwaarde, KleurWijzigTarget[]> = kpv =>
  array.snoc(
    kpv.waardekleuren.map(
      wk => ({ kleur: wk.kleur, label: wk.waarde, afgeleid: kpv.afgeleid, veldwaarde: wk.waarde } as KleurWijzigTarget)
    ),
    { kleur: kpv.terugvalkleur, label: "Andere", afgeleid: kpv.afgeleid, terugval: {} }
  );

interface ClickContext extends TargetCtx {
  kleur: clr.Kleur;
  gekozen: boolean;
}

// 3 Interfaces voor de clicks die een kleur kiezen in de kleurkiezer
interface EnkeleKleurClick {
  kleur: clr.Kleur;
}

interface VeldwaardeClick {
  kleur: clr.Kleur;
  veldwaarde: string;
}

interface TerugvalClick {
  kleur: clr.Kleur;
}

const isKleurWijzigClick: Refinement<object, KleurWijzigTarget> = (uc): uc is KleurWijzigTarget => uc.hasOwnProperty("kleur");
const isEnkeleSelectie: Refinement<object, EnkeleKleurClick> = (uc): uc is EnkeleKleurClick => uc.hasOwnProperty("enkeleKleur");
const isVeldwaardekleurSelectie: Refinement<object, VeldwaardeClick> = (vwk): vwk is VeldwaardeClick => vwk.hasOwnProperty("veldwaarde");
const isTerugvalkleurSelectie: Refinement<object, TerugvalClick> = (tc): tc is TerugvalClick => tc.hasOwnProperty("terugval");

@Component({
  selector: "awv-laagstijleditor",
  templateUrl: "./laagstijleditor.component.html",
  styleUrls: ["./laagstijleditor.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LaagstijleditorComponent extends KaartChildComponentBase {
  private readonly stijlModeSubj: rx.Subject<StijlMode> = new rx.Subject();

  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;
  readonly laagkleuren$: rx.Observable<KleurWijzigTarget[]>;
  readonly kiezerZichtbaar$: rx.Observable<boolean>;
  readonly kleinPaletZichtbaar$: rx.Observable<boolean>;
  readonly nietToepassen$: rx.Observable<boolean>;
  readonly paletKleuren$: rx.Observable<ClickContext[]>;
  readonly kiezerStyle$: rx.Observable<object>;
  readonly klasseVelden$: rx.Observable<VeldProps[]>;
  readonly klasseVeldenBeschikbaar$: rx.Observable<boolean>;
  readonly klasseVeldenNietBeschikbaar$: rx.Observable<boolean>;

  readonly veldControl = new FormControl({ value: "", disabled: false });

  @ViewChildren("editor")
  editorElement: QueryList<ElementRef>; // QueryList omdat enkel beschikbaar wanneer ngIf true is

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    ///////////////////////
    // Basistoestand & info
    //

    const editorElement$ = this.viewReady$.pipe(
      switchMap(() => this.editorElement.changes),
      filter(ql => ql.length > 0),
      map(ql => ql.first.nativeElement)
    );

    const aanpassing$: rx.Observable<LaagstijlAanpassend> = kaart.modelChanges.laagstijlaanpassingState$.pipe(
      filter(isAanpassingBezig),
      shareReplay(1) // Alle observables die later subscriben (en er zijn er veel) moeten de huidige toestand kennen.
    );
    const geenAanpassing$ = kaart.modelChanges.laagstijlaanpassingState$.pipe(filter(isAanpassingNietBezig));

    const restartAt: (_: rx.Observable<any>) => <A>(_: Lazy<rx.Observable<A>>) => rx.Observable<A> = restarter => lObs =>
      restarter.pipe(switchMap(() => lObs().pipe(skipOlder())));

    const startAtOpen: <A>(_: Lazy<rx.Observable<A>>) => rx.Observable<A> = restartAt(aanpassing$);

    const stijlMode$: rx.Observable<StijlMode> = startAtOpen(() => this.stijlModeSubj.asObservable()).pipe(
      startWith(StijlMode.EnkeleKleur),
      shareReplay(1)
    );

    const selectByMode: <A>(_1: rx.Observable<A>, _2: rx.Observable<A>) => rx.Observable<A> = (enkeleKleurObs, OpVeldWaardeObs) =>
      forEvery(stijlMode$)(actueleMode => {
        switch (actueleMode) {
          case StijlMode.EnkeleKleur:
            return enkeleKleurObs;
          case StijlMode.OpVeldWaarde:
            return OpVeldWaardeObs;
        }
      });

    const findLaagOpTitel: Function2<string, ke.ToegevoegdeLaag[], Option<ke.ToegevoegdeVectorLaag>> = (titel, lgn) =>
      array.findFirst(lgn.filter(lg => lg.titel === titel), ke.isToegevoegdeVectorLaag);
    const laag$: rx.Observable<ke.ToegevoegdeVectorLaag> = forEvery(aanpassing$)(aanpassing =>
      kaart.modelChanges.lagenOpGroep
        .get(aanpassing.laag.laaggroep)
        .pipe(collectOption(lgn => findLaagOpTitel(aanpassing.laag.titel, lgn.toArray())))
    ).pipe(
      shareReplay(1) // De huidige laag moet bewaard blijven voor alle volgende subscribers
    );
    this.titel$ = laag$.pipe(map(laag => laag.titel));
    const forEveryLaag = forEvery(laag$);

    //////////////////
    // Het paneel zelf
    //
    this.zichtbaar$ = kaart.modelChanges.laagstijlaanpassingState$.pipe(map(isAanpassingBezig));
    this.bindToLifeCycle(this.actionFor$("sluitLaagstijleditor")).subscribe(() => this.dispatch(prt.StopVectorlaagstijlBewerkingCmd()));

    /////////////////
    // Enkele kleur
    //

    // zet de startkleur elke keer dat we naar de EnkeleKleur mode schakelen
    const initieleEnkeleKleur$: rx.Observable<EnkeleKleur> = laag$.pipe(map(enkeleKleurViaLaag));
    // zetten van de nieuwe en bestaande kleuren
    const enkeleKleurSelectie$: rx.Observable<EnkeleKleurClick> = this.actionDataFor$("kiesKleur", isEnkeleSelectie);
    const enkeleKleurSelectieKleur$ = enkeleKleurSelectie$.pipe(map(uc => uc.kleur));
    const enkeleKleur$ = forEvery(initieleEnkeleKleur$)(instelling =>
      enkeleKleurSelectieKleur$.pipe(
        scan(EnkeleKleur.zetKleur, EnkeleKleur.makeAfgeleid(instelling)),
        startWith(instelling), // scan emit de start state niet
        shareReplay(1)
      )
    );

    //////////////
    // Klassekleur
    //
    this.klasseVelden$ = laag$.pipe(map(veldenMetUniekeWaarden));
    this.klasseVeldenNietBeschikbaar$ = this.klasseVelden$.pipe(map(array.isEmpty));
    this.klasseVeldenBeschikbaar$ = this.klasseVeldenNietBeschikbaar$.pipe(map(negate)); // Beter berekingen doen in component dan in UI

    // We willen dat de veld dropdown opgevuld wordt met de waarde die voorheen gekozen was (als die er is)
    const isStillAvailable: Function1<string[], Predicate<string>> = bechikbareVeldnamen => veldnaam =>
      array.member(setoidString)(bechikbareVeldnamen, veldnaam);
    this.bindToLifeCycle(
      rx
        .combineLatest(laag$.pipe(map(kleurveldnaamViaLaag)), this.klasseVelden$, tuple)
        .pipe(map(([maybeVeldnaam, bechikbareVeldinfos]) => maybeVeldnaam.filter(isStillAvailable(bechikbareVeldinfos.map(vi => vi.naam)))))
    ).subscribe(maybeVeldnaam => forEach(maybeVeldnaam, veldnaam => this.veldControl.setValue(veldnaam)));

    // We willen ook weten welk veld de gebruiker aangeduid heeft
    const veldnaam$ = forEveryLaag(() =>
      this.veldControl.valueChanges.pipe(
        startWith(this.veldControl.value), // valueChanges emit niet wanneer we naar de dialoog terugkeren nadat hij gesloten was
        shareReplay(1) // ook voor toekomstige subscribers
      )
    );

    // De instelling zoals ze zijn wanneer we naar de laag schakelen en een veld selecteren
    const initieleKleurPerVeldwaarde$: rx.Observable<KleurPerVeldwaarde> = forEveryLaag(laag =>
      veldnaam$.pipe(collectOption(kleurPerVeldwaardeViaLaagEnVeldnaam(laag)))
    );

    // klik op 1 van de veldwaarden
    const veldwaardeSelectie$: rx.Observable<VeldwaardeClick> = this.actionDataFor$("kiesKleur", isVeldwaardekleurSelectie);
    const terugvalSelectie$: rx.Observable<TerugvalClick> = this.actionDataFor$("kiesKleur", isTerugvalkleurSelectie);
    const veldwaardeSelectieKleur$ = veldwaardeSelectie$.pipe(map(vw => VeldwaardeKleur.create(vw.veldwaarde, vw.kleur)));
    const terugvalSelectieKleur$ = terugvalSelectie$.pipe(map(tv => tv.kleur));
    const kleurPerVeldwaarde$ = forEvery(initieleKleurPerVeldwaarde$)(instelling =>
      scan2(
        veldwaardeSelectieKleur$,
        terugvalSelectieKleur$,
        KleurPerVeldwaarde.zetVeldwaardeKleur,
        KleurPerVeldwaarde.zetTerugvalkleur,
        KleurPerVeldwaarde.makeAfgeleid(instelling)
      ).pipe(
        startWith(instelling),
        shareReplay(1)
      )
    );

    ///////////////////
    // De kleurenkiezer
    //

    // zichtbaarheid voor het zijpaneel met het kleurenpalet
    const kiezerToonEvents$ = this.actionFor$("wijzigKleur"); // zichtbaar wanneer op kleur geklikt
    const kiezerVerbergEvents$ = rx.merge(
      stijlMode$, // onzichtbaar wanneer tab geselecteerd
      geenAanpassing$, // onzichtbaar wanneer paneel gesloten
      this.actionFor$("sluitKleurkiezer"), // onzichtbaar wanneer gesloten
      this.actionFor$("kiesKleur") // onzichtbaar wanneer kleur gekozen
    );

    this.kiezerZichtbaar$ = rx
      .merge(
        kiezerToonEvents$.pipe(mapTo(true)), //
        kiezerVerbergEvents$.pipe(mapTo(false))
      )
      .pipe(startWith(false));

    // zichtbaarheid van de 2 kleurpaletten
    this.kleinPaletZichtbaar$ = this.kiezerZichtbaar$.pipe(
      filter(z => z === true), // wanneer de kiezer zichtbaar wordt
      switchMap(() =>
        this.actionFor$("openGroteKleurkiezer").pipe(
          mapTo(false), // sluit wanneer groot palet gevraagd wordt
          startWith(true) // in het begin zichtbaar
        )
      ),
      shareReplay(1)
    );
    const grootPaletZichtbaar$ = this.kleinPaletZichtbaar$.pipe(map(negate));

    // Zet het stijlmodel om naar een array van objecten die door de UI geïnterpreteerd kunnen worden
    this.laagkleuren$ = forEveryLaag(laag =>
      selectByMode<KleurWijzigTarget[]>(
        enkeleKleur$.pipe(map(enkeleKleurToTargetCtx(laag))),
        kleurPerVeldwaarde$.pipe(
          map(kleurPerVeldwaardeToTargetCtx),
          startWith([]) // Omdat er niets ge-emit wordt totdat er een veld geselecteerd is
        )
      )
    );
    const geklikteKleur$: rx.Observable<KleurWijzigTarget> = this.actionDataFor$("wijzigKleur", isKleurWijzigClick);
    const markeerKleur: Curried2<KleurWijzigTarget, clr.Kleur, ClickContext> = kwt => paletKleur => ({
      ...kwt,
      kleur: paletKleur,
      gekozen: clr.setoidKleurOpCode.equals(kwt.kleur, paletKleur)
    });
    this.paletKleuren$ = rx
      .combineLatest(geklikteKleur$, this.kleinPaletZichtbaar$, (klikkleur, kp) =>
        (kp ? kleurenpaletKlein : kleurenpaletGroot).map(markeerKleur(klikkleur))
      )
      .pipe(shareReplay(1));

    // Zorg er voor dat de kleurkiezer steeds ergens naast de component staat
    // Dat doen we door enerzijds de kiezer naar rechts te schuiven tot die zeker naast de eventuele scrollbar staat.
    // Aan de andere kant schuiven we de kiezer ook omhoog. We zetten die op dezelfde hoogte als de editor component. Wanneer
    // de kiezer geëxpandeerd wordt evenwel, dan schuiven we hem nog wat meer omhoog om plaats te maken voor de extra kleurtjes.
    // Afhankelijk van de schermgrootte en waar de editorcomponent staat, zou die anders over de rand van het window kunnen vallen.
    // Dat kan trouwens nu nog steeds. De gebruiker moet dan eerst de editor voldoende omhoog schuiven. Dit zou mogelijk moeten
    // zijn in fullscreen mode zoals bij geoloket2 en sowieso veel minder een probleem als er toch nog plaats is onder de
    // kaartcomponent bij embedded gebruik.
    this.kiezerStyle$ = editorElement$.pipe(
      // De allereerste keer wordt de CSS transformatie maar na een tijdje toegepast wat resulteert in een "springende" component,
      // vandaar dat we even wachten met genereren van de style. Een neveneffect is wel dat de display dan initieel op none moet staan
      // want anders wordt er toch nog gesprongen.
      delay(1),
      switchMap(editorElt =>
        grootPaletZichtbaar$.pipe(
          switchMap(groot =>
            rx.of({
              transform: `translateX(${editorElt.clientWidth + 16}px) translateY(-${editorElt.clientHeight + (groot ? 48 : 0)}px)`,
              display: "flex"
            })
          )
        )
      ),
      shareReplay(1)
    );

    /////////////////////////////////
    // Luisteren op de activatieknop
    //

    // Luisteren op de "pas toe" knop.
    const pasToeGeklikt$ = this.actionFor$("pasLaagstijlToe");
    const enkeleKleurStijlCmd$: rx.Observable<prt.Command<KaartInternalMsg>> = forEveryLaag(laag =>
      enkeleKleur$.pipe(
        map(enkeleKleurStijlEnLegende(laag)),
        map(stijlCmdVoorLaag(laag))
      )
    );
    const opVeldwaardeCmd$ = forEveryLaag(laag =>
      kleurPerVeldwaarde$.pipe(
        map(opVeldWaardeStijlEnLegende),
        map(stijlCmdVoorLaag(laag))
      )
    );
    const stijlCmd$ = selectByMode(enkeleKleurStijlCmd$, opVeldwaardeCmd$);

    this.bindToLifeCycle(stijlCmd$.pipe(sample(pasToeGeklikt$))).subscribe(cmd => this.dispatch(cmd));

    // Toepassen knop actief of niet. Uitgedrukt als een negatief statement wegens gebruik voor HTML 'disabled'.
    const enkeleKleurNietAangepast$ = forEvery(initieleEnkeleKleur$)(initieel =>
      enkeleKleur$.pipe(map(huidig => EnkeleKleur.setoid.equals(huidig, initieel) && initieel.afgeleid))
    );
    const kleurPerVeldwaardeNietAangepast$ = forEvery(initieleKleurPerVeldwaarde$)(initieel =>
      kleurPerVeldwaarde$.pipe(map(huidig => KleurPerVeldwaarde.setoid.equals(huidig, initieel) && initieel.afgeleid))
    );
    this.nietToepassen$ = selectByMode(enkeleKleurNietAangepast$, kleurPerVeldwaardeNietAangepast$);

    ///////////////////////
    // Start de observables
    //

    // Omdat een aantal async pipes in een ngIf blok zitten, worden de observables niet gesubscribed van in het begin.
    // Omdat de observables die gebaseerd zijn op DOM events (clicks) hot zijn, wil dat zeggen dat hun events verloren gaan.
    // Enkel een shareReplay is daarvoor geen oplossing omdat die ook niet subscribet totdat hij zelf subcribed is.
    // We moeten niet alle observables subscriben. Diegene die aan het einde van de ketting staan is al genoeg.
    this.bindToLifeCycle(rx.merge(this.paletKleuren$, this.nietToepassen$)).subscribe();
  }

  tabSelected(evt: MatTabChangeEvent) {
    // Zet de StijlMode
    switch (evt.index) {
      case 0:
        this.stijlModeSubj.next(StijlMode.EnkeleKleur);
        break;
      case 1:
        this.stijlModeSubj.next(StijlMode.OpVeldWaarde);
        break;
    }
  }
}
