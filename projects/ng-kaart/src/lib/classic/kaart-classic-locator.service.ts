import { ElementRef, Injectable, Injector } from "@angular/core";
import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";

import { classicLogger } from "./log";

@Injectable({
  providedIn: "root",
})
export class KaartClassicLocatorService<T extends object = any> {
  private registry: Map<Element, T> = new Map();
  constructor() {}

  public registerComponent(component: T, el: ElementRef<Element>) {
    if (el) {
      classicLogger.debug(
        `Registreer component ${el.nativeElement.tagName} onder tag ${component.constructor.name}`
      );
      this.registry.set(el.nativeElement, component);
    }
  }

  public getComponent(
    injector: Injector,
    component: any,
    el: ElementRef<Element>
  ): T {
    const parentEl = this.findContainerElement(el.nativeElement, component);
    if (
      pipe(
        parentEl,
        option.map((el) => this.registry.has(el)),
        option.getOrElse(() => false)
      )
    ) {
      const foundComponent = this.registry.get(option.toNullable(parentEl)!)!;
      classicLogger.debug(
        `Component ${foundComponent.constructor.name} gevonden voor tag ${el.nativeElement.tagName}`
      );
      return foundComponent;
    } else {
      classicLogger.debug(
        `Geen component van type ${component.name} gevonden voor tag ${el.nativeElement.tagName}, we proberen de standaard injector`
      );
      return injector.get(component);
    }
  }

  private findContainerElement(
    el: Element,
    component: any
  ): option.Option<Element> {
    if (this.registry.has(el) && this.registry.get(el) instanceof component) {
      return option.some(el);
    } else if (el.parentElement) {
      return this.findContainerElement(el.parentElement, component);
    } else {
      return option.none;
    }
  }
}
