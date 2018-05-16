import { Component, NgZone, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Set } from "immutable";
import { Observable } from "rxjs/Observable";
import { distinctUntilChanged, filter, map } from "rxjs/operators";

import { KaartComponent } from "../kaart/kaart.component";

import { CrabGemeente, CrabHuisnummer, CrabStraat, CrabZoekerService, CrabZoekInput } from "./crab-zoeker.service";
import { GetraptZoekerComponent, isNotNullObject, ZoekerComponent } from "./zoeker.component";

const NIVEAU_ALLES = 0;
const NIVEAU_VANAFGEMEENTE = 1;
const NIVEAU_VANAFSTRAAT = 2;
const NIVEAU_VANAFHUISNUMMER = 3;

@Component({
  selector: "awv-crab-getrapt-zoeker",
  templateUrl: "./crab-getrapt-zoeker.component.html",
  styleUrls: ["./crab-getrapt-zoeker.component.scss"]
})
export class CrabGetraptZoekerComponent extends GetraptZoekerComponent implements OnInit {
  private alleGemeenten: CrabGemeente[] = [];
  gefilterdeGemeenten: CrabGemeente[] = [];

  gemeenteControl = new FormControl({ value: "", disabled: true });
  straatControl = new FormControl({ value: "", disabled: true });
  huisnummerControl = new FormControl({ value: "", disabled: true });

  straten$: Observable<CrabStraat[]> = Observable.empty();
  huisnummers$: Observable<CrabHuisnummer[]> = Observable.empty();

  constructor(private crabService: CrabZoekerService, kaartComponent: KaartComponent, zone: NgZone, zoekerComponent: ZoekerComponent) {
    super(kaartComponent, zone, zoekerComponent);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.maakVeldenLeeg(NIVEAU_ALLES);
    this.bindToLifeCycle(this.busy(this.crabService.getAlleGemeenten$())).subscribe(
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
      // We moeten kunnen filteren op (een deel van) de naam van een gemeente of op (een deel van) de niscode
      // of op (een deel van) de postcode.
      this.gefilterdeGemeenten = this.alleGemeenten.filter(
        gemeente =>
          gemeente.naam.toLocaleLowerCase().includes(zoekTerm) ||
          gemeente.niscode.toString().includes(zoekTerm) ||
          gemeente.postcodes.includes(zoekTerm)
      );
      // Iedere keer als er iets verandert, moeten we de volgende controls leegmaken.
      this.maakVeldenLeeg(NIVEAU_VANAFGEMEENTE);
    });

    this.straten$ = this.autocomplete(this.gemeenteControl, gemeente => this.crabService.getStraten$(gemeente), this.straatControl, "naam");
    this.huisnummers$ = this.autocomplete(
      this.straatControl,
      straat => this.crabService.getHuisnummers$(straat),
      this.huisnummerControl,
      "huisnummer"
    );

    // Wanneer de waardes leeg zijn, mag je de control disablen, maak ook de volgende velden leeg.
    this.subscribeToDisableWhenEmpty(this.straten$, this.straatControl, NIVEAU_VANAFSTRAAT);
    this.subscribeToDisableWhenEmpty(this.huisnummers$, this.huisnummerControl, NIVEAU_VANAFHUISNUMMER);

    // Hier gaan we automatisch zoeken op huisnummer.
    this.bindToLifeCycle(this.huisnummerControl.valueChanges.pipe(filter(isNotNullObject), distinctUntilChanged())).subscribe(v => {
      this.toonOpKaart();
    });
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

  private toonOpKaart() {
    let zoekInput: CrabZoekInput;
    if (isNotNullObject(this.huisnummerControl.value)) {
      zoekInput = this.huisnummerControl.value;
    } else if (isNotNullObject(this.straatControl.value)) {
      zoekInput = this.straatControl.value;
    } else {
      zoekInput = this.gemeenteControl.value;
    }
    this.zoek(zoekInput, Set.of(this.crabService.naam()));
  }

  private magTonenOpKaart(): boolean {
    return isNotNullObject(this.gemeenteControl.value);
  }
}
