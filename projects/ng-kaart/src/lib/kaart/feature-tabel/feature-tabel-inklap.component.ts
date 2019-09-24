import { animate, state, style, transition, trigger } from "@angular/animations";
import { AfterViewInit, Component, ElementRef, HostListener, NgZone, ViewChild } from "@angular/core";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, tap } from "rxjs/operators";

import { ofType } from "../../util";
import { observeOnAngular } from "../../util/observe-on-angular";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartInternalMsg, TabelStateMsg, tabelStateMsgGen } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { TabelStateChange } from "../model-changes";

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
      transition("zichtbaar => niet-zichtbaar", [animate("0.5s")]),
      transition("niet-zichtbaar => zichtbaar", [animate("0.5s")])
    ])
  ]
})
export class FeatureTabelInklapComponent extends KaartChildComponentBase implements AfterViewInit {
  public tabelZichtbaar = false;
  public magGetoondWorden$: rx.Observable<boolean>;
  public huidigeHoogte = 0;
  public bezigMetSlepen = false;
  private standaardHoogte: number;
  private maximumHoogte: number;
  private startSleepHoogte: number;
  private startSleepY: number;

  @ViewChild("datacontainer")
  dataContainer: ElementRef;

  @ViewChild("tabeloverzicht")
  tabelOverzicht: FeatureTabelOverzichtComponent;

  constructor(kaart: KaartComponent, ngZone: NgZone) {
    super(kaart, ngZone);
    // Zet de standaard grootte van de tabel op 2/5 van de grootte van de kaart
    this.bindToLifeCycle(kaart.containerResize$).subscribe(([_, hoogte]) => {
      this.maximumHoogte = hoogte - 24;
      this.huidigeHoogte = this.standaardHoogte = (hoogte / 5) * 2;
    });

    this.magGetoondWorden$ = this.internalMessage$.pipe(
      ofType<TabelStateMsg>("TabelState"),
      map(msg => msg.state),
      map(state => state.state !== "NietMogelijk")
    );

    const opengeklaptDoorKnop$ = this.internalMessage$.pipe(
      ofType<TabelStateMsg>("TabelState"), //
      observeOnAngular(this.zone),
      map(msg => msg.state),
      // We willen alleen de events die door een klik op de knop komen. De rest handelen we intern zelf al goed af.
      filter(state => state.doorKnop),
      map(state => state.state === "Opengeklapt")
    );

    // volg de TabelState om te openen/sluiten
    this.bindToLifeCycle(opengeklaptDoorKnop$).subscribe(tabelZichtbaar => {
      this.tabelZichtbaar = tabelZichtbaar;
      if (this.tabelZichtbaar) {
        this.huidigeHoogte = this.standaardHoogte;
      }
    });
  }

  ngAfterViewInit() {
    // volg de lagen en stuur "NietMogelijk" event indien niet getoond moet worden.
    this.bindToLifeCycle(
      rx.combineLatest(this.magGetoondWorden$, this.tabelOverzicht.model$.pipe(map(model => model.laagData.length > 0)))
    ).subscribe(([isEnabled, moetEnabledWorden]) => {
      if (isEnabled !== moetEnabledWorden) {
        this.tabelZichtbaar = false;
        if (moetEnabledWorden) {
          this.dispatch(prt.TabelStateChangeCmd(TabelStateChange("Dichtgeklapt")));
        } else {
          this.dispatch(prt.TabelStateChangeCmd(TabelStateChange("NietMogelijk")));
        }
      }
    });
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
      this.dispatch(prt.TabelStateChangeCmd(TabelStateChange(zichtbaar ? "Opengeklapt" : "Dichtgeklapt")));
    }
  }

  @HostListener("document:mouseup", ["$event"])
  onMouseUp(e: MouseEvent) {
    this.bezigMetSlepen = false;
  }

  onTouchEnd(e: TouchEvent) {
    this.bezigMetSlepen = false;
    e.stopPropagation();
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.TabelStateSubscription(tabelStateMsgGen)];
  }
}
