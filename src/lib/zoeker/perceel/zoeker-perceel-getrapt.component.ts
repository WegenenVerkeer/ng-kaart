import { Component, EventEmitter, NgZone, OnInit, Output } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Set } from "immutable";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, startWith } from "rxjs/operators";

import { KaartComponent } from "../../kaart/kaart.component";
import {
  GetraptZoekerComponent,
  isNotNullObject,
  toNonEmptyDistinctLowercaseString,
  toTrimmedLowerCasedString,
  ZoekerBoxComponent
} from "../box/zoeker-box.component";

import { Afdeling, Gemeente, PerceelNummer, Sectie, ZoekerPerceelService } from "./zoeker-perceel.service";

const NIVEAU_ALLES = 0;
const NIVEAU_VANAFGEMEENTE = 1;
const NIVEAU_VANAFAFDELING = 2;
const NIVEAU_VANAFSECTIE = 3;
const NIVEAU_VANAFPERCEEL = 4;

@Component({
  selector: "awv-zoeker-perceel-getrapt",
  templateUrl: "./zoeker-perceel-getrapt.component.html",
  styleUrls: ["./zoeker-perceel-getrapt.component.scss"]
})
export class ZoekerPerceelGetraptComponent extends GetraptZoekerComponent implements OnInit {
  private alleGemeenten: Gemeente[] = [];

  gefilterdeGemeenten: Gemeente[] = [];

  gemeenteControl = new FormControl({ value: "", disabled: true });
  afdelingControl = new FormControl({ value: "", disabled: true });
  sectieControl = new FormControl({ value: "", disabled: true });
  perceelControl = new FormControl({ value: "", disabled: true });

  afdelingen$: rx.Observable<Afdeling[]> = rx.empty();
  secties$: rx.Observable<Sectie[]> = rx.empty();
  percelen$: rx.Observable<PerceelNummer[]> = rx.empty();

  leegMakenDisabled$: rx.Observable<boolean> = rx.empty();
  @Output() leegMakenDisabledChange: EventEmitter<boolean> = new EventEmitter();

  constructor(
    private perceelService: ZoekerPerceelService,
    kaartComponent: KaartComponent,
    zoekerComponent: ZoekerBoxComponent,
    zone: NgZone
  ) {
    super(kaartComponent, zoekerComponent, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.maakVeldenLeeg(NIVEAU_ALLES);
    this.bindToLifeCycle(this.busy(this.perceelService.getAlleGemeenten$())).subscribe(
      (gemeenten: Gemeente[]) => {
        // De gemeentecontrol was disabled tot nu, om te zorgen dat de gebruiker niet kan filteren voordat de gemeenten binnen zijn.
        this.gemeenteControl.enable();
        this.alleGemeenten = gemeenten;
        this.gefilterdeGemeenten = this.alleGemeenten;
      },
      error => this.meldFout(error)
    );

    // De gemeente control is speciaal, omdat we met gecachte gemeentes werken.
    // Het heeft geen zin om iedere keer dezelfde lijst van gemeenten op te vragen.
    this.bindToLifeCycle(this.gemeenteControl.valueChanges.pipe(toNonEmptyDistinctLowercaseString())).subscribe((gemeenteOfNis: string) => {
      // We moeten kunnen filteren op (een deel van) de naam van een gemeente of op (een deel van) de niscode.
      this.gefilterdeGemeenten = this.alleGemeenten.filter(
        (gemeente: Gemeente) =>
          gemeente.naam.toLocaleLowerCase().includes(gemeenteOfNis) || gemeente.niscode.toString().includes(gemeenteOfNis)
      );
      // Iedere keer als er iets verandert, moeten we de volgende controls leegmaken.
      this.maakVeldenLeeg(NIVEAU_VANAFGEMEENTE);
    });

    // Gebruik de waarde van de VORIGE control om een request te doen,
    //   maar alleen als die vorige waarde een object was (dus door de gebruiker aangeklikt in de lijst).
    // Filter het antwoord daarvan met de (eventuele) waarde van onze HUIDIGE control, dit om autocomplete te doen.
    this.afdelingen$ = this.autocomplete(
      this.gemeenteControl,
      (gemeente: Gemeente) => this.perceelService.getAfdelingen$(gemeente.niscode),
      this.afdelingControl,
      (afdeling: Afdeling) => afdeling.naam
    );

    this.secties$ = this.autocomplete(
      this.afdelingControl,
      (afdeling: Afdeling) => this.perceelService.getSecties$(afdeling.niscode, afdeling.code),
      this.sectieControl,
      (sectie: Sectie) => sectie.code
    );

    this.percelen$ = this.autocomplete(
      this.sectieControl,
      (sectie: Sectie) => this.perceelService.getPerceelNummers$(sectie.niscode, sectie.afdelingcode, sectie.code),
      this.perceelControl,
      (perceelNummer: PerceelNummer) => perceelNummer.capakey
    );

    // Wanneer de waardes leeg zijn, mag je de control disablen, maak ook de volgende velden leeg.
    this.subscribeToDisableWhenEmpty(this.afdelingen$, this.afdelingControl, NIVEAU_VANAFAFDELING);
    this.subscribeToDisableWhenEmpty(this.secties$, this.sectieControl, NIVEAU_VANAFSECTIE);
    this.subscribeToDisableWhenEmpty(this.percelen$, this.perceelControl, NIVEAU_VANAFPERCEEL);

    this.leegMakenDisabled$ = this.gemeenteControl.valueChanges.pipe(map(c => toTrimmedLowerCasedString(c).length === 0), startWith(true));
    this.bindToLifeCycle(this.leegMakenDisabled$).subscribe(value => {
      this.leegMakenDisabledChange.emit(value);
    });

    // Hier gaan we onze capakey doorsturen naar de zoekers, we willen alleen de perceelzoeker triggeren.
    this.bindToLifeCycle(this.perceelControl.valueChanges.pipe(filter(isNotNullObject), distinctUntilChanged())).subscribe(
      (perceelDetails: PerceelNummer) => {
        this.zoek({ type: "Perceel", capaKey: perceelDetails.capakey }, Set.of(this.perceelService.naam()));
      }
    );
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
    return perceel ? perceel.perceelsnummer : undefined;
  }

  maakVeldenLeeg(vanafNiveau: number) {
    if (vanafNiveau === NIVEAU_ALLES) {
      this.gefilterdeGemeenten = this.alleGemeenten;
      this.gemeenteControl.setValue(null);
    }
    if (vanafNiveau <= NIVEAU_VANAFGEMEENTE) {
      this.afdelingControl.setValue(null);
    }

    if (vanafNiveau <= NIVEAU_VANAFAFDELING) {
      this.sectieControl.setValue(null);
    }
    if (vanafNiveau <= NIVEAU_VANAFSECTIE) {
      this.perceelControl.setValue(null);
    }

    super.maakVeldenLeeg(vanafNiveau);
  }
}
