import { Component, EventEmitter, NgZone, OnInit, Output } from "@angular/core";
import { FormControl } from "@angular/forms";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, startWith } from "rxjs/operators";

import { KaartComponent } from "../../kaart/kaart.component";
import { isNotNullObject } from "../../util/function";
import {
  GetraptZoekerComponent,
  toNonEmptyDistinctLowercaseString,
  toTrimmedLowerCasedString,
  ZoekerBoxComponent
} from "../box/zoeker-box.component";

import { CrabGemeente, CrabHuisnummer, CrabStraat, CrabZoekInput, ZoekerCrabService } from "./zoeker-crab.service";

const NIVEAU_ALLES = 0;
const NIVEAU_VANAFGEMEENTE = 1;
const NIVEAU_VANAFSTRAAT = 2;
const NIVEAU_VANAFHUISNUMMER = 3;

@Component({
  selector: "awv-zoeker-crab-getrapt",
  templateUrl: "./zoeker-crab-getrapt.component.html",
  styleUrls: ["./zoeker-crab-getrapt.component.scss"]
})
export class ZoekerCrabGetraptComponent extends GetraptZoekerComponent implements OnInit {
  private alleGemeenten: CrabGemeente[] = [];
  gefilterdeGemeenten: CrabGemeente[] = [];

  gemeenteControl = new FormControl({ value: "", disabled: true });
  straatControl = new FormControl({ value: "", disabled: true });
  huisnummerControl = new FormControl({ value: "", disabled: true });

  straten$: rx.Observable<CrabStraat[]> = rx.EMPTY;
  huisnummers$: rx.Observable<CrabHuisnummer[]> = rx.EMPTY;
  leegMakenDisabled$: rx.Observable<boolean> = rx.EMPTY;
  @Output()
  leegMakenDisabledChange: EventEmitter<boolean> = new EventEmitter();

  constructor(private crabService: ZoekerCrabService, kaartComponent: KaartComponent, zoekerComponent: ZoekerBoxComponent, zone: NgZone) {
    super(kaartComponent, zoekerComponent, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.maakVeldenLeeg(NIVEAU_ALLES);
    this.bindToLifeCycle(this.busy(this.crabService.getAlleGemeenten$())).subscribe(
      (gemeenten: CrabGemeente[]) => {
        // De gemeentecontrol was disabled tot nu, om te zorgen dat de gebruiker niet kan filteren voordat de gemeenten binnen zijn.
        this.gemeenteControl.enable();
        this.alleGemeenten = gemeenten;
        this.gefilterdeGemeenten = this.alleGemeenten;
      },
      error => this.meldFout(error)
    );

    const cleanedGemeenteNaam$ = this.gemeenteControl.valueChanges.pipe(toNonEmptyDistinctLowercaseString());

    // De gemeente control is speciaal, omdat we met gecachte gemeentes werken.
    // Het heeft geen zin om iedere keer dezelfde lijst van gemeenten op te vragen.
    this.bindToLifeCycle(cleanedGemeenteNaam$).subscribe((zoekTerm: string) => {
      // We moeten kunnen filteren op (een deel van) de naam van een gemeente of op (een deel van) de niscode
      // of op (een deel van) de postcode.
      this.gefilterdeGemeenten = this.alleGemeenten
        .filter(
          (gemeente: CrabGemeente) =>
            gemeente.naam.toLocaleLowerCase().includes(zoekTerm) ||
            gemeente.niscode.toString().includes(zoekTerm) ||
            gemeente.postcodes.includes(zoekTerm)
        )
        .sort((a, b) => {
          function eersteVoorkomenZoekString(gemeente: CrabGemeente): Number {
            // we zoeken de kleinste index van de zoekTerm in de naam en postcode van de gemeente (niet in de nis: die wordt niet getoond)
            const indexNaam = gemeente.naam.toLocaleLowerCase().indexOf(zoekTerm);
            const indexPostcode = gemeente.postcodes.indexOf(zoekTerm);
            const positiveIndexes = [indexNaam, indexPostcode].filter(index => index !== -1).concat(Infinity);
            return Math.min(...positiveIndexes);
          }

          const aIndex = eersteVoorkomenZoekString(a);
          const bIndex = eersteVoorkomenZoekString(b);

          if (aIndex < bIndex) {
            // de zoekTerm komt korter vooraan voor in de gemeente of postcode van a
            return -1;
          } else if (aIndex > bIndex) {
            // de filterwaarde komt verder achteraan voor in de gemeente of postcode van a
            return 1;
          } else {
            // alfabetisch sorteren van alle andere gevallen
            return a.naam.localeCompare(b.naam);
          }
        });
      // Iedere keer als er iets verandert, moeten we de volgende controls leegmaken.
      this.maakVeldenLeeg(NIVEAU_VANAFGEMEENTE);
    });

    this.leegMakenDisabled$ = this.gemeenteControl.valueChanges.pipe(
      map(c => toTrimmedLowerCasedString(c).length === 0),
      startWith(true)
    );
    this.bindToLifeCycle(this.leegMakenDisabled$).subscribe(value => {
      this.leegMakenDisabledChange.emit(value);
    });

    this.straten$ = this.autocomplete(
      this.gemeenteControl,
      (gemeente: CrabGemeente) => this.crabService.getStraten$(gemeente),
      this.straatControl,
      (straat: CrabStraat) => straat.naam
    );
    this.huisnummers$ = this.autocomplete(
      this.straatControl,
      (straat: CrabStraat) => this.crabService.getHuisnummers$(straat),
      this.huisnummerControl,
      (huisnummer: CrabHuisnummer) => huisnummer.huisnummer
    );

    // Wanneer de waardes leeg zijn, mag je de control disablen, maak ook de volgende velden leeg.
    this.subscribeToDisableWhenEmpty(this.straten$, this.straatControl, NIVEAU_VANAFSTRAAT);
    this.subscribeToDisableWhenEmpty(this.huisnummers$, this.huisnummerControl, NIVEAU_VANAFHUISNUMMER);

    // Hier gaan we automatisch zoeken op huisnummer.
    this.bindToLifeCycle(
      this.huisnummerControl.valueChanges.pipe(
        filter(isNotNullObject),
        distinctUntilChanged()
      )
    ).subscribe(v => {
      this.toonOpKaart();
    });
  }

  toonGemeenteInLijst(gemeente?: CrabGemeente): string {
    return gemeente ? `${gemeente.naam} <span class="crab-postcodes">(${gemeente.postcodes})</span>` : "";
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

  maakVeldenLeeg(vanafNiveau: number) {
    if (vanafNiveau === NIVEAU_ALLES) {
      this.gefilterdeGemeenten = this.alleGemeenten;
      this.gemeenteControl.setValue(null);
    }
    if (vanafNiveau <= NIVEAU_VANAFGEMEENTE) {
      this.straatControl.setValue(null);
    }

    if (vanafNiveau <= NIVEAU_VANAFSTRAAT) {
      this.huisnummerControl.setValue(null);
    }
    super.maakVeldenLeeg(vanafNiveau);
  }

  toonOpKaart() {
    let zoekInput: CrabZoekInput;
    if (isNotNullObject(this.huisnummerControl.value)) {
      zoekInput = this.huisnummerControl.value;
    } else if (isNotNullObject(this.straatControl.value)) {
      zoekInput = this.straatControl.value;
    } else {
      zoekInput = this.gemeenteControl.value;
    }
    this.zoek(zoekInput, [this.crabService.naam()]);
  }

  magTonenOpKaart(): boolean {
    return isNotNullObject(this.gemeenteControl.value);
  }
}
