import { Component, EventEmitter, NgZone, OnInit, Output } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Set } from "immutable";
import { Observable } from "rxjs/Observable";
import { distinctUntilChanged, filter, map, startWith, switchMap } from "rxjs/operators";

import { KaartComponent } from "../../kaart/kaart.component";
import { collectOption } from "../../util/operators";
import {
  GetraptZoekerComponent,
  isNotNullObject,
  toNonEmptyDistinctLowercaseString,
  toTrimmedLowerCasedString,
  ZoekerBoxComponent
} from "../box/zoeker-box.component";
import { zoekerMetNaam } from "../zoeker";

import { Afdeling, Gemeente, PERCEEL_SVC_NAAM, PerceelNummer, Sectie, ZoekerPerceelService } from "./zoeker-perceel.service";

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

  afdelingen$: Observable<Afdeling[]> = Observable.empty();
  secties$: Observable<Sectie[]> = Observable.empty();
  percelen$: Observable<PerceelNummer[]> = Observable.empty();

  leegMakenDisabled$: Observable<boolean> = Observable.empty();
  @Output() leegMakenDisabledChange: EventEmitter<boolean> = new EventEmitter();

  constructor(kaartComponent: KaartComponent, zoekerComponent: ZoekerBoxComponent, zone: NgZone) {
    super(kaartComponent, zoekerComponent, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.maakVeldenLeeg(NIVEAU_ALLES);

    const perceelService$: Observable<ZoekerPerceelService> = this.kaartComponent.modelChanges.zoekerServices$.pipe(
      collectOption(zoekerMetNaam(PERCEEL_SVC_NAAM)),
      map(zoeker => zoeker as ZoekerPerceelService)
    );
    const alleGemeenten$ = perceelService$.pipe(switchMap(svc => svc.getAlleGemeenten$()));
    const afdelingen$ = (gemeente: Gemeente) => perceelService$.pipe(switchMap(svc => svc.getAfdelingen$(gemeente.niscode)));
    const secties$ = (afdeling: Afdeling) => perceelService$.pipe(switchMap(svc => svc.getSecties$(afdeling.niscode, afdeling.code)));
    const perceelNummers$ = (sectie: Sectie) =>
      perceelService$.pipe(switchMap(svc => svc.getPerceelNummers$(sectie.niscode, sectie.afdelingcode, sectie.code)));

    this.bindToLifeCycle(this.busy(alleGemeenten$)).subscribe(
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
      this.gefilterdeGemeenten = this.alleGemeenten
        .filter(
          (gemeente: Gemeente) =>
            gemeente.naam.toLocaleLowerCase().includes(gemeenteOfNis) || gemeente.niscode.toString().includes(gemeenteOfNis)
        )
        .sort((a, b) => {
          function eersteVoorkomenZoekString(gemeente: Gemeente): Number {
            // we zoeken de kleinste index van de zoekTerm in de naam en niscode van de gemeente
            const indexNaam = gemeente.naam.toLocaleLowerCase().indexOf(gemeenteOfNis);
            const indexNis = gemeente.niscode.toString().indexOf(gemeenteOfNis);
            const positiveIndexes = [indexNaam, indexNis].filter(index => index !== -1).concat(Infinity);
            return Math.min(...positiveIndexes);
          }

          const aIndex = eersteVoorkomenZoekString(a);
          const bIndex = eersteVoorkomenZoekString(b);

          if (aIndex < bIndex) {
            // de zoekTerm komt korter vooraan voor in de gemeente of niscode van a
            return -1;
          } else if (aIndex > bIndex) {
            // de filterwaarde komt verder achteraan voor in de gemeente of niscode van a
            return 1;
          } else {
            // alfabetisch sorteren van alle andere gevallen
            return a.naam.localeCompare(b.naam);
          }
        });
      // Iedere keer als er iets verandert, moeten we de volgende controls leegmaken.
      this.maakVeldenLeeg(NIVEAU_VANAFGEMEENTE);
    });

    // Gebruik de waarde van de VORIGE control om een request te doen,
    //   maar alleen als die vorige waarde een object was (dus door de gebruiker aangeklikt in de lijst).
    // Filter het antwoord daarvan met de (eventuele) waarde van onze HUIDIGE control, dit om autocomplete te doen.
    this.afdelingen$ = this.autocomplete(this.gemeenteControl, afdelingen$, this.afdelingControl, (afdeling: Afdeling) => afdeling.naam);

    this.secties$ = this.autocomplete(this.afdelingControl, secties$, this.sectieControl, (sectie: Sectie) => sectie.code);

    this.percelen$ = this.autocomplete(
      this.sectieControl,
      perceelNummers$,
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
        this.zoek({ type: "Perceel", capaKey: perceelDetails.capakey }, [PERCEEL_SVC_NAAM]);
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
