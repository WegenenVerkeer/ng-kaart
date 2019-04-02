import { ElementRef, Injectable, Injector } from "@angular/core";

@Injectable({
  providedIn: "root"
})
export class KaartClassicLocatorService<T = any> {
  private registry: Map<Element, T> = new Map();
  constructor() {}

  public registerKaart(component: T, el: ElementRef<Element>) {
    if (el) {
      this.registry.set(el.nativeElement, component);
    }
  }

  public getComponent(injector: Injector, component: any, el: ElementRef<Element>, tagNaam: string): T {
    const parentEl = this.findContainerElement(el.nativeElement, tagNaam);
    if (parentEl && this.registry.has(parentEl)) {
      return this.registry.get(parentEl);
    } else {
      return injector.get(component);
    }
  }

  private findContainerElement(el: Element, tagNaam: string): Element {
    const nodeName = el.nodeName.toLowerCase();
    if (nodeName === tagNaam) {
      return el;
    } else if (el.parentElement) {
      return this.findContainerElement(el.parentElement, tagNaam);
    } else {
      return null;
    }
  }
}
