import { Function1 } from "fp-ts/lib/function";
import { StrMap } from "fp-ts/lib/StrMap";

import { VeldInfo } from "../kaart-elementen";

////////////////////
// De bedoeling is om input data om te zetten naar een structuur die eenvoudig en consistent gelayout kan worden.
// De input kan bijv. een ol.Feature zijn, een string die een CSV record (header + 1 lijn) bevat zoals die van een WMS komt,
// een JSON die van een WFS komt of iets volledig custom.
//
// De outputstructuur noemen we een Rendering. Een rendering zal al de formatering van de veldwaarden (bijv. timestamp naar datum)
// uitgevoerd hebben (indien nodig) zodat de omzetting naar HTML kan gebeuren met een minimum aan logica. De Angular template zou
// geen functies op die structuur meer hoeven uit te voeren. Enkel *ngIf, *ngFor en weergeven van waarden zou moeten volstaan.
// De Rendering bepaalt ook in welke groep de output terecht zal komen.
// Een Rendering kan 0, 1, of meer velden consumeren.
// Voor een veldgebaseerde input worden ook de gebruikte velden teruggegecen. Dat laat toe om de Providers (zie hieronder) te "stacken".
// (misschien moeten we dit wel laten vallen wegens te specifiek voor veldgebaseerde providers, dan moeten we die naar een specifieker
// niveau duwen)
// De volgorde van de renderings kan niet gespecifieerd worden, maar is hard-coded in Angular template.
//
// Een RenderingProvider neemt een input en produceert een Rendering. Het is de bedoeling dat de verschillende types van lagen met
// verschillende types van RenderProvider geassocieerd worden tijdens de configuratie van de laag. Een featurelaag zal bijv. een
// VeldInfoFeatuireRenderProvider krijgen een WMS een CSVstringRenderProvider of een XMLStringRenderProvider.

export type FieldName = string;

export interface Property {
  readonly name: FieldName;
  readonly value: any;
}

export type RenderGroup = "Zichtbaar" | "Geavanceerd" | "Verborgen";

export type Renderer = LabeledTypedValue | Link | Ident8 | VanTot | Hm | Dimensie | Abbameldamelding;

export type ValueType = "string" | "boolean" | "date" | "distance" | "area";

export interface LabeledTypedValue {
  readonly type: "LabeledTypedValue";
  readonly label: string;
  readonly valueType: ValueType;
  readonly value: any;
}

export interface Link {
  readonly type: "Link";
  readonly matIcon?: string;
  readonly text: string;
  readonly link: string;
}

export interface Ident8 {
  readonly type: "Ident8";
  readonly ident8: string;
}

export interface VanTot {
  readonly type: "VanTot";
  readonly vanOpschrift: string;
  readonly vanAfstand: number;
  readonly totOpschrift: string;
  readonly totAfstand: number;
  readonly zijdeRijbaan?: "L" | "R";
  readonly afstandRijbaan?: number;
}

export interface Hm {
  readonly type: "Hm";
  readonly afstand: number;
  readonly zijdeRijbaan?: "L" | "R";
  readonly afstandRijbaan?: number;
}

export interface Dimensie {
  readonly type: "Dimensie";
  readonly lengte: number;
  readonly breedte?: number;
}

export interface Abbameldamelding {
  readonly type: "Abbameldamelding";
  // Het is mogelijk om een generiek type PostData te maken, maar zolang het bij Abbamelda blijft is dit de moeite niet waard
}

export interface Rendering {
  readonly usedFields: FieldName[];
  readonly group: RenderGroup;
  readonly renderer: Renderer;
}

export type RenderingProvider<S> = Function1<S, Rendering[]>;

export type VeldInfos = StrMap<VeldInfo>;
export type VeldInfoFeatuireRenderProvider = Function1<VeldInfos, RenderingProvider<ol.Feature>>;

export type CSVStringRenderProvider = RenderingProvider<string>;
export type XMLStringRenderProvider = RenderingProvider<string>;

export const NullRenderProvider: RenderingProvider<any> = () => [];
