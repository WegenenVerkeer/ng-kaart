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
import { ZoekResultaten } from "./abstract-zoeker";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { ZoekerComponent } from "./zoeker.component";
import { CrabZoekerService, CrabGemeente, CrabStraat, CrabHuisnummer } from "./crab-zoeker.service";

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

type MaakLeegType = "alles" | "vanafgemeente" | "vanafstraat" | "vanafhuisnummer";

@Component({
  selector: "awv-crab-getrapt-zoeker",
  templateUrl: "./crab-getrapt-zoeker.component.html",
  styleUrls: ["./crab-getrapt-zoeker.component.scss"]
})
export class CrabGetraptZoekerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private alleGemeenten: CrabGemeente[] = [];

  gefilterdeGemeenten: CrabGemeente[] = [];

  gemeenteControl = new FormControl({ value: "", disabled: true });
  straatControl = new FormControl({ value: "", disabled: true });
  huisnummerControl = new FormControl({ value: "", disabled: true });

  straten$: Observable<CrabStraat[]> = Observable.empty();
  huisnummers$: Observable<CrabHuisnummer[]> = Observable.empty();

  constructor(
    private crabService: CrabZoekerService,
    kaartComponent: KaartComponent,
    zone: NgZone,
    private zoekerComponent: ZoekerComponent
  ) {
    super(kaartComponent, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.maakVeldenLeeg("alles");
    this.bindToLifeCycle(this.crabService.getAlleGemeenten$()).subscribe(
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
    ).subscribe(zoekTerm => {
      // We moeten kunnen filteren op (een deel van) de naam van een gemeente of op (een deel van) de niscode.
      this.gefilterdeGemeenten = this.alleGemeenten.filter(
        gemeente =>
          gemeente.naam.toLocaleLowerCase().includes(zoekTerm) ||
          gemeente.niscode.toString().includes(zoekTerm) ||
          gemeente.postcodes.includes(zoekTerm)
      );
      // Iedere keer als er iets verandert, moeten we de volgende controls leegmaken.
      this.maakVeldenLeeg("vanafgemeente");
    });

    // Gebruik de waarde van de VORIGE control om een request te doen,
    //   maar alleen als die vorige waarde een object was (dus door de gebruiker aangeklikt in de lijst).
    // Filter het antwoord daarvan met de (eventuele) waarde van onze HUIDIGE control, dit om autocomplete te doen.
    this.straten$ = this.gemeenteControl.valueChanges.pipe(
      distinctUntilChanged(),
      safeProvider(gemeente => this.crabService.getStraten$(gemeente)),
      filterMetWaarde(this.straatControl, "naam"),
      shareReplay(1)
    );

    this.huisnummers$ = this.straatControl.valueChanges.pipe(
      distinctUntilChanged(),
      safeProvider(straat => this.crabService.getHuisnummers$(straat)),
      filterMetWaarde(this.huisnummerControl, "huisnummer"),
      shareReplay(1)
    );

    // Wanneer de waardes leeg zijn, mag je de control disablen, maak ook de volgende velden leeg.
    this.subscribeToDisableWhenEmpty(this.straten$, this.straatControl, "vanafstraat");
    this.subscribeToDisableWhenEmpty(this.huisnummers$, this.huisnummerControl, "vanafhuisnummer");

    // Hier gaan we automatisch zoeken op huisnummer.
    this.bindToLifeCycle(this.huisnummerControl.valueChanges.pipe(filter(isNotNullObject), distinctUntilChanged())).subscribe(v => {
      this.toonOpKaart();
    });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  toonGemeenteInLijst(gemeente?: CrabGemeente): string | undefined {
    return gemeente ? `${gemeente.naam} <span class="crab-postcodes">(${gemeente.postcodes})</span>` : undefined;
  }

  toonGemeente(gemeente?: CrabGemeente): string | undefined {
    return gemeente ? `${gemeente.naam} (${gemeente.postcodes})` : undefined;
  }

  toonStraat(straat?: CrabStraat): string | undefined {
    return straat ? straat.naam : undefined;
  }

  toonHuisnummer(sectie?: CrabHuisnummer): string | undefined {
    return sectie ? sectie.huisnummer : undefined;
  }

  private meldFout(fout: HttpErrorResponse) {
    kaartLogger.error("error", fout);
    this.dispatch(prt.MeldComponentFoutCmd(List.of("Fout bij ophalen perceel gegevens", fout.message)));
  }

  private subscribeToDisableWhenEmpty<T>(observable: Observable<T[]>, formControl: FormControl, maakLeegType: MaakLeegType) {
    this.bindToLifeCycle(observable).subscribe(
      waardes => {
        disableWanneerLeeg<T>(formControl, waardes);
        this.maakVeldenLeeg(maakLeegType);
      },
      error => this.meldFout(error)
    );
  }

  private maakVeldenLeeg(niveau: MaakLeegType) {
    if (niveau === "alles") {
      this.gefilterdeGemeenten = this.alleGemeenten;
      this.gemeenteControl.setValue(null);
    }
    if (niveau === "alles" || niveau === "vanafgemeente") {
      this.straatControl.setValue(null);
    }

    if (niveau === "alles" || niveau === "vanafgemeente" || niveau === "vanafstraat") {
      this.huisnummerControl.setValue(null);
    }

    this.zoekerComponent.maakResultaatLeeg();
  }

  private toonOpKaart() {
    if (isNotNullObject(this.huisnummerControl.value)) {
      console.log("Toon op kaart", this.huisnummerControl.value);
    } else if (isNotNullObject(this.straatControl.value)) {
      console.log("Toon op kaart", this.straatControl.value);
    } else {
      console.log("Toon op kaart", this.gemeenteControl.value);
    }

    // TODO: voer het zoekcommando uit.
  }

  private magTonenOpKaart(): boolean {
    return isNotNullObject(this.gemeenteControl.value);
  }
}
