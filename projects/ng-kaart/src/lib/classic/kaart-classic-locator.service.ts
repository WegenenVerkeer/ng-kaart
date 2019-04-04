import { ElementRef, Injectable, Injector } from "@angular/core";

@Injectable({
  providedIn: "root"
})
export class KaartClassicLocatorService<T = any> {
  private registry: Map<Element, T> = new Map();
  constructor() {}

  public registerComponent(component: T, el: ElementRef<Element>) {
    if (el) {
      this.registry.set(el.nativeElement, component);
    }
  }

  public getComponent(injector: Injector, component: any, el: ElementRef<Element>): T {
    const parentEl = this.findContainerElement(el.nativeElement, component);
    if (parentEl && this.registry.has(parentEl)) {
      return this.registry.get(parentEl);
    } else {
      return injector.get(component);
    }
  }

  private findContainerElement(el: Element, component: any): Element {
    if (this.registry.has(el) && this.registry.get(el) instanceof component) {
      return el;
    } else if (el.parentElement) {
      return this.findContainerElement(el.parentElement, component);
    } else {
      return null;
    }
  }
}
