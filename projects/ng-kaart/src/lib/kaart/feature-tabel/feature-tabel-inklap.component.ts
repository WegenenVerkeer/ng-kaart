import { animate, state, style, transition, trigger } from "@angular/animations";
import { Component, ElementRef, HostListener, NgZone, ViewChild } from "@angular/core";
import { option } from "fp-ts";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, pairwise, sample, share } from "rxjs/operators";

import { catOptions, collectOption, scan2 } from "../../util";
import { IdentifyOpties } from "../kaart-bevragen/kaart-identify-opties";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import * as TabelState from "../tabel-state";

import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";

@Component({
  selector: "awv-feature-tabel-inklap",
  templateUrl: "./feature-tabel-inklap.component.html",
  styleUrls: ["./feature-tabel-inklap.component.scss"],
  animations: [
    trigger("tabel-zichtbaar", [
      // ...
      state(
        "zichtbaar",
        style({
          height: "{{hoogte}}px"
        }),
        { params: { hoogte: 0 } }
      ),
      state(
        "niet-zichtbaar",
        style({
          height: "0px"
        })
      ),
      transition("zichtbaar => niet-zichtbaar", [animate("0.35s cubic-bezier(.62,.28,.23,.99)")]),
      transition("niet-zichtbaar => zichtbaar", [animate("0.35s cubic-bezier(.62,.28,.23,.99)")])
    ])
  ]
})
export class FeatureTabelInklapComponent extends KaartChildComponentBase {
  public tabelZichtbaar = false;
  public magGetoondWorden$: rx.Observable<boolean>;
  public huidigeHoogte = 0;
  public bezigMetSlepen = false;
  private standaardHoogte: number;
  private maximumHoogte: number;
  private startSleepHoogte: number;
  private startSleepY: number;

  @ViewChild("datacontainer", { static: true })
  dataContainer: ElementRef;

  @ViewChild("tabeloverzicht", { static: true })
  tabelOverzicht: FeatureTabelOverzichtComponent;

  constructor(kaart: KaartComponent, ngZone: NgZone) {
    super(kaart, ngZone);
    // Zet de standaard grootte van de tabel op 2/5 van de grootte van de kaart
    this.bindToLifeCycle(kaart.containerResize$).subscribe(([_, hoogte]) => {
      this.maximumHoogte = hoogte - 24;
      this.huidigeHoogte = this.standaardHoogte = (hoogte / 5) * 2;
    });

    this.magGetoondWorden$ = this.modelChanges.tabelActiviteit$.pipe(map(activiteit => activiteit !== "Onbeschikbaar"));

    // volg de TabelState om te openen/sluiten
    const tabelZichtbaar$ = this.modelChanges.tabelActiviteit$.pipe(
      map(activiteit => activiteit === "Opengeklapt"),
      distinctUntilChanged(),
      share()
    );

    this.bindToLifeCycle(tabelZichtbaar$).subscribe(zichtbaar => {
      this.tabelZichtbaar = zichtbaar;
      if (zichtbaar) {
        this.huidigeHoogte = this.standaardHoogte;
      }
    });

    const overgangen$ = this.modelChanges.tabelActiviteit$.pipe(
      pairwise(),
      share()
    );
    const openNaarDicht$ = overgangen$.pipe(filter(([prev, cur]) => prev === TabelState.Opengeklapt && cur === TabelState.Dichtgeklapt));
    const dichtNaarOpen$ = overgangen$.pipe(filter(([prev, cur]) => prev === TabelState.Dichtgeklapt && cur === TabelState.Opengeklapt));
    const identifyOpties$ = this.modelChanges.optiesOpUiElement$.pipe(map(IdentifyOpties.getOption));
    const identifyOptiesByOpen$ = identifyOpties$.pipe(sample(dichtNaarOpen$));

    const identifyOndrukInit: { readonly memo: option.Option<IdentifyOpties>; readonly action: option.Option<IdentifyOpties> } = {
      memo: option.none,
      action: option.none
    };
    const onderdrukUpdateCmd$ = scan2(
      identifyOptiesByOpen$,
      openNaarDicht$,
      (_, optie) => ({ memo: optie, action: option.some({ identifyOnderdrukt: true }) }),
      (o, _) => ({ memo: option.none, action: o.memo }),
      identifyOndrukInit
    ).pipe(collectOption(({ action }) => option.map(IdentifyOpties.ZetOptiesCmd)(action)));

    this.dispatchCmdsInViewReady(onderdrukUpdateCmd$);
  }

  public toggleTabelZichtbaar() {
    if (this.tabelZichtbaar) {
      this.dispatch(prt.SluitTabelCmd());
    } else {
      this.dispatch(prt.OpenTabelCmd());
    }
  }

  startDragging(e: MouseEvent) {
    this.bezigMetSlepen = true;
    this.startSleepY = e.clientY;
    this.startSleepHoogte = this.dataContainer.nativeElement.offsetHeight;
  }

  onTouchStart(e: TouchEvent) {
    this.bezigMetSlepen = true;
    this.startSleepY = e.targetTouches[0].clientY;
    this.startSleepHoogte = this.dataContainer.nativeElement.offsetHeight;
    e.stopPropagation();
  }

  @HostListener("document:mousemove", ["$event"])
  onMouseMove(e: MouseEvent) {
    this.handleDrag(e.clientY);
  }

  onTouchMove(e: TouchEvent) {
    this.handleDrag(e.targetTouches[0].clientY);
    e.stopPropagation();
  }

  private handleDrag(clientY: number) {
    if (this.bezigMetSlepen) {
      this.huidigeHoogte = this.startSleepY - clientY + this.startSleepHoogte;
      if (this.huidigeHoogte > this.maximumHoogte) {
        this.huidigeHoogte = this.maximumHoogte;
      }
      if (this.huidigeHoogte <= 40) {
        if (this.tabelZichtbaar) {
          // Dicht snappen.
          this.zetTabelZichtbaar(false);
          this.bezigMetSlepen = false;
        } else {
          // Open snappen.
          this.huidigeHoogte = 41;
          this.startSleepHoogte = 41;
          this.zetTabelZichtbaar(true);
          this.dataContainer.nativeElement.style.height = this.huidigeHoogte + "px";
        }
      } else {
        this.zetTabelZichtbaar(true);
        this.dataContainer.nativeElement.style.height = this.huidigeHoogte + "px";
      }
    }
  }

  private zetTabelZichtbaar(zichtbaar: boolean) {
    if (this.tabelZichtbaar !== zichtbaar) {
      this.tabelZichtbaar = zichtbaar;
      this.dispatch(zichtbaar ? prt.OpenTabelCmd() : prt.SluitTabelCmd());
    }
  }

  @HostListener("document:mouseup", ["$event"])
  onMouseUp(_: MouseEvent) {
    this.bezigMetSlepen = false;
  }

  onTouchEnd(e: TouchEvent) {
    this.bezigMetSlepen = false;
    e.stopPropagation();
  }
}
