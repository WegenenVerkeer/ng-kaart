import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Set } from "immutable";
import { Observable } from "rxjs/Observable";
import { distinctUntilChanged, filter, map } from "rxjs/operators";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { KaartComponent } from "../../kaart/kaart.component";
import {
  GetraptZoekerComponent,
  isNotNullObject,
  toNonEmptyDistinctLowercaseString,
  ZoekerBoxComponent
} from "../box/zoeker-box.component";
import { StringZoekInput } from "../zoeker-abstract";

import { Afdeling, Gemeente, PerceelNummer, Sectie, ZoekerPerceelService } from "./zoeker-perceel.service";

const NIVEAU_ALLES = 0;
const NIVEAU_VANAFGEMEENTE = 1;
const NIVEAU_VANAFAFDELING = 2;
const NIVEAU_VANAFSECTIE = 3;
const NIVEAU_VANAFPERCEEL = 4;

@Component({
  selector: "awv-perceel-zoeker",
  templateUrl: "./zoeker-perceel-getrapt.html",
  styleUrls: ["./zoeker-perceel-getrapt.scss"]
})
export class ZoekerPerceelGetraptComponent extends GetraptZoekerComponent implements OnInit, OnDestroy {
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

    // Hier gaan we onze capakey doorsturen naar de zoekers, we willen alleen de perceelzoeker triggeren.
    this.bindToLifeCycle(this.perceelControl.valueChanges.pipe(filter(isNotNullObject), distinctUntilChanged())).subscribe(
      (perceelDetails: PerceelNummer) => {
        this.zoek({ type: "string", value: perceelDetails.capakey } as StringZoekInput, Set.of(this.perceelService.naam()));
      }
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
