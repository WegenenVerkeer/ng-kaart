import { AfterViewInit, Component, ElementRef, Input, ViewChild, ViewContainerRef, ViewEncapsulation } from "@angular/core";
import { KaartClassicLocatorService } from "projects/ng-kaart/src/lib/classic/kaart-classic-locator.service";
import { KaartClassicComponent } from "projects/ng-kaart/src/public_api";

@Component({
  selector: "awv-kaart-element",
  templateUrl: "./kaart-element.component.html",
  styleUrls: ["./kaart-element.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartElementComponent implements AfterViewInit {
  @ViewChild("kaart") kaart: KaartClassicComponent;

  @Input() zoom = 2;

  constructor(private el: ElementRef<Element>, private kaartLocatorService: KaartClassicLocatorService<KaartClassicComponent>) {}

  ngAfterViewInit() {
    this.kaartLocatorService.registerComponent(this.kaart, this.el);
  }
}
