import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import { Observable } from "rxjs/Observable";
import { combineLatest, distinctUntilChanged, filter, map, merge, shareReplay, startWith } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { ToegevoegdeLaag } from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { LegendeItem } from "../kaart/kaart-legende";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { observeOnAngular } from "../util/observe-on-angular";

export const LagenUiSelector = "Lagenkiezer";

export interface LagenUiOpties {
  toonLegende: boolean;
  verwijderbareLagen: boolean;
  verplaatsbareLagen: boolean;
}

export const DefaultOpties: LagenUiOpties = {
  toonLegende: false,
  verwijderbareLagen: false,
  verplaatsbareLagen: true
};

type GapDirection = "Up" | "Down" | "Here";

const TOP: GapDirection = "Up";
const BOTTOM: GapDirection = "Down";
const HERE: GapDirection = "Here";

interface DragState {
  readonly from: ToegevoegdeLaag;
  readonly currentDrop: ToegevoegdeLaag;
  readonly gapTop: number;
  readonly gapBottom: number;
  readonly sourceTop: number;
  readonly sourceBottom: number;
  readonly lastY: number;
  readonly gap: GapDirection;
  readonly startTime: number;
}

const dndDataType = "text/plain";

const setoidGroep = {
  equals: (x: ToegevoegdeLaag, y: ToegevoegdeLaag) => x.laaggroep === y.laaggroep
};

const isSource = (laag: ToegevoegdeLaag) => (ds: DragState) => ds.from.titel === laag.titel;
const isTarget = (laag: ToegevoegdeLaag) => (ds: DragState) => ds.currentDrop.titel === laag.titel;

const elementPos = (elt: HTMLElement) => [elt.getBoundingClientRect().top, elt.getBoundingClientRect().bottom]; // [top, bottom]

@Component({
  selector: "awv-lagenkiezer",
  templateUrl: "./lagenkiezer.component.html",
  styleUrls: ["./lagenkiezer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush // Omdat angular anders veel te veel change detection uitvoert
})
export class LagenkiezerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private dragState: Option<DragState> = none;
  private compact = false;
  readonly lagenHoog$: Observable<List<ToegevoegdeLaag>>;
  readonly lagenLaag$: Observable<List<ToegevoegdeLaag>>;
  readonly lagenMetLegende$: Observable<List<ToegevoegdeLaag>>;
  readonly heeftDivider$: Observable<boolean>;
  readonly geenLagen$: Observable<boolean>;
  readonly geenLegende$: Observable<boolean>;
  readonly opties$: Observable<LagenUiOpties>;

  constructor(parent: KaartComponent, ngZone: NgZone, private readonly cdr: ChangeDetectorRef, private readonly sanitizer: DomSanitizer) {
    super(parent, ngZone);

    function isZichtbaar(laag: ToegevoegdeLaag, zoom: number): boolean {
      return zoom >= laag.bron.minZoom && zoom <= laag.bron.maxZoom;
    }

    const zoom$ = parent.modelChanges.zoomInstellingen$.pipe(map(zi => zi.zoom), distinctUntilChanged());
    this.lagenHoog$ = this.modelChanges.lagenOpGroep$.get("Voorgrond.Hoog");
    this.lagenLaag$ = this.modelChanges.lagenOpGroep$.get("Voorgrond.Laag");
    this.lagenMetLegende$ = this.lagenHoog$.pipe(
      combineLatest(this.lagenLaag$, (lagenHoog, lagenLaag) => lagenHoog.merge(lagenLaag)),
      combineLatest(zoom$, (lagen, zoom) => lagen.filter(laag => isZichtbaar(laag, zoom))),
      map(lagen => lagen.filter(laag => laag.legende.isSome()).toList())
    );
    const lagenHoogLeeg$ = this.lagenHoog$.pipe(map(l => l.isEmpty()));
    const lagenLaagLeeg$ = this.lagenLaag$.pipe(map(l => l.isEmpty()));
    this.heeftDivider$ = lagenHoogLeeg$.pipe(combineLatest(lagenLaagLeeg$, (h, l) => !h && !l), shareReplay(1));
    this.geenLagen$ = lagenHoogLeeg$.pipe(combineLatest(lagenLaagLeeg$, (h, l) => h && l), shareReplay(1));
    this.geenLegende$ = this.lagenMetLegende$.pipe(map(l => l.isEmpty()), shareReplay(1));
    this.opties$ = this.modelChanges.uiElementOpties$.pipe(
      filter(o => o.naam === LagenUiSelector),
      map(o => o.opties as LagenUiOpties),
      startWith(DefaultOpties),
      shareReplay(1)
    );
  }

  get uitgeklapt(): boolean {
    return !this.compact;
  }

  get ingeklapt(): boolean {
    return this.compact;
  }

  toggleCompact() {
    this.compact = !this.compact;
  }

  isDropZone(laag: ToegevoegdeLaag): boolean {
    return this.dragState.map(ds => ds.from).contains(setoidGroep, laag);
  }

  dragStyleClasses(laag: ToegevoegdeLaag): string[] {
    return this.dragState.foldL(
      () => [""],
      ds => {
        if (ds.from.laaggroep !== laag.laaggroep) {
          return ["no-drag"];
        } else if (isSource(laag)(ds)) {
          return ["start-move"];
        } else {
          return [""];
        }
      }
    );
    // De code hieronder in commentaar tot we de CSS goed krijgen
    // return this.dragState.fold(
    //   () => [""],
    //   ds => {
    //     if (ds.from.laaggroep !== laag.laaggroep) {
    //       return ["no-drag"];
    //     } else if (isSource(laag)(ds)) {
    //       return ["drag-busy", ds.gap === HERE ? "start-move" : "replaced"];
    //     } else if (isTarget(laag)(ds)) {
    //       return ["drag-busy", ds.gap === TOP ? "gap-on-top" : "gap-below"];
    //     } else {
    //       return ["drag-busy"];
    //     }
    //   }
    // );
  }

  onDragStart(evt: DragEvent, laag: ToegevoegdeLaag) {
    evt.dataTransfer.setData(dndDataType, laag.titel);
    evt.dataTransfer.effectAllowed = "move";
    // Een beetje later schedulen omdat anders CSS direct verandert en de browser dan de gewijzigde CSS overneemt ipv de originele
    setTimeout(() => {
      const y = evt.clientY;
      const [topPos, bottomPos] = elementPos(evt.target as HTMLElement);
      this.dragState = some({
        from: laag,
        currentDrop: laag,
        lastY: y,
        gapTop: topPos,
        gapBottom: bottomPos,
        sourceTop: topPos,
        sourceBottom: bottomPos,
        gap: HERE,
        startTime: Date.now()
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
    evt.dataTransfer.dropEffect = this.isDropZone(laag) ? "move" : "none";
    this.dragState.map(ds => {
      if (!isSource(laag)(ds) && ds.from.laaggroep === laag.laaggroep) {
        const y = evt.clientY;
        const now = Date.now();
        // Niet toelaten dat spookevents de drag state beïnvloeden: in het begin van de drag wordt om een of andere reden
        // een element verschillende lijnen hoger betreden.
        if (Math.abs(ds.lastY - y) < 40 || now - ds.startTime > 100) {
          const [topPos, bottomPos] = elementPos(evt.target as HTMLElement);
          const hitEltTop = y <= ds.gapTop;
          // console.log("dnd dragenter", ds.gapBottom, ds.gap, hitEltTop, topPos, bottomPos, ds);
          this.dragState = some({
            ...ds,
            lastY: y,
            gapTop: topPos,
            gapBottom: bottomPos,
            currentDrop: laag,
            gap: hitEltTop ? TOP : BOTTOM
          });
        }
      }
    });
  }

  onDragOver(evt: DragEvent, laag: ToegevoegdeLaag) {
    if (this.isDropZone(laag)) {
      // enkel drop toelaten in zelfde groep
      evt.preventDefault();
      this.dragState.map(ds => {
        const y = evt.clientY;
        const belowGap = y > ds.gapBottom;
        const aboveGap = y < ds.gapTop;
        const gapWasAbove = ds.gap === TOP;
        const gapWasBelow = ds.gap === BOTTOM;
        if (ds.lastY !== y && ((belowGap && gapWasAbove) || (aboveGap && gapWasBelow))) {
          // console.log("dnd dragover", ds.gapBottom, ds.gap, belowGap, aboveGap, gapWasAbove, gapWasBelow, ds);
          const [topPos, bottomPos] = elementPos(evt.target as HTMLElement);
          this.dragState = some({
            ...ds,
            lastY: y,
            gapTop: gapWasAbove ? ds.gapBottom : topPos,
            gapBottom: gapWasAbove ? bottomPos : ds.gapTop,
            gap: gapWasAbove ? BOTTOM : TOP
          });
        }
      });
    }
  }

  onDragLeave(evt: DragEvent, laag: ToegevoegdeLaag) {
    // De current drop enkel aanpassen als er ondertussen nog geen dragenter was die al een andere laag als drop target
    // aangeduid heeft. Dat kan als we buiten de lijst gaan met de cursor.
    this.dragState.map(ds => {
      if (isTarget(laag)(ds)) {
        // console.log("dnd dragleave", ds.gapBottom, ds.gap, ds);
        this.dragState = some({
          ...ds,
          currentDrop: ds.from,
          gapTop: ds.sourceTop,
          gapBottom: ds.sourceBottom,
          gap: HERE
        });
      }
    });
  }

  onDrop(evt: DragEvent, laag: ToegevoegdeLaag) {
    const bronLaagtitel = evt.dataTransfer.getData(dndDataType);
    this.dispatch(prt.VerplaatsLaagCmd(bronLaagtitel, laag.positieInGroep, kaartLogOnlyWrapper));
    this.onDragEnd(); // wordt niet door de browser aangeroepen blijkbaar
    evt.preventDefault();
    evt.stopPropagation();
  }

  icoon(item: LegendeItem): SafeHtml {
    function itemToHtml(): string {
      switch (item.type) {
        case "Bolletje":
          return `<svg class="svg"><circle cx="12" cy="12" r="4" fill="${item.kleur}" class="svg-item"/></svg>`;
        case "Lijn":
          return `<svg class="svg"><polygon points="0,8 24,8 24,16 0,16" fill="${item.kleur}" class="svg-item"/></svg>`;
        case "Polygoon":
          return `<svg class="svg"><polygon points="0,16 5,0 20,4 24,20 10,24" fill="${item.kleur}" class="svg-item"/></svg>`;
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(itemToHtml());
  }
}
