import { ChangeDetectionStrategy, Component, ElementRef, NgZone, QueryList, ViewChildren, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatTabChangeEvent } from "@angular/material";
import * as array from "fp-ts/lib/Array";
import { Curried2, Function2, Lazy, tuple } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { delay, filter, map, mapTo, sample, scan, share, shareReplay, startWith, switchMap, tap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { forEvery, skipOlder } from "../../util/operators";
import { nonEmptyString } from "../../util/string";
import { negate } from "../../util/thruth";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import { Legende } from "../kaart-legende";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { Awv0StyleSpec } from "../stijl-selector";

import { AfgeleideKleur, gevonden, isVeldKleurWaarde, KiesbareKleur, markeerKleur, VeldKleurWaarde } from "./model";
import { kleurenpaletGroot, kleurenpaletKlein } from "./palet";
import { isAanpassingBezig, isAanpassingNietBezig, LaagstijlAanpassend } from "./state";
import {
  enkelvoudigeKleurLegende,
  enkelvoudigeKleurStijl,
  uniformeKleurViaLaag,
  veldKleurWaardenAsStijlfunctie,
  veldKleurWaardenLegende,
  veldKleurWaardenViaLaagEnVeldnaam
} from "./stijl-manip";

const uniformeStijlEnLegende: Curried2<ke.ToegevoegdeLaag, clr.Kleur, [Awv0StyleSpec, Legende]> = laag => kleur => [
  enkelvoudigeKleurStijl(kleur),
  enkelvoudigeKleurLegende(laag.titel, kleur)
];
const opVeldWaardeStijlEnLegende: Curried2<string, VeldKleurWaarde[], [Awv0StyleSpec, Legende]> = veldnaam => vkwn => [
  veldKleurWaardenAsStijlfunctie(veldnaam)(vkwn),
  veldKleurWaardenLegende(veldnaam)(vkwn)
];

const stijlCmdVoorLaag: Curried2<
  ke.ToegevoegdeVectorLaag,
  [Awv0StyleSpec, Legende],
  prt.ZetStijlSpecVoorLaagCmd<KaartInternalMsg>
> = laag => ([stijl, legende]) => prt.ZetStijlSpecVoorLaagCmd(laag.titel, stijl, legende, kaartLogOnlyWrapper);

const enum StijlMode {
  Uniform,
  OpVeldWaarde
}

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
  readonly uniformeLaagkleur$: rx.Observable<AfgeleideKleur>;
  readonly kiezerZichtbaar$: rx.Observable<boolean>;
  readonly kleinPaletZichtbaar$: rx.Observable<boolean>;
  readonly grootPaletZichtbaar$: rx.Observable<boolean>;
  readonly nietToepassen$: rx.Observable<boolean>;
  readonly paletKleuren$: rx.Observable<KiesbareKleur[]>;
  readonly chooserStyle$: rx.Observable<object>;
  readonly klasseVelden$: rx.Observable<ke.VeldInfo[]>;
  readonly klasseVeldenBeschikbaar$: rx.Observable<boolean>;
  readonly klasseVeldenNietBeschikbaar$: rx.Observable<boolean>;
  readonly veldKleurWaarden$: rx.Observable<VeldKleurWaarde[]>;
  readonly stijlMode$: rx.Observable<StijlMode>;

  readonly gekozenVeldKleurWaarde$: rx.Observable<VeldKleurWaarde>;

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

    this.stijlMode$ = startAtOpen(() => this.stijlModeSubj.asObservable()).pipe(
      startWith(StijlMode.Uniform),
      shareReplay(1)
    );

    // Een functie die de bronobservable enkel laat emitten wanneer de huidige mode gelijk is aan de gevraagde mode
    const forMode: (_: StijlMode) => <A>(_: rx.Observable<A>) => rx.Observable<A> = mode => obs =>
      forEvery(this.stijlMode$)(actueleMode => (actueleMode === mode ? obs : rx.never()));
    const whenInUniformMode = forMode(StijlMode.Uniform);
    const selectByMode: <A>(_1: rx.Observable<A>, _2: rx.Observable<A>) => rx.Observable<A> = (uniformObs, OpVeldWaardeObs) =>
      forEvery(this.stijlMode$)(actueleMode => {
        switch (actueleMode) {
          case StijlMode.Uniform:
            return uniformObs;
          case StijlMode.OpVeldWaarde:
            return OpVeldWaardeObs;
        }
      });

    const laag$: rx.Observable<ke.ToegevoegdeVectorLaag> = forEvery(aanpassing$)(aanpassing =>
      kaart.modelChanges.lagenOpGroep
        .get(aanpassing.laag.laaggroep)
        .pipe(map(lgn => lgn.filter(lg => lg!.titel === aanpassing.laag.titel).first() as ke.ToegevoegdeVectorLaag))
    ).pipe(
      shareReplay(1) // De huidige laag moet bewaard blijven voor alle volgende subscribers
    );
    this.titel$ = laag$.pipe(map(laag => laag.titel));
    const restartWithLaag = forEvery(laag$);

    // Alle geklikte kleuren in de kleurenkiezer
    const gekozenKleur$ = this.actionDataFor$("kiesLaagkleur", clr.isKleur).pipe(
      map(gevonden),
      share() // meerdere listeners, maar stuur geen oude events door
    );

    //////////////////
    // Het paneel zelf
    //
    this.zichtbaar$ = kaart.modelChanges.laagstijlaanpassingState$.pipe(map(isAanpassingBezig));
    this.bindToLifeCycle(this.actionFor$("sluitLaagstijleditor")).subscribe(() => this.dispatch(prt.StopVectorlaagstijlBewerkingCmd()));

    /////////////////
    // Uniforme kleur
    //

    // zet de startkleur elke keer dat we naar de Uniforme mode schakelen
    const gezetteUniformeKleur$: rx.Observable<AfgeleideKleur> = laag$.pipe(map(uniformeKleurViaLaag));
    // zetten van de nieuwe en bestaande kleuren
    const uniformeSelectieKleur$ = whenInUniformMode(gekozenKleur$);
    this.uniformeLaagkleur$ = rx
      .merge(
        gezetteUniformeKleur$, // begin met kleur in huidige stijl
        uniformeSelectieKleur$ // schakel over naar de net gekozen kleur
      )
      .pipe(shareReplay(1));

    //////////////
    // Klassekleur
    //
    this.klasseVelden$ = laag$.pipe(map(laag => laag.bron.velden.valueSeq().toArray()));
    this.klasseVeldenNietBeschikbaar$ = this.klasseVelden$.pipe(map(array.isEmpty));
    this.klasseVeldenBeschikbaar$ = this.klasseVeldenNietBeschikbaar$.pipe(map(negate));

    // klik op 1 van de veldwaarden
    const veldKleurWaardeSelectie$ = this.actionDataFor$("openKleineKleurkiezer", isVeldKleurWaarde);
    const geselecteerdeVeldKleurWaarde$ = veldKleurWaardeSelectie$.pipe(shareReplay(1));
    const selectieVeldKleur$ = geselecteerdeVeldKleurWaarde$.pipe(map(VeldKleurWaarde.kleur.get)).pipe(shareReplay(1));
    const veldnaam$ = forEvery(aanpassing$)(() =>
      this.veldControl.valueChanges.pipe(
        startWith(this.veldControl.value), // valueChanges emit niet wanneer we naar de dialoog terugkeren nadat hij gesloten was
        filter(nonEmptyString),
        shareReplay(1) // moet onthouden worden voor wanneer laag stijl geupdated wordt
      )
    );

    const selectieVeldWaarde$ = forEvery(aanpassing$)(() => geselecteerdeVeldKleurWaarde$.pipe(map(VeldKleurWaarde.waarde.get)));
    this.gekozenVeldKleurWaarde$ = forEvery(veldnaam$)(() =>
      rx.combineLatest(selectieVeldWaarde$, gekozenKleur$, VeldKleurWaarde.create).pipe(
        sample(gekozenKleur$), // enkel wanneer er geklikt wordt
        shareReplay(1)
      )
    );

    const zetVeldkleurwaarde: Function2<VeldKleurWaarde[], VeldKleurWaarde, VeldKleurWaarde[]> = (vkwn, overlayVkw) =>
      vkwn.map(vkw => (vkw.waarde === overlayVkw.waarde ? overlayVkw : vkw));
    this.veldKleurWaarden$ = laag$.pipe(
      switchMap(laag =>
        veldnaam$.pipe(
          map(veldnaam => veldKleurWaardenViaLaagEnVeldnaam(laag, veldnaam)),
          switchMap(vkwn =>
            this.gekozenVeldKleurWaarde$.pipe(
              scan<VeldKleurWaarde, VeldKleurWaarde[]>(zetVeldkleurwaarde, vkwn),
              startWith(vkwn)
            )
          )
        )
      ),
      shareReplay(1, 250) // we willen enkel de 2de subscriber een klein beetje tijd geven om te subscriben
    );
    const veldKleurWaardenNietBeschikbaar$ = this.veldKleurWaarden$.pipe(
      map(array.isEmpty),
      startWith(true) // voor het geval er (nog) geen property geselecteerd is
    );

    ///////////////////
    // De kleurenkiezer
    //

    // zichtbaarheid voor het zijpaneel met het kleurenpalet
    const kiezerToonEvents$ = this.actionFor$("openKleineKleurkiezer"); // zichtbaar wanneer op kleur geklikt
    const kiezerVerbergEvents$ = rx.merge(
      this.stijlMode$, // onzichtbaar wanneer tab geselecteerd
      geenAanpassing$, // onzichtbaar wanneer paneel gesloten
      this.actionFor$("sluitKleurkiezer"), // onzichtbaar wanneer gesloten
      this.actionFor$("kiesLaagkleur") // onzichtbaar wanneer kleur gekozen
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
    this.grootPaletZichtbaar$ = this.kleinPaletZichtbaar$.pipe(map(z => !z));

    // voeg "gekozen" attribuut toe aan de kleur van het palet zodat we het vinkje kunnen zetten
    const laagkleur$ = selectByMode(this.uniformeLaagkleur$, selectieVeldKleur$);
    this.paletKleuren$ = rx.combineLatest(laagkleur$, this.kleinPaletZichtbaar$, tuple).pipe(
      switchMap(([laagkleur, kp]) => (kp ? rx.of(kleurenpaletKlein) : rx.of(kleurenpaletGroot)).pipe(map(markeerKleur(laagkleur)))),
      shareReplay(1)
    );

    // Zorg er voor dat de kleurkiezer steeds ergens naast de component staat
    // Dat doen we door enerzijds de kiezer naar rechts te schuiven tot die zeker naast de eventuele scrollbar staat.
    // Aan de andere kant schuiven we de kiezer ook omhoog. We zetten die op dezelfde hoogte als de editor component. Wanneer
    // de kiezer geëxpandeerd wordt evenwel, dan schuiven we hem nog wat meer omhoog om plaats te maken voor de extra kleurtjes.
    // Afhankelijk van de schermgrootte en waar de editorcomponent staat, zou die anders over de rand van het window kunnen vallen.
    // Dat kan trouwens nu nog steeds. De gebruiker moet dan eerst de editor voldoende omhoog schuiven. Dit zou mogelijk moeten
    // zijn in fullscreen mode zoals bij geoloket2 en sowieso veel minder een probleem als er toch nog plaats is onder de
    // kaartcomponent bij embedded gebruik.
    this.chooserStyle$ = editorElement$.pipe(
      // De allereerste keer wordt de CSS transformatie maar na een tijdje toegepast wat resulteert in een "springende" component,
      // vandaar dat we even wachten met genereren van de style. Een neveneffect is wel dat de display dan initieel op none moet staan
      // want anders wordt er toch nog gesprongen.
      delay(1),
      switchMap(editorElt =>
        this.grootPaletZichtbaar$.pipe(
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
    const pasToeGeklikt$ = this.actionFor$("pasLaagstijlToe").pipe(share());
    const uniformeStijlCmd$ = restartWithLaag(laag =>
      uniformeSelectieKleur$.pipe(
        map(uniformeStijlEnLegende(laag)),
        map(stijlCmdVoorLaag(laag))
      )
    );
    const opVeldWaardeCmd$ = restartWithLaag(laag =>
      veldnaam$.pipe(
        switchMap(veldnaam =>
          this.veldKleurWaarden$.pipe(
            map(opVeldWaardeStijlEnLegende(veldnaam)),
            map(stijlCmdVoorLaag(laag))
          )
        )
      )
    );
    const stijlCmd$ = selectByMode(uniformeStijlCmd$, opVeldWaardeCmd$);

    this.bindToLifeCycle(stijlCmd$.pipe(switchMap(cmd => pasToeGeklikt$.pipe(mapTo(cmd))))).subscribe(cmd => this.dispatch(cmd));

    // Toepassen knop actief of niet. Uitgedrukt als een negatief statement wegens gebruik voor HTML 'disabled'.
    const uniformeKleurNietAangepast$ = gezetteUniformeKleur$.pipe(
      switchMap(gezet =>
        uniformeSelectieKleur$.pipe(
          map(geselecteerd => clr.setoidKleurOpCode.equals(gezet, geselecteerd) && gezet.gevonden),
          startWith(gezet.gevonden) // switchMap omdat we deze controle moeten doen vooraleer we een selectiekleur hebben
        )
      )
    );
    const opVeldWaardeNietAangepast$ = veldKleurWaardenNietBeschikbaar$;
    this.nietToepassen$ = selectByMode(uniformeKleurNietAangepast$, opVeldWaardeNietAangepast$).pipe(startWith(true));

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
        this.stijlModeSubj.next(StijlMode.Uniform);
        break;
      case 1:
        this.stijlModeSubj.next(StijlMode.OpVeldWaarde);
        break;
    }
  }
}
