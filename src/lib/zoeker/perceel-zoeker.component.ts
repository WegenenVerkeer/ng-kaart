import { HttpErrorResponse } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { List, Set } from "immutable";
import { UnaryFunction } from "rxjs/interfaces";
import { Observable } from "rxjs/Observable";
import { combineLatest, distinctUntilChanged, filter, map, startWith, switchMap, tap, shareReplay } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { kaartLogger } from "../kaart/log";
import { Afdeling, Gemeente, PerceelNummer, PerceelZoekerService, Sectie, PerceelDetails } from "./perceel-zoeker.service";
import { ZoekResultaten } from "./abstract-zoeker";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { ZoekerComponent } from "./zoeker.component";

function isNotNullObject(object) {
  return object && object instanceof Object;
}

// Filter een array van waardes met de waarde van een filter (control), de filter kan een string of een object zijn.
function filterMetWaarde<T>(control: FormControl, propertyName: string): UnaryFunction<Observable<T[]>, Observable<T[]>> {
  return combineLatest(control.valueChanges.pipe(startWith<string | T>(""), distinctUntilChanged()), (waardes, filterWaarde) => {
    if (!filterWaarde) {
      return waardes;
    } else if (typeof filterWaarde === "string") {
      return waardes.filter(value => value[propertyName].toLocaleLowerCase().includes(filterWaarde.toLocaleLowerCase()));
    } else {
      return waardes.filter(value => value[propertyName].toLocaleLowerCase().includes(filterWaarde[propertyName].toLocaleLowerCase()));
    }
  });
}

// inputWaarde kan een string of een object zijn. Enkel wanneer het een object is, roepen we de provider op,
// anders geven we een lege array terug.
function safeProvider<A, T>(provider: (A) => Observable<T[]>): UnaryFunction<Observable<A>, Observable<T[]>> {
  return switchMap(inputWaarde => {
    return isNotNullObject(inputWaarde) ? provider(inputWaarde) : Observable.of([]);
  });
}

// Wanneer de array leeg is, disable de control, enable indien niet leeg of er een filter is opgegeven.
function disableWanneerLeeg<T>(control: FormControl, array: T[]) {
  if (array.length > 0 || (control.value && control.value !== "")) {
    control.enable();
  } else {
    control.disable();
  }
}

@Component({
  selector: "awv-perceel-zoeker",
  templateUrl: "./perceel-zoeker.component.html",
  styleUrls: ["./perceel-zoeker.component.scss"]
})
export class PerceelZoekerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private alleGemeenten: Gemeente[] = [];

  gefilterdeGemeenten: Gemeente[] = [];

  gemeenteControl = new FormControl({ value: "", disabled: true });
  afdelingControl = new FormControl({ value: "", disabled: true });
  sectieControl = new FormControl({ value: "", disabled: true });
  perceelControl = new FormControl({ value: "", disabled: true });

  afdelingen$: Observable<Afdeling[]> = Observable.empty();
  secties$: Observable<Sectie[]> = Observable.empty();
  percelen$: Observable<PerceelNummer[]> = Observable.empty();

  constructor(
    private perceelService: PerceelZoekerService,
    kaartComponent: KaartComponent,
    zone: NgZone,
    private zoekerComponent: ZoekerComponent
  ) {
    super(kaartComponent, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.maakVeldenLeeg("alles");
    this.bindToLifeCycle(this.perceelService.getAlleGemeenten$()).subscribe(
      gemeenten => {
        // De gemeentecontrol was disabled tot nu, om te zorgen dat de gebruiker niet kan filteren voordat de gemeenten binnen zijn.
        this.gemeenteControl.enable();
        this.alleGemeenten = gemeenten;
        this.gefilterdeGemeenten = this.alleGemeenten;
      },
      error => this.meldFout(error)
    );

    // De gemeente control is speciaal, omdat we met gecachte gemeentes werken.
    // Het heeft geen zin om iedere keer dezelfde lijst van gemeenten op te vragen.
    this.bindToLifeCycle(
      this.gemeenteControl.valueChanges.pipe(
        filter(value => value), // filter de lege waardes eruit
        // zorg dat we een lowercase waarde hebben zonder leading of trailing spaties.
        map(value =>
          value
            .toString()
            .trim()
            .toLocaleLowerCase()
        ),
        distinctUntilChanged()
      )
    ).subscribe(gemeenteOfNis => {
      // We moeten kunnen filteren op (een deel van) de naam van een gemeente of op (een deel van) de niscode.
      this.gefilterdeGemeenten = this.alleGemeenten.filter(
        gemeente => gemeente.naam.toLocaleLowerCase().includes(gemeenteOfNis) || gemeente.niscode.toString().includes(gemeenteOfNis)
      );
      // Iedere keer als er iets veranderd, moeten we de volgende controls leegmaken.
      this.maakVeldenLeeg("vanafgemeente");
    });

    // Gebruik de waarde van de VORIGE control om een request te doen,
    //   maar alleen als die vorige waarde een object was (dus door de gebruiker aangeklikt in de lijst).
    // Filter het antwoord daarvan met de (eventuele) waarde van onze HUIDIGE control, dit om autocomplete te doen.
    this.afdelingen$ = this.gemeenteControl.valueChanges.pipe(
      distinctUntilChanged(),
      safeProvider(gemeente => this.perceelService.getAfdelingen$(gemeente.niscode)),
      filterMetWaarde(this.afdelingControl, "naam"),
      shareReplay(1)
    );

    this.secties$ = this.afdelingControl.valueChanges.pipe(
      distinctUntilChanged(),
      safeProvider(afdeling => this.perceelService.getSecties$(afdeling.niscode, afdeling.code)),
      filterMetWaarde(this.sectieControl, "code"),
      shareReplay(1)
    );

    this.percelen$ = this.sectieControl.valueChanges.pipe(
      distinctUntilChanged(),
      safeProvider(sectie => this.perceelService.getPerceelNummers$(sectie.niscode, sectie.afdelingcode, sectie.code)),
      filterMetWaarde(this.perceelControl, "capakey"),
      shareReplay(1)
    );

    // Wanneer de waardes leeg zijn, mag je de control disablen, maak ook de volgende velden leeg.
    this.afdelingen$.subscribe(
      afdelingen => {
        disableWanneerLeeg(this.afdelingControl, afdelingen);
        this.maakVeldenLeeg("vanafafdeling");
      },
      error => this.meldFout(error)
    );
    this.secties$.subscribe(
      secties => {
        disableWanneerLeeg(this.sectieControl, secties);
        this.maakVeldenLeeg("vanafsectie");
      },
      error => this.meldFout(error)
    );
    this.percelen$.subscribe(percelen => disableWanneerLeeg(this.perceelControl, percelen), error => this.meldFout(error));

    // Hier gaan we onze capakey doorsturen naar de zoekers, we willen alleen de perceelzoeker triggeren.
    this.bindToLifeCycle(this.perceelControl.valueChanges.pipe(filter(isNotNullObject), distinctUntilChanged())).subscribe(perceelDetails =>
      this.dispatch({
        type: "Zoek",
        input: perceelDetails.capakey,
        zoekers: Set.of(this.perceelService.naam()),
        wrapper: kaartLogOnlyWrapper
      })
    );

    this.dispatch({ type: "VoegZoekerToe", zoeker: this.perceelService, wrapper: kaartLogOnlyWrapper });
  }

  ngOnDestroy(): void {
    this.dispatch({ type: "VerwijderZoeker", zoeker: this.perceelService.naam(), wrapper: kaartLogOnlyWrapper });

    super.ngOnDestroy();
  }

  toonGemeente(gemeente?: Gemeente): string | undefined {
    return gemeente ? gemeente.naam : undefined;
  }

  toonAfdeling(afdeling?: Afdeling): string | undefined {
    return afdeling ? afdeling.naam : undefined;
  }

  toonSectie(sectie?: Sectie): string | undefined {
    return sectie ? sectie.code : undefined;
  }

  toonPerceel(perceel?: PerceelNummer): string | undefined {
    return perceel ? perceel.capakey : undefined;
  }

  private meldFout(fout: HttpErrorResponse) {
    kaartLogger.error("error", fout);
    this.dispatch(prt.MeldComponentFoutCmd(List.of("Fout bij ophalen perceel gegevens", fout.message)));
  }

  private maakVeldenLeeg(niveau: "alles" | "vanafgemeente" | "vanafafdeling" | "vanafsectie") {
    if (niveau === "alles") {
      this.gefilterdeGemeenten = this.alleGemeenten;
      this.gemeenteControl.setValue(null);
    }
    if (niveau === "alles" || niveau === "vanafgemeente") {
      this.afdelingControl.setValue(null);
    }

    if (niveau === "alles" || niveau === "vanafgemeente" || niveau === "vanafafdeling") {
      this.sectieControl.setValue(null);
    }
    if (niveau === "alles" || niveau === "vanafgemeente" || niveau === "vanafafdeling" || niveau === "vanafsectie") {
      this.perceelControl.setValue(null);
    }

    this.zoekerComponent.maakResultaatLeeg();
  }
}
