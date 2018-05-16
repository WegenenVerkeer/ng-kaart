import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import * as option from "fp-ts/lib/Option";
import { Observable } from "rxjs/Observable";
import { combineLatest, filter, map, shareReplay, startWith } from "rxjs/operators";

import { ofType } from "../util/operators";

import { KaartChildComponentBase } from "./kaart-child-component-base";
import { KaartComponentBase } from "./kaart-component-base";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { UiElementOpties } from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";

export const CopyrightSelector = "Copyright";
export const VoorwaardenSelector = "Voorwaarden";
export const SchaalSelector = "Schaal";

export interface CopyrightOpties {
  copyright: string;
}

export interface VoorwaardenOpties {
  titel: string;
  href: string;
}

export const CopyrightOpties = (copyright: string) => ({ copyright: copyright });

export const VoorwaardenOpties = (titel: string, href: string) => ({ titel: titel, href: href });

@Component({
  selector: "awv-kaart-voorwaarden-box",
  templateUrl: "./kaart-voorwaarden-box.html",
  styleUrls: ["./kaart-voorwaarden-box.scss"]
})
export class KaartVoorwaardenBoxComponent extends KaartChildComponentBase implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("schaal") schaalElement: ElementRef;
  copyright$: Observable<string>;
  voorwaardenOpties$: Observable<VoorwaardenOpties>;
  schaal$: Observable<UiElementOpties>;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
    this.copyright$ = this.modelChanges.uiElementOpties$.pipe(
      filter(optie => optie.naam === CopyrightSelector),
      map(o => o.opties.copyright)
    );
    this.voorwaardenOpties$ = this.modelChanges.uiElementOpties$.pipe(
      filter(optie => optie.naam === VoorwaardenSelector),
      map(o => o.opties as VoorwaardenOpties)
    );
    this.schaal$ = this.modelChanges.uiElementOpties$.pipe(filter(optie => optie.naam === SchaalSelector));
  }

  ngAfterViewInit(): void {
    super.ngOnInit();
    this.schaal$.subscribe(o =>
      this.dispatch(prt.VoegSchaalToeCmd(option.fromNullable(this.schaalElement.nativeElement), kaartLogOnlyWrapper))
    );
  }
}
