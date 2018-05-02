import { HttpErrorResponse } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { List, Set } from "immutable";
import { UnaryFunction } from "rxjs/interfaces";
import { Observable } from "rxjs/Observable";
import { combineLatest, distinctUntilChanged, filter, map, startWith, switchMap, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { kaartLogger } from "../kaart/log";
import { Afdeling, Gemeente, PerceelNummer, PerceelZoekerService, Sectie, PerceelDetails } from "./perceel-zoeker.service";
import { ZoekResultaten } from "./abstract-zoeker";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";

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
function safeProvider<T>(provider: (any) => Observable<T[]>): UnaryFunction<Observable<any>, Observable<T[]>> {
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

  gemeenteControl = new FormControl();
  afdelingControl = new FormControl({ value: "", disabled: true });
  sectieControl = new FormControl({ value: "", disabled: true });
  perceelControl = new FormControl({ value: "", disabled: true });

  afdelingen$: Observable<Afdeling[]> = Observable.empty();
  secties$: Observable<Sectie[]> = Observable.empty();
  percelen$: Observable<PerceelNummer[]> = Observable.empty();

  constructor(private perceelService: PerceelZoekerService, parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.maakPerceelFormLeeg();
    this.bindToLifeCycle(this.perceelService.getAlleGemeenten$()).subscribe(
      gemeenten => {
        this.alleGemeenten = gemeenten;
        this.gefilterdeGemeenten = this.alleGemeenten;
      },
      error => this.meldFout(error)
    );

    this.bindToLifeCycle(
      this.gemeenteControl.valueChanges.pipe(
        filter(value => value),
        map(value =>
          value
            .toString()
            .trim()
            .toLocaleLowerCase()
        ),
        distinctUntilChanged()
      )
    ).subscribe(gemeenteOfNis => {
      this.gefilterdeGemeenten = this.alleGemeenten.filter(
        gemeente => gemeente.naam.toLocaleLowerCase().includes(gemeenteOfNis) || gemeente.niscode.toString().includes(gemeenteOfNis)
      );
    });

    // Gebruik de waarde van de vorige control om een request te doen,
    // filter het antwoord daarvan met de (eventuele) waarde van onze control.
    // Wanneer de waardes leeg zijn, mag je de control disablen.
    // Dat is met een tap gedaan omdat de request anders 2 maal gestuurd wordt (1 keer voor iedere subscribe).
    this.afdelingen$ = this.gemeenteControl.valueChanges.pipe(
      safeProvider(gemeente => this.perceelService.getAfdelingen$(gemeente.niscode)),
      filterMetWaarde(this.afdelingControl, "naam"),
      tap(afdelingen => disableWanneerLeeg(this.afdelingControl, afdelingen), error => this.meldFout(error))
    );

    this.secties$ = this.afdelingControl.valueChanges.pipe(
      safeProvider(afdeling => this.perceelService.getSecties$(afdeling.niscode, afdeling.code)),
      filterMetWaarde(this.sectieControl, "code"),
      tap(secties => disableWanneerLeeg(this.sectieControl, secties), error => this.meldFout(error))
    );

    this.percelen$ = this.sectieControl.valueChanges.pipe(
      safeProvider(sectie => this.perceelService.getPerceelNummers$(sectie.niscode, sectie.afdelingcode, sectie.code)),
      filterMetWaarde(this.perceelControl, "capakey"),
      tap(percelen => disableWanneerLeeg(this.perceelControl, percelen), error => this.meldFout(error))
    );

    this.bindToLifeCycle(this.perceelControl.valueChanges.pipe(filter(value => isNotNullObject(value)), distinctUntilChanged())).subscribe(
      perceelDetails =>
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

  private maakPerceelFormLeeg() {
    this.gefilterdeGemeenten = this.alleGemeenten;

    this.gemeenteControl.setValue(null);
    this.afdelingControl.setValue(null);
    this.sectieControl.setValue(null);
    this.perceelControl.setValue(null);
  }
}
