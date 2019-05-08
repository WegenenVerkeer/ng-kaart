import * as array from "fp-ts/lib/Array";
import { Endomorphism, Function1, Function2, Function3, Predicate } from "fp-ts/lib/function";
import { fromTraversable, Lens, Prism, Traversal } from "monocle-ts";

import * as ke from "../kaart/kaart-elementen";
import { applySequential } from "../util/function";
import * as maps from "../util/maps";

import { Filter as fltr } from "./filter-model";

// Hulp bij het opbouwen van een filter
export namespace FilterBuilder {
  export interface ConjunctionEditor {
    readonly elementEditors: ElementEditor[];
  }

  export interface DisjunctionsEditor {
    readonly conjunctionEditors: ConjunctionEditor[];
  }

  export interface ExpressionEditor {
    readonly current: ElementEditor;
    readonly disjunctions: DisjunctionsEditor;

    readonly laag: ke.VectorLaag;
  }

  export type ElementEditor = FieldSelection | OperatorSelection | ValueSelection | Completed;

  export interface FieldSelection {
    readonly kind: "Field";

    readonly veldinfos: ke.VeldInfo[]; // VeldInfo ipv Property omdat we distinct waarden nodig hebben later
  }

  export interface OperatorSelection {
    readonly kind: "Operator";

    readonly veldinfos: ke.VeldInfo[];

    readonly selectedVeldinfo: ke.VeldInfo;
    readonly operatorSelectors: ComparisonOperator[];
  }

  export type ComparisonKind = fltr.Comparison["kind"];

  export interface ComparisonOperator {
    readonly label: string;
    readonly kind: ComparisonKind;
  }

  export type ValueSelector = "FreeString" | "FreeNumber" | "NoSelection";

  export interface ValueSelection {
    readonly kind: "Value";

    readonly veldinfos: ke.VeldInfo[];
    readonly selectedVeldinfo: ke.VeldInfo;
    readonly operatorSelectors: ComparisonOperator[];

    readonly selectedOperator: ComparisonOperator;
    readonly valueSelector: ValueSelector;
  }

  export type SelectedValue = LiteralValue;

  export interface LiteralValue {
    readonly kind: "Literal";
    readonly value: fltr.ValueType;
  }

  export interface Completed {
    readonly kind: "Completed";

    readonly veldinfos: ke.VeldInfo[];
    readonly selectedVeldinfo: ke.VeldInfo;
    readonly operatorSelectors: ComparisonOperator[];
    readonly selectedOperator: ComparisonOperator;
    readonly valueSelector: ValueSelector;

    readonly selectedValue: SelectedValue;
  }

  // Initieer aanmaak van een Comparison
  const FieldSelection: Function1<ke.VectorLaag, FieldSelection> = laag => ({ kind: "Field", veldinfos: maps.values(laag.velden) });

  const OperatorSelector: Function2<string, ComparisonKind, ComparisonOperator> = (label, kind) => ({ label, kind });

  // const freeStringComparatorKinds: ComparisonKind[] = ["Equality", "Inequality", "StartsWith", "EndsWith", "Contains"];
  // const freeStringComparatorLabels: string[] = ["is", "is niet", "begint met", "eindigt met", "bevat"];

  const freeStringOperators: ComparisonOperator[] = [OperatorSelector("is", "Equality"), OperatorSelector("is niet", "Inequality")];

  // Overgang van FieldSelection naar OperatorSelection -> De overgangen zouden beter Validations zijn om er rekening
  // mee te houden dat de overgang eventueel niet mogelijk is. Bijvoorbeeld wanneer een veld opgegeven wordt dat niet in
  // de lijst staat.
  export const OperatorSelection: Function2<FieldSelection, ke.VeldInfo, OperatorSelection> = (selection, veldinfo) => ({
    ...selection,
    kind: "Operator",
    selectedVeldinfo: veldinfo,
    operatorSelectors: fltr.matchTypeTypeWithFallback({
      string: () => freeStringOperators, // Hier moeten we kijken of er unieke waarden zijn
      fallback: () => [] // Geen operatoren voor onbekende types: beter een terminale error operator
    })(veldinfo.type)
  });

  const specificValueSelection: Function3<OperatorSelection, ComparisonOperator, ValueSelector, ValueSelection> = (
    selection,
    selectedOperator,
    valueSelector
  ) => ({
    ...selection,
    kind: "Value",
    selectedOperator,
    valueSelector
  });

  // nooit aanroepen met lege array
  const ConjunctionEditor: Function1<ElementEditor[], ConjunctionEditor> = elementEditors => ({ elementEditors });

  const DisjunctionEditor: Function1<ConjunctionEditor[], DisjunctionsEditor> = conjunctionEditors => ({ conjunctionEditors });

  // Overgang van OperatorSelection naar ValueSelection
  export const ValueSelection: Function2<OperatorSelection, ComparisonOperator, ValueSelection> = (selection, operator) =>
    ke.VeldInfo.matchWithFallback({
      string: vi => specificValueSelection(selection, operator, "FreeString"), // Hier moeten we kijken of er unieke waarden zijn
      fallback: () => specificValueSelection(selection, operator, "NoSelection")
    })(selection.selectedVeldinfo);

  // Overgang van ValueSelection naar Completed
  export const Completed: Function2<ValueSelection, SelectedValue, Completed> = (selection, selectedValue) => ({
    ...selection,
    kind: "Completed",
    selectedValue
  });

  const initConjunctionEditor: Function1<ElementEditor, ConjunctionEditor> = elementEditor => ConjunctionEditor([elementEditor]);

  // Maak een compleete nieuwe builder aan
  export const init: Function1<ke.VectorLaag, ExpressionEditor> = laag => {
    const current = FieldSelection(laag);
    return {
      laag,
      current: current,
      disjunctions: DisjunctionEditor([ConjunctionEditor([current])])
    };
  };

  // Maak een builder aan voor een bestaande expressie
  export const fromExpression: Function2<ke.Laag, fltr.Expression, ExpressionEditor> = (laag, expression) => ({} as ExpressionEditor);

  const currentLens: Lens<ExpressionEditor, ElementEditor> = Lens.fromProp("current");
  const disjunctionsLens: Lens<ExpressionEditor, DisjunctionsEditor> = Lens.fromProp("disjunctions");
  const conjunctionEditorsLens: Lens<DisjunctionsEditor, ConjunctionEditor[]> = Lens.fromProp("conjunctionEditors");
  const elementEditorsLens: Lens<ConjunctionEditor, ElementEditor[]> = Lens.fromProp("elementEditors");
  const conjunctionEditorTraversal: Traversal<ConjunctionEditor[], ConjunctionEditor> = fromTraversable(array.array)<ConjunctionEditor>();
  const elementEditorTraversal: Traversal<ElementEditor[], ElementEditor> = fromTraversable(array.array)<ElementEditor>();

  const sameEditorAs: Function1<ElementEditor, Predicate<ElementEditor>> = ee1 => ee2 => ee1 === ee2;
  const containsSameEditorAs: Function1<ElementEditor, Predicate<ConjunctionEditor>> = ee1 =>
    elementEditorsLens
      .composeTraversal(elementEditorTraversal)
      .asFold()
      .exist(sameEditorAs(ee1));

  const getElementEditorInElementEditorsPrism: Function1<ElementEditor, Prism<ElementEditor, ElementEditor>> = ee =>
    Prism.fromPredicate(sameEditorAs(ee));
  const getElementEditorInConjunctionEditorPrism: Function1<ElementEditor, Prism<ConjunctionEditor, ConjunctionEditor>> = ee =>
    Prism.fromPredicate(containsSameEditorAs(ee));

  const getElementEditorTraversal: Function1<ElementEditor, Traversal<ExpressionEditor, ElementEditor>> = ee =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .composeTraversal(conjunctionEditorTraversal)
      .composeLens(elementEditorsLens)
      .compose(elementEditorTraversal)
      .composePrism(getElementEditorInElementEditorsPrism(ee));

  const getConjunctionEditorTraversal: Function1<ElementEditor, Traversal<ExpressionEditor, ConjunctionEditor>> = ee =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .composeTraversal(conjunctionEditorTraversal)
      .composePrism(getElementEditorInConjunctionEditorPrism(ee));

  // Pas de huidige ElementEditor aan
  export const update: Function1<ElementEditor, Endomorphism<ExpressionEditor>> = elementEditor => expressionEditor => {
    const originalElementEditor = currentLens.get(expressionEditor);
    return applySequential([
      currentLens.set(elementEditor), //
      getElementEditorTraversal(originalElementEditor).set(elementEditor)
    ])(expressionEditor);
  };

  // controleer of het huidige element verwijderd mag worden (geen lege expressies!)
  export const canRemoveCurrent: Predicate<ExpressionEditor> = expressionEditor =>
    expressionEditor.disjunctions.conjunctionEditors.length > 1 ||
    expressionEditor.disjunctions.conjunctionEditors.some(ce => ce.elementEditors.length > 1);

  // verwijder het huidige element
  export const remove: Endomorphism<ExpressionEditor> = expressionEditor => {
    // We kunnen de laatste builder niet verwijderen
    // TODO: later. Vraag is wat de volgende current editor wordt
    return expressionEditor;
  };

  // voeg onderaan een OF toe
  export const addDisjunction: Endomorphism<ExpressionEditor> = expressionEditor =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .modify(de => array.snoc(de, initConjunctionEditor(FieldSelection(expressionEditor.laag))))(expressionEditor);

  // voeg een EN toe op de rij van de huidige ElementEditor
  export const addConjunction: Endomorphism<ExpressionEditor> = expressionEditor => {
    const elementEditor = FieldSelection(expressionEditor.laag);
    return applySequential([
      currentLens.set(elementEditor), //
      getConjunctionEditorTraversal(elementEditor)
        .composeLens(elementEditorsLens)
        .modify(ce => array.snoc(ce, FieldSelection(expressionEditor.laag)))
    ])(expressionEditor);
  };

  // Legacy
  export type FilterBuildElement = ComparisonBuilder; // later ook voor PropertyRangeOperator, enz

  export interface ComparisonBuilder {
    readonly description: string;
    readonly build: Function2<fltr.Property, fltr.Literal, fltr.Comparison>;
  }

  export const comparisonBuilders: ComparisonBuilder[] = [
    { description: "is", build: fltr.Equality },
    { description: "is niet", build: fltr.Inequality }
  ];
}
