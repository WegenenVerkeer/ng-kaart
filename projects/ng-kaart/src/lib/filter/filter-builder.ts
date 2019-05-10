import * as array from "fp-ts/lib/Array";
import { array as ArrayMonad } from "fp-ts/lib/Array";
import { Endomorphism, Function1, Function2, Function3, Predicate } from "fp-ts/lib/function";
import { none, Option, option, some } from "fp-ts/lib/Option";
import { fromTraversable, Lens, Prism, Traversal } from "monocle-ts";

import * as ke from "../kaart/kaart-elementen";
import { applySequential } from "../util/function";
import * as maps from "../util/maps";

import { Filter as fltr } from "./filter-model";

// Hulp bij het opbouwen van een filter
export namespace FilterBuilder {
  export interface ConjunctionEditor {
    readonly termEditors: TermEditor[];
  }

  export interface DisjunctionsEditor {
    readonly conjunctionEditors: ConjunctionEditor[];
  }

  export interface ExpressionEditor {
    readonly current: TermEditor;
    readonly disjunctions: DisjunctionsEditor;

    readonly laag: ke.VectorLaag;
  }

  export type TermEditor = FieldSelection | OperatorSelection | ValueSelection | Completed;

  export interface FieldSelection {
    readonly kind: "Field";

    readonly properties: fltr.Property[];
  }

  export interface OperatorSelection {
    readonly kind: "Operator";

    readonly properties: fltr.Property[];

    readonly selectedProperty: fltr.Property;
    readonly operatorSelectors: ComparisonOperator[];
  }

  export type ComparisonOperator = BinaryComparisonOperator;
  export interface BinaryComparisonOperator {
    readonly kind: "BinaryComparisonOperator";
    readonly label: string;
    readonly operator: fltr.BinaryComparisonOperator;
    readonly typeType: fltr.TypeType;
  }

  export type ValueSelector = "FreeString" | "FreeNumber" | "NoSelection";

  export interface ValueSelection {
    readonly kind: "Value";

    readonly properties: fltr.Property[];
    readonly selectedProperty: fltr.Property;
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

    readonly properties: fltr.Property[];
    readonly selectedProperty: fltr.Property;
    readonly operatorSelectors: ComparisonOperator[];
    readonly selectedOperator: ComparisonOperator;
    readonly valueSelector: ValueSelector;

    readonly selectedValue: SelectedValue;
  }

  const veldinfos: Function1<ke.VectorLaag, ke.VeldInfo[]> = laag => maps.values(laag.velden);
  const properties: Function1<ke.VectorLaag, fltr.Property[]> = laag =>
    veldinfos(laag).map(vi => fltr.Property(vi.type, vi.naam, vi.label));

  // Initieer aanmaak van een Comparison
  const FieldSelection: Function1<ke.VectorLaag, FieldSelection> = laag => ({ kind: "Field", properties: properties(laag) });

  const BinaryComparisonOperator: Function3<string, fltr.BinaryComparisonOperator, fltr.TypeType, BinaryComparisonOperator> = (
    label,
    operator,
    typeType
  ) => ({ kind: "BinaryComparisonOperator", label, operator, typeType });

  const comparisonOperatorMap = {
    equality: "is",
    inequality: "is niet"
  };

  const binaryComparisonOperator: Function2<fltr.BinaryComparisonOperator, fltr.Literal, BinaryComparisonOperator> = (operator, literal) =>
    BinaryComparisonOperator(comparisonOperatorMap[operator], operator, literal.type);

  const freeStringOperators: ComparisonOperator[] = [
    BinaryComparisonOperator("is", "equality", "string"),
    BinaryComparisonOperator("is niet", "inequality", "string")
  ];

  const operatorSelectors: Function1<fltr.Property, ComparisonOperator[]> = property =>
    fltr.matchTypeTypeWithFallback({
      string: () => freeStringOperators, // Hier moeten we kijken of er unieke waarden zijn
      fallback: () => [] // Geen operatoren voor onbekende types: beter een terminale error operator
    })(property.type);

  // Overgang van FieldSelection naar OperatorSelection -> De overgangen zouden beter Validations zijn om er rekening
  // mee te houden dat de overgang eventueel niet mogelijk is. Bijvoorbeeld wanneer een veld opgegeven wordt dat niet in
  // de lijst staat.
  export const OperatorSelection: Function2<FieldSelection, fltr.Property, OperatorSelection> = (selection, property) => ({
    ...selection,
    kind: "Operator",
    selectedProperty: property,
    operatorSelectors: operatorSelectors(property)
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
  const ConjunctionEditor: Function1<TermEditor[], ConjunctionEditor> = termEditors => ({ termEditors });

  const DisjunctionEditor: Function1<ConjunctionEditor[], DisjunctionsEditor> = conjunctionEditors => ({ conjunctionEditors });

  // Overgang van OperatorSelection naar ValueSelection
  export const ValueSelection: Function2<OperatorSelection, ComparisonOperator, ValueSelection> = (selection, operator) =>
    fltr.matchTypeTypeWithFallback({
      string: () => specificValueSelection(selection, operator, "FreeString"), // Hier moeten we kijken of er unieke waarden zijn
      fallback: () => specificValueSelection(selection, operator, "NoSelection")
    })(selection.selectedProperty.type);

  // Overgang van ValueSelection naar Completed
  export const Completed: Function2<ValueSelection, SelectedValue, Completed> = (selection, selectedValue) => ({
    ...selection,
    kind: "Completed",
    selectedValue
  });

  const initConjunctionEditor: Function1<TermEditor, ConjunctionEditor> = termEditor => ConjunctionEditor([termEditor]);

  // Maak een compleete nieuwe builder aan
  export const init: Function1<ke.VectorLaag, ExpressionEditor> = laag => {
    const current = FieldSelection(laag);
    return {
      laag,
      current: current,
      disjunctions: DisjunctionEditor([ConjunctionEditor([current])])
    };
  };

  const currentLens: Lens<ExpressionEditor, TermEditor> = Lens.fromProp("current");
  const disjunctionsLens: Lens<ExpressionEditor, DisjunctionsEditor> = Lens.fromProp("disjunctions");
  const conjunctionEditorsLens: Lens<DisjunctionsEditor, ConjunctionEditor[]> = Lens.fromProp("conjunctionEditors");
  const termEditorsLens: Lens<ConjunctionEditor, TermEditor[]> = Lens.fromProp("termEditors");
  const conjunctionEditorTraversal: Traversal<ConjunctionEditor[], ConjunctionEditor> = fromTraversable(array.array)<ConjunctionEditor>();
  const termEditorTraversal: Traversal<TermEditor[], TermEditor> = fromTraversable(array.array)<TermEditor>();

  const sameEditorAs: Function1<TermEditor, Predicate<TermEditor>> = ee1 => ee2 => ee1 === ee2;
  const sameConjuctionEditorAs: Function1<ConjunctionEditor, Predicate<ConjunctionEditor>> = conj1 => conj2 => conj1 === conj2;
  const containsSameEditorAs: Function1<TermEditor, Predicate<ConjunctionEditor>> = ee1 =>
    termEditorsLens
      .composeTraversal(termEditorTraversal)
      .asFold()
      .exist(sameEditorAs(ee1));

  const getTermEditorInTermEditorsPrism: Function1<TermEditor, Prism<TermEditor, TermEditor>> = ee => Prism.fromPredicate(sameEditorAs(ee));
  const getTermEditorInConjunctionEditorPrism: Function1<TermEditor, Prism<ConjunctionEditor, ConjunctionEditor>> = ee =>
    Prism.fromPredicate(containsSameEditorAs(ee));
  const getConjunctionEditorPrism: Function1<ConjunctionEditor, Prism<ConjunctionEditor, ConjunctionEditor>> = conj =>
    Prism.fromPredicate(sameConjuctionEditorAs(conj));

  const getTermEditorTraversal: Function1<TermEditor, Traversal<ExpressionEditor, TermEditor>> = ee =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .composeTraversal(conjunctionEditorTraversal)
      .composeLens(termEditorsLens)
      .compose(termEditorTraversal)
      .composePrism(getTermEditorInTermEditorsPrism(ee));

  const getConjunctionEditorForTermEditorTraversal: Function1<TermEditor, Traversal<ExpressionEditor, ConjunctionEditor>> = ee =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .composeTraversal(conjunctionEditorTraversal)
      .composePrism(getTermEditorInConjunctionEditorPrism(ee));

  const getConjunctionEditorTraversal: Function1<ConjunctionEditor, Traversal<ExpressionEditor, ConjunctionEditor>> = conj =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .composeTraversal(conjunctionEditorTraversal)
      .composePrism(getConjunctionEditorPrism(conj));

  // Pas de huidige TermEditor aan
  export const update: Function1<TermEditor, Endomorphism<ExpressionEditor>> = termEditor => expressionEditor => {
    const originalTermEditor = currentLens.get(expressionEditor);
    return applySequential([
      currentLens.set(termEditor), //
      getTermEditorTraversal(originalTermEditor).set(termEditor)
    ])(expressionEditor);
  };

  export const setCurrent: Function1<TermEditor, Endomorphism<ExpressionEditor>> = currentLens.set;

  export const isCurrent: Function1<ExpressionEditor, Predicate<TermEditor>> = expressionEditor =>
    sameEditorAs(currentLens.get(expressionEditor));

  // controleer of het huidige element verwijderd mag worden (geen lege expressies!)
  export const canRemoveCurrent: Predicate<ExpressionEditor> = expressionEditor =>
    expressionEditor.disjunctions.conjunctionEditors.length > 1 ||
    expressionEditor.disjunctions.conjunctionEditors.some(ce => ce.termEditors.length > 1);

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

  // voeg een EN toe op geselecteerde rij van de huidige TermEditor
  export const addConjunction: Function1<ConjunctionEditor, Endomorphism<ExpressionEditor>> = conjunctionEditor => expressionEditor =>
    getConjunctionEditorTraversal(conjunctionEditor)
      .composeLens(termEditorsLens)
      .modify(ce => array.snoc(ce, FieldSelection(expressionEditor.laag)))(expressionEditor);

  const ExpressionEditor: Function3<ke.VectorLaag, TermEditor, DisjunctionsEditor, ExpressionEditor> = (laag, current, disjunctions) => ({
    laag,
    current,
    disjunctions
  });

  const completedTermEditor: Function2<ke.VectorLaag, fltr.Comparison, TermEditor> = (laag, comparison) => ({
    kind: "Completed",
    properties: properties(laag),
    selectedProperty: comparison.property,
    operatorSelectors: operatorSelectors(comparison.property),
    selectedOperator: binaryComparisonOperator(comparison.operator, comparison.value),
    selectedValue: comparison.value,
    valueSelector: "FreeString" // TODO laten afhangen van type
  });

  const fromComparison: Function2<ke.VectorLaag, fltr.Comparison, ExpressionEditor> = (laag, comparison) => {
    const current: TermEditor = completedTermEditor(laag, comparison);
    return ExpressionEditor(laag, current, DisjunctionEditor([ConjunctionEditor([current])]));
  };

  const toConjunctionEditor: Function2<ke.VectorLaag, fltr.ConjunctionExpression, ConjunctionEditor> = (laag, expression) => {
    switch (expression.kind) {
      case "And":
        return ConjunctionEditor(ArrayMonad.chain([expression.left, expression.right], exp => toConjunctionEditor(laag, exp).termEditors));
      case "BinaryComparison":
        return ConjunctionEditor([completedTermEditor(laag, expression)]);
    }
  };

  const fromConjunction: Function2<ke.VectorLaag, fltr.Conjunction, ExpressionEditor> = (laag, conjunction) => {
    const conjunctionEditor = toConjunctionEditor(laag, conjunction);
    const current = conjunctionEditor.termEditors[0]; // Bij constructie heeft een Conjunction minstens 2 comparisons
    return ExpressionEditor(laag, current, DisjunctionEditor([conjunctionEditor]));
  };

  const toDisjunctionsEditor: Function2<ke.VectorLaag, fltr.Expression, DisjunctionsEditor> = (laag, expression) => {
    switch (expression.kind) {
      case "Or":
        return DisjunctionEditor(
          ArrayMonad.chain([expression.left, expression.right], exp => toDisjunctionsEditor(laag, exp).conjunctionEditors)
        );
      case "And":
        return DisjunctionEditor([toConjunctionEditor(laag, expression)]);
      case "BinaryComparison":
        return DisjunctionEditor([ConjunctionEditor([completedTermEditor(laag, expression)])]);
    }
  };

  const fromDisjunction: Function2<ke.VectorLaag, fltr.Disjunction, ExpressionEditor> = (laag, disjunction) => {
    const disjunctions = toDisjunctionsEditor(laag, disjunction);
    // Bij constructie minstens 2 conjunctions en elke conjunction minstens 1 comparison
    const current = disjunctions.conjunctionEditors[0].termEditors[0];
    return ExpressionEditor(laag, current, disjunctions);
  };

  // Maak een builder aan voor een bestaande expressie
  export const fromExpression: Function2<ke.VectorLaag, fltr.Expression, ExpressionEditor> = (laag, expression) =>
    fltr.matchExpression({
      And: expr => fromConjunction(laag, expr),
      Or: expr => fromDisjunction(laag, expr),
      BinaryComparison: expr => fromComparison(laag, expr)
    })(expression);

  const toLiteral: Function2<ComparisonOperator, LiteralValue, fltr.Literal> = (operator, lv) => fltr.Literal(operator.typeType, lv.value);

  const toComparison: Function1<TermEditor, Option<fltr.Comparison>> = termEditor => {
    switch (termEditor.kind) {
      case "Completed":
        return some(
          fltr.BinaryComparison(
            termEditor.selectedOperator.operator,
            termEditor.selectedProperty,
            toLiteral(termEditor.selectedOperator, termEditor.selectedValue)
          )
        );
      default:
        return none; // De uiteindelijke conversie naar Expression zal falen als er ook maar 1 TermEditor niet Completed is
    }
  };

  const toConjunctionExpression: Function1<TermEditor[], Option<fltr.ConjunctionExpression>> = termEditors =>
    ArrayMonad.traverse(option)(termEditors, toComparison).chain(comps =>
      array.fold(
        comps,
        array.head(comps), // ingeval er maar 1 element is, bnehouden we dat gewoon
        (first, next) => some(next.reduce<fltr.ConjunctionExpression>((sum, val) => fltr.Conjunction(sum, val), first))
      )
    );

  const toDisjunctionExpression: Function1<ConjunctionEditor[], Option<fltr.Expression>> = conjunctionEditors =>
    ArrayMonad.traverse(option)(conjunctionEditors.map(ce => ce.termEditors), toConjunctionExpression).chain(conjs =>
      array.fold(
        conjs,
        array.head(conjs), // ingeval er maar 1 element is, bnehouden we dat gewoon
        (first, next) => some(next.reduce<fltr.Expression>((sum, val) => fltr.Disjunction(sum, val), first))
      )
    );

  export const toExpression: Function1<ExpressionEditor, Option<fltr.Expression>> = expressionEditor =>
    toDisjunctionExpression(expressionEditor.disjunctions.conjunctionEditors);
}
