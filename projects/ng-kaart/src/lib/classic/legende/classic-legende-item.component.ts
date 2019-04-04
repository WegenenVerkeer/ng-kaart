import { AfterContentInit, ElementRef, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";
import { ClassicLaagComponent } from "../lagen/classic-laag.component";

export abstract class ClassicLegendeItemComponent implements AfterContentInit {
  @Input()
  beschrijving: string;

  constructor(private injector: Injector) {}

  ngAfterContentInit(): void {
    const locatorService = this.injector.get(KaartClassicLocatorService) as KaartClassicLocatorService<ClassicLaagComponent>;
    const el: ElementRef<Element> = this.injector.get(ElementRef);
    const laag = locatorService.getComponent(this.injector, ClassicLaagComponent, el);
    laag.addLegendeItem(this);
  }

  abstract maakLegendeItem(): LegendeItem;
}
