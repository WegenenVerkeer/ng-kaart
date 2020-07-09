import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { MatTabChangeEvent } from "@angular/material/tabs";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import * as array from "fp-ts/lib/Array";
import { not, Predicate } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, filter, map, shareReplay } from "rxjs/operators";

import { Filter } from "../filter/filter-model";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { isToegevoegdeVectorLaag, ToegevoegdeLaag, ToegevoegdeVectorLaag } from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { LegendeItem } from "../kaart/kaart-legende";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { isAanpassingBezig } from "../kaart/stijleditor/state";
import { TabelActiviteit } from "../kaart/tabel-state";
import { OptiesRecord } from "../kaart/ui-element-opties";
import * as ol from "../util/openlayers-compat";

export const LagenUiSelector = "Lagenkiezer";

export interface LagenUiOpties extends OptiesRecord {
  readonly headerTitel: string;
  readonly initieelDichtgeklapt: boolean;
  readonly toonLegende: boolean;
  readonly toonFilters: boolean;
  readonly verwijderbareLagen: boolean;
  readonly verplaatsbareLagen: boolean;
  readonly filterbareLagen: boolean;
  readonly stijlbareVectorlagen: Predicate<string>;
  readonly transparantieaanpasbareLagen: Predicate<string>;
  readonly kleur?: ol.Color;
}

export const defaultOpties: LagenUiOpties = {
  headerTitel: "Legende en lagen",
  initieelDichtgeklapt: false,
  toonLegende: false,
  toonFilters: false,
  verwijderbareLagen: false,
  verplaatsbareLagen: true,
  filterbareLagen: false,
  stijlbareVectorlagen: () => false,
  transparantieaanpasbareLagen: () => false
};

interface DragState {
  readonly from: ToegevoegdeLaag;
  readonly currentDrop: ToegevoegdeLaag;
}

const dndDataType = "text/plain";

const setoidGroep = {
  equals: (x: ToegevoegdeLaag, y: ToegevoegdeLaag) => x.laaggroep === y.laaggroep
};

const isSource = (laag: ToegevoegdeLaag) => (ds: DragState) => ds.from.titel === laag.titel;
const isTarget = (laag: ToegevoegdeLaag) => (ds: DragState) => ds.currentDrop.titel === laag.titel;

@Component({
  selector: "awv-lagenkiezer",
  templateUrl: "./lagenkiezer.component.html",
  styleUrls: ["./lagenkiezer.component.scss"],
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ opacity: 0, "max-height": 0 }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 1, "max-height": "400px" }))
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "400px" }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 0, "max-height": 0 }))
      ])
    ])
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush // Omdat angular anders veel te veel change detection uitvoert
})
export class LagenkiezerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private dragState: Option<DragState> = none;
  private dichtgeklapt = false;
  public geselecteerdeTab = 0;
  readonly lagenHoog$: rx.Observable<Array<ToegevoegdeLaag>>;
  readonly lagenLaag$: rx.Observable<Array<ToegevoegdeLaag>>;
  readonly lagenMetLegende$: rx.Observable<Array<ToegevoegdeLaag>>;
  readonly lagenMetFilter$: rx.Observable<Array<ToegevoegdeVectorLaag>>;
  readonly heeftDivider$: rx.Observable<boolean>;
  readonly geenLagen$: rx.Observable<boolean>;
  readonly geenLegende$: rx.Observable<boolean>;
  readonly heeftFilters$: rx.Observable<boolean>;
  readonly opties$: rx.Observable<LagenUiOpties>;
  readonly tabelState$: rx.Observable<TabelActiviteit>;

  constructor(parent: KaartComponent, ngZone: NgZone, private readonly cdr: ChangeDetectorRef, private readonly sanitizer: DomSanitizer) {
    super(parent, ngZone);

    function isZichtbaar(laag: ToegevoegdeLaag, zoom: number): boolean {
      return zoom >= laag.bron.minZoom && zoom <= laag.bron.maxZoom;
    }

    const zoom$ = parent.modelChanges.viewinstellingen$.pipe(
      map(i => i.zoom),
      distinctUntilChanged()
    );
    this.lagenHoog$ = this.modelChanges.lagenOpGroep["Voorgrond.Hoog"].pipe(
      debounceTime(100),
      shareReplay(1)
    );
    this.lagenLaag$ = this.modelChanges.lagenOpGroep["Voorgrond.Laag"].pipe(
      debounceTime(100),
      shareReplay(1)
    );
    const achtergrondLagen$ = this.modelChanges.lagenOpGroep["Achtergrond"].pipe(
      debounceTime(100),
      shareReplay(1)
    );
    this.lagenMetLegende$ = rx
      .combineLatest(this.lagenHoog$, this.lagenLaag$, achtergrondLagen$, zoom$, (lagenHoog, lagenLaag, achtergrondLagen, zoom) => {
        const lagen = lagenHoog.concat(lagenLaag, achtergrondLagen);
        return lagen.filter(laag => isZichtbaar(laag, zoom) && laag.magGetoondWorden && laag.legende.isSome());
      })
      .pipe(shareReplay(1));
    const lagenHoogLeeg$ = this.lagenHoog$.pipe(map(array.isEmpty));
    const lagenLaagLeeg$ = this.lagenLaag$.pipe(map(array.isEmpty));
    this.heeftDivider$ = rx.combineLatest(lagenHoogLeeg$, lagenLaagLeeg$, (h, l) => !h && !l).pipe(shareReplay(1));
    this.geenLagen$ = rx.combineLatest(lagenHoogLeeg$, lagenLaagLeeg$, (h, l) => h && l).pipe(shareReplay(1));
    this.geenLegende$ = this.lagenMetLegende$.pipe(
      map(array.isEmpty),
      shareReplay(1)
    );
    this.lagenMetFilter$ = this.lagenHoog$.pipe(
      map(lagen => array.filter(lagen, isToegevoegdeVectorLaag)),
      map(vlagen => array.filter(vlagen, vlaag => Filter.isDefined(vlaag.filterinstellingen.spec)))
    );

    this.heeftFilters$ = this.lagenMetFilter$.pipe(
      map(not(array.isEmpty)),
      shareReplay(1)
    );
    this.dispatch(prt.InitUiElementOpties(LagenUiSelector, defaultOpties));
    this.opties$ = this.accumulatedOpties$<LagenUiOpties>(LagenUiSelector).pipe();

    this.tabelState$ = this.modelChanges.tabelActiviteit$;

    // Klap dicht wanneer laagstijleditor actief wordt. TODO via collapseUIRequest$
    this.bindToLifeCycle(this.modelChanges.laagstijlaanpassingState$.pipe(filter(isAanpassingBezig))).subscribe(
      () => (this.dichtgeklapt = true)
    );

    // Klap dicht wanneer tabel opengeklapt wordt
    const collapse$ = this.modelChanges.collapseUIRequest$;
    this.bindToLifeCycle(collapse$).subscribe(() => {
      this.cdr.markForCheck();
      return (this.dichtgeklapt = true);
    });
  }

  ngOnInit() {
    super.ngOnInit();
    const initieelDichtgeklapt$ = this.opties$.pipe(
      map(opties => opties.initieelDichtgeklapt),
      distinctUntilChanged()
    );
    // Zorg dat de lijst initieel open of dicht is zoals ingesteld
    initieelDichtgeklapt$.pipe(debounceTime(50)).subscribe(dichtgeklapt => {
      this.cdr.detectChanges();
      this.dichtgeklapt = dichtgeklapt;
    });
  }

  get isOpengeklapt(): boolean {
    return !this.dichtgeklapt;
  }

  get isDichtgeklapt(): boolean {
    return this.dichtgeklapt;
  }

  toggleDichtgeklapt() {
    this.dichtgeklapt = !this.dichtgeklapt;
  }

  toggleTabel(klapDicht: boolean, event: MouseEvent) {
    if (klapDicht) {
      this.dispatch(prt.SluitTabelCmd());
    } else {
      this.dispatch(prt.OpenTabelCmd());
    }
    event.stopPropagation();
  }

  public tabChanged(tabChangeEvent: MatTabChangeEvent): void {
    this.geselecteerdeTab = tabChangeEvent.index;
  }

  isDropZone(laag: ToegevoegdeLaag): boolean {
    return this.dragState.map(ds => ds.from).contains(setoidGroep, laag);
  }

  isDragSource(laag: ToegevoegdeLaag): boolean {
    return this.dragState.foldL(
      () => false,
      ds => {
        if (isSource(laag)(ds)) {
          return true;
        } else {
          return false;
        }
      }
    );
  }

  isDragTarget(laag: ToegevoegdeLaag): boolean {
    return this.dragState.foldL(
      () => false,
      ds => {
        if (isTarget(laag)(ds)) {
          return true;
        } else {
          return false;
        }
      }
    );
  }

  isDragUntargetable(laag: ToegevoegdeLaag): boolean {
    return this.dragState.foldL(
      () => false,
      ds => {
        if (ds.from.laaggroep !== laag.laaggroep) {
          return true;
        } else {
          return false;
        }
      }
    );
  }

  onDragStart(evt: DragEvent, laag: ToegevoegdeLaag) {
    if (evt.dataTransfer) {
      evt.dataTransfer.setData(dndDataType, laag.titel);
      evt.dataTransfer.effectAllowed = "move";
    }
    // Een beetje later schedulen omdat anders CSS direct verandert en de browser dan de gewijzigde CSS overneemt ipv de originele
    setTimeout(() => {
      this.dragState = some({
        from: laag,
        currentDrop: laag
      });
    }, 0);
  }

  onDragEnd() {
    // Wacht een klein beetje met de CSS af te breken. Hopelijk lang genoeg tot de lijst aangepast is.
    // Als we dat niet doen, dan wordt nog even de oorspronkelijke volgorde getoond totdat het command
    // verwerkt is en de nieuwe volgorde uit de observable komt.
    setTimeout(() => {
      this.dragState = none;
      this.cdr.detectChanges(); // We hebben de OnPush strategie, maar er is niet noodzakelijk nieuwe data
    }, 100);
  }

  onDragEnter(evt: DragEvent, laag: ToegevoegdeLaag) {
    evt.preventDefault(); // nodig opdat browser drop toelaat
    if (evt.dataTransfer) {
      evt.dataTransfer.dropEffect = this.isDropZone(laag) ? "move" : "none";
    }
    this.dragState.map(ds => {
      if (!isSource(laag)(ds) && ds.from.laaggroep === laag.laaggroep) {
        this.dragState = some({
          ...ds,
          currentDrop: laag
        });
      }
    });
  }

  onDragOver(evt: DragEvent, laag: ToegevoegdeLaag) {
    if (this.isDropZone(laag)) {
      // enkel drop toelaten in zelfde groep
      evt.preventDefault();
      this.dragState.map(ds => {
        this.dragState = some({
          ...ds,
          currentDrop: laag
        });
      });
    }
  }

  onDragLeave(laag: ToegevoegdeLaag) {
    // De current drop enkel aanpassen als er ondertussen nog geen dragenter was die al een andere laag als drop target
    // aangeduid heeft. Dat kan als we buiten de lijst gaan met de cursor.
    this.dragState.map(ds => {
      if (isTarget(laag)(ds)) {
        this.dragState = some({
          ...ds,
          currentDrop: ds.from
        });
      }
    });
  }

  onDrop(evt: DragEvent, laag: ToegevoegdeLaag) {
    if (evt.dataTransfer) {
      const bronLaagtitel = evt.dataTransfer.getData(dndDataType);
      this.dispatch(prt.VerplaatsLaagCmd(bronLaagtitel, laag.positieInGroep, kaartLogOnlyWrapper));
    }
    this.onDragEnd(); // wordt niet door de browser aangeroepen blijkbaar
    evt.preventDefault();
    evt.stopPropagation();
  }

  icoon(item: LegendeItem): SafeHtml {
    function itemToHtml(): string {
      switch (item.type) {
        case "Bolletje":
          return `<svg class="legende-svg"><circle cx="12" cy="12" r="4" fill="${item.kleur}" class="legende-svg-item"/></svg>`;
        case "Lijn":
          return item.achtergrondKleur.foldL(
            () => `<svg class="legende-svg"><polygon points="0,8 24,8 24,16 0,16" fill="${item.kleur}" class="legende-svg-item"/></svg>`,
            achtergrondKleur =>
              `<svg class="legende-svg">
                <polygon points="0,8 24,8 24,16 0,16" fill="${achtergrondKleur}"/>
                <polygon points="0,10 24,10 24,14 0,14" fill="${item.kleur}"/>
               </svg>`
          );
        case "Polygoon":
          return `<svg class="legende-svg"><polygon points="0,24 5,0 20,4 24,24 10,20" fill="${
            item.kleur
          }" class="legende-svg-item"/></svg>`;
        case "Image":
          return `<img class="legende-image" src="${item.image}"/>`;
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(itemToHtml());
  }
}
