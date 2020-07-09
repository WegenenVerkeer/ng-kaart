import { ElementRef, Injectable, Injector } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";

import { classicLogger } from "./log";

@Injectable({
  providedIn: "root"
})
export class KaartClassicLocatorService<T extends object = any> {
  private registry: Map<Element, T> = new Map();
  constructor() {}

  public registerComponent(component: T, el: ElementRef<Element>) {
    if (el) {
      classicLogger.debug(`Registreer component ${el.nativeElement.tagName} onder tag ${component.constructor.name}`);
      this.registry.set(el.nativeElement, component);
    }
  }

  public getComponent(injector: Injector, component: any, el: ElementRef<Element>): T {
    const parentEl = this.findContainerElement(el.nativeElement, component);
    if (parentEl.map(el => this.registry.has(el)).getOrElse(false)) {
      const foundComponent = this.registry.get(parentEl.toNullable()!)!;
      classicLogger.debug(`Component ${foundComponent.constructor.name} gevonden voor tag ${el.nativeElement.tagName}`);
      return foundComponent;
    } else {
      classicLogger.debug(
        `Geen component van type ${component.name} gevonden voor tag ${el.nativeElement.tagName}, we proberen de standaard injector`
      );
      return injector.get(component);
    }
  }

  private findContainerElement(el: Element, component: any): Option<Element> {
    if (this.registry.has(el) && this.registry.get(el) instanceof component) {
      return some(el);
    } else if (el.parentElement) {
      return this.findContainerElement(el.parentElement, component);
    } else {
      return none;
    }
  }
}
