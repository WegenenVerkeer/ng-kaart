import { AfterContentInit, ElementRef, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";
import { ClassicLaagComponent } from "../lagen/classic-laag.component";

import * as val from "../webcomponent-support/params";

export abstract class ClassicLegendeItemComponent implements AfterContentInit {
  _beschrijving: string;

  @Input()
  set beschrijving(param: string) {
    this._beschrijving = val.str(param, this._beschrijving);
  }

  constructor(private injector: Injector) {}

  ngAfterContentInit(): void {
    const locatorService = this.injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<ClassicLaagComponent>;
    const el: ElementRef<Element> = this.injector.get(ElementRef);
    const laag = locatorService.getComponent(this.injector, ClassicLaagComponent, el);
    laag.addLegendeItem(this);
  }

  abstract maakLegendeItem(): LegendeItem;
}
