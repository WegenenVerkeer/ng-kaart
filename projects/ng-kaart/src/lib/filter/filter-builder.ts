import * as array from "fp-ts/lib/Array";
import { array as ArrayMonad } from "fp-ts/lib/Array";
import {
  Curried2,
  Endomorphism,
  Function1,
  Function2,
  Function3,
  Function4,
  identity,
  not,
  Predicate,
  Refinement
} from "fp-ts/lib/function";
import { fromNullable, none, Option, option, some } from "fp-ts/lib/Option";
import { fromTraversable, Lens, Prism, Traversal } from "monocle-ts";

import * as ke from "../kaart/kaart-elementen";
import * as arrays from "../util/arrays";
import { applySequential } from "../util/function";
import * as maps from "../util/maps";
import * as matchers from "../util/matchers";

import { Filter as fltr } from "./filter-model";

// Hulp bij het bewerken van een filter
export namespace FilterEditor {
  export interface ConjunctionEditor {
    readonly termEditors: TermEditor[];
  }

  export interface DisjunctionsEditor {
    readonly conjunctionEditors: ConjunctionEditor[];
  }

  export interface ExpressionEditor {
    readonly current: TermEditor;
    readonly disjunctions: DisjunctionsEditor;

    readonly name: Option<string>;
    readonly laag: ke.ToegevoegdeVectorLaag;
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

  export const isAtLeastOperatorSelection: Refinement<TermEditor, OperatorSelection> = (termEditor): termEditor is OperatorSelection =>
    termEditor.kind === "Operator" || termEditor.kind === "Value" || termEditor.kind === "Completed";
  export const isAtLeastValueSelection: Refinement<TermEditor, ValueSelection> = (termEditor): termEditor is ValueSelection =>
    termEditor.kind === "Value" || termEditor.kind === "Completed";
  export const isCompleted: Refinement<TermEditor, Completed> = (termEditor): termEditor is Completed => termEditor.kind === "Completed";

  const veldinfos: Function1<ke.ToegevoegdeVectorLaag, ke.VeldInfo[]> = laag =>
    ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag).filter(
      // filter de speciale velden er uit
      veld =>
        fromNullable(veld.label).isSome() &&
        fromNullable(veld.constante).isNone() &&
        fromNullable(veld.template).isNone() &&
        fromNullable(veld.html).isNone()
    );
  const properties: Function1<ke.ToegevoegdeVectorLaag, fltr.Property[]> = laag =>
    veldinfos(laag)
      .map(vi => fltr.Property(vi.type, vi.naam, fromNullable(vi.label).getOrElse(vi.naam)))
      .filter(property => ["string", "boolean", "double", "integer"].includes(property.type));

  // Initieer aanmaak van een Comparison
  const FieldSelection: Function1<ke.ToegevoegdeVectorLaag, FieldSelection> = laag => ({ kind: "Field", properties: properties(laag) });

  const BinaryComparisonOperator: Function3<string, fltr.BinaryComparisonOperator, fltr.TypeType, BinaryComparisonOperator> = (
    label,
    operator,
    typeType
  ) => ({ kind: "BinaryComparisonOperator", label, operator, typeType });

  const freeStringOperators: ComparisonOperator[] = [
    BinaryComparisonOperator("is", "equality", "string"),
    BinaryComparisonOperator("is niet", "inequality", "string"),
    BinaryComparisonOperator("bevat", "contains", "string"),
    BinaryComparisonOperator("start met", "starts", "string"),
    BinaryComparisonOperator("eindigt met", "ends", "string")
  ];

  const freeDoubleOperators: ComparisonOperator[] = [
    BinaryComparisonOperator("is", "equality", "double"),
    BinaryComparisonOperator("is niet", "inequality", "double"),
    BinaryComparisonOperator("<", "smaller", "double"),
    BinaryComparisonOperator("<=", "smallerOrEqual", "double"),
    BinaryComparisonOperator(">", "larger", "double"),
    BinaryComparisonOperator(">=", "largerOrEqual", "double")
  ];

  const freeIntegerOperators: ComparisonOperator[] = [
    BinaryComparisonOperator("is", "equality", "integer"),
    BinaryComparisonOperator("is niet", "inequality", "integer"),
    BinaryComparisonOperator("<", "smaller", "integer"),
    BinaryComparisonOperator("<=", "smallerOrEqual", "integer"),
    BinaryComparisonOperator(">", "larger", "integer"),
    BinaryComparisonOperator(">=", "largerOrEqual", "integer")
  ];

  const booleanOperators: ComparisonOperator[] = [
    BinaryComparisonOperator("is", "equality", "boolean"),
    BinaryComparisonOperator("is niet", "inequality", "boolean")
  ];

  const comparisonOperatorMap: Map<fltr.BinaryComparisonOperator, string> = maps.toMapByKeyAndValue(
    ArrayMonad.chain([freeStringOperators, freeIntegerOperators, freeDoubleOperators, booleanOperators], identity),
    op => op.operator,
    op => op.label
  );

  const binaryComparisonOperator: Function2<fltr.BinaryComparisonOperator, fltr.Literal, BinaryComparisonOperator> = (operator, literal) =>
    BinaryComparisonOperator(
      comparisonOperatorMap.get(operator)!, // We moeten er maar voor zorgen dat onze map volledig is
      operator,
      literal.type
    );

  const operatorSelectors: Function1<fltr.Property, ComparisonOperator[]> = property =>
    fltr.matchTypeTypeWithFallback({
      string: () => freeStringOperators, // Hier moeten we kijken of er unieke waarden zijn
      double: () => freeDoubleOperators,
      integer: () => freeIntegerOperators,
      fallback: () => [] // Geen operatoren voor onbekende types: beter een terminale error operator
    })(property.type);

  // Overgang van FieldSelection naar OperatorSelection -> De overgangen zouden beter Validations zijn om er rekening
  // mee te houden dat de overgang eventueel niet mogelijk is. Bijvoorbeeld wanneer een veld opgegeven wordt dat niet in
  // de lijst staat.
  export const OperatorSelection: Curried2<fltr.Property, FieldSelection, OperatorSelection> = property => selection => ({
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
  export const ValueSelection: Curried2<ComparisonOperator, OperatorSelection, ValueSelection> = operator => selection =>
    fltr.matchTypeTypeWithFallback({
      string: () => specificValueSelection(selection, operator, "FreeString"), // Hier moeten we kijken of er unieke waarden zijn
      fallback: () => specificValueSelection(selection, operator, "NoSelection")
    })(selection.selectedProperty.type);

  // Overgang van ValueSelection naar Completed
  export const Completed: Curried2<SelectedValue, ValueSelection, Completed> = selectedValue => selection => ({
    ...selection,
    kind: "Completed",
    selectedValue
  });

  const initConjunctionEditor: Function1<TermEditor, ConjunctionEditor> = termEditor => ConjunctionEditor([termEditor]);

  // Maak een compleete nieuwe builder aan
  export const init: Function1<ke.ToegevoegdeVectorLaag, ExpressionEditor> = laag => {
    const current = FieldSelection(laag);
    return {
      laag,
      name: none,
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

  const sameTermEditorAs: Function1<TermEditor, Predicate<TermEditor>> = ee1 => ee2 => ee1 === ee2;
  const differentTermEditorFrom: Function1<TermEditor, Predicate<TermEditor>> = ee => not(sameTermEditorAs(ee));
  const sameConjuctionEditorAs: Function1<ConjunctionEditor, Predicate<ConjunctionEditor>> = conj1 => conj2 => conj1 === conj2;
  const containsSameEditorAs: Function1<TermEditor, Predicate<ConjunctionEditor>> = ee1 =>
    termEditorsLens
      .composeTraversal(termEditorTraversal)
      .asFold()
      .exist(sameTermEditorAs(ee1));

  const getTermEditorInTermEditorsPrism: Function1<TermEditor, Prism<TermEditor, TermEditor>> = ee =>
    Prism.fromPredicate(sameTermEditorAs(ee));
  const getTermEditorInConjunctionEditorPrism: Function1<TermEditor, Prism<ConjunctionEditor, ConjunctionEditor>> = ee =>
    Prism.fromPredicate(containsSameEditorAs(ee));
  const getConjunctionEditorPrism: Function1<ConjunctionEditor, Prism<ConjunctionEditor, ConjunctionEditor>> = conj =>
    Prism.fromPredicate(sameConjuctionEditorAs(conj));
  const nameLens: Lens<ExpressionEditor, Option<string>> = Lens.fromProp("name");

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

  export const setName: Function1<Option<string>, Endomorphism<ExpressionEditor>> = nameLens.set;

  export const setCurrent: Function1<TermEditor, Endomorphism<ExpressionEditor>> = currentLens.set;

  export const isCurrent: Function1<ExpressionEditor, Predicate<TermEditor>> = expressionEditor =>
    sameTermEditorAs(currentLens.get(expressionEditor));

  // Controleer of het huidige element verwijderd mag worden (geen lege expressies!)
  export const canRemoveCurrent: Predicate<ExpressionEditor> = expressionEditor =>
    expressionEditor.disjunctions.conjunctionEditors.length > 1 ||
    expressionEditor.disjunctions.conjunctionEditors.some(ce => ce.termEditors.length > 1);

  const reallyRemove: Endomorphism<ExpressionEditor> = expressionEditor => {
    const affectedConjunctionEditorTraversal = getConjunctionEditorForTermEditorTraversal(expressionEditor.current);
    // De ExpressionEditor zonder current in de disjunctions (heeft mogelijks lege conjunctions)
    const unsafeRemoved = affectedConjunctionEditorTraversal
      .composeLens(termEditorsLens)
      .modify(terms => array.filter(terms, differentTermEditorFrom(expressionEditor.current)))(expressionEditor);
    // We moeten er voor zorgen dat er geen conjunctions zonder terms in zijn
    const normalised = disjunctionsLens
      .compose(conjunctionEditorsLens)
      .modify(conjunctionEditors =>
        array.filter(conjunctionEditors, conjunctionEditor => arrays.isNonEmpty(conjunctionEditor.termEditors))
      )(unsafeRemoved);
    // De laatste TermEditor in dezelfde ConjunctionEditor als current
    const maybeLastSibling = affectedConjunctionEditorTraversal
      .composeLens(termEditorsLens)
      .asFold()
      .headOption(expressionEditor)
      .chain(terms => array.findLast(terms, differentTermEditorFrom(expressionEditor.current)));
    // Met NonEmptyArray ipv Array zou `last` veel properder zijn
    const next = maybeLastSibling.getOrElseL(
      () =>
        array
          .last(normalised.disjunctions.conjunctionEditors)
          .chain(ce => array.last(ce.termEditors))
          .getOrElse(expressionEditor.current) // Omdat de arrays niet leeg kunnen zijn, weten we dat dit nooit nodig zal zijn
    );
    return setCurrent(next)(normalised);
  };

  // Verwijder het huidige element
  export const remove: Endomorphism<ExpressionEditor> = expressionEditor => {
    // We kunnen de laatste builder niet verwijderen. Wanneer we het huidige element in de conjunction verwijderen, dan
    // maken we de laatste term in de conjunction het nieuwe huidige element. Indien er geen is, dan gaan we naar de de
    // laatste term van de laatste disjunction.
    return canRemoveCurrent(expressionEditor) ? reallyRemove(expressionEditor) : expressionEditor;
  };

  // voeg onderaan een OF toe
  export const addDisjunction: Endomorphism<ExpressionEditor> = expressionEditor =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .modify(de => array.snoc(de, initConjunctionEditor(FieldSelection(expressionEditor.laag))))(expressionEditor);

  // voeg een EN toe op geselecteerde rij van de huidige TermEditor, en maak die de nieuwe actieve
  export const addConjunction: Function1<ConjunctionEditor, Endomorphism<ExpressionEditor>> = conjunctionEditor => expressionEditor => {
    const newEditor = FieldSelection(expressionEditor.laag);
    const conjunctionAdded = getConjunctionEditorTraversal(conjunctionEditor)
      .composeLens(termEditorsLens)
      .modify(ce => array.snoc(ce, newEditor))(expressionEditor);
    return setCurrent(newEditor)(conjunctionAdded);
  };

  const ExpressionEditor: Function4<Option<string>, ke.ToegevoegdeVectorLaag, TermEditor, DisjunctionsEditor, ExpressionEditor> = (
    name,
    laag,
    current,
    disjunctions
  ) => ({ name, laag, current, disjunctions });

  const completedTermEditor: Function2<ke.ToegevoegdeVectorLaag, fltr.Comparison, TermEditor> = (laag, comparison) => ({
    kind: "Completed",
    properties: properties(laag),
    selectedProperty: comparison.property,
    operatorSelectors: operatorSelectors(comparison.property),
    selectedOperator: binaryComparisonOperator(comparison.operator, comparison.value),
    selectedValue: comparison.value,
    valueSelector: "FreeString" // TODO laten afhangen van type
  });

  const fromComparison: Function3<Option<string>, ke.ToegevoegdeVectorLaag, fltr.Comparison, ExpressionEditor> = (
    name,
    laag,
    comparison
  ) => {
    const current: TermEditor = completedTermEditor(laag, comparison);
    return ExpressionEditor(name, laag, current, DisjunctionEditor([ConjunctionEditor([current])]));
  };

  const toConjunctionEditor: Function2<ke.ToegevoegdeVectorLaag, fltr.ConjunctionExpression, ConjunctionEditor> = (laag, expression) => {
    switch (expression.kind) {
      case "And":
        return ConjunctionEditor(ArrayMonad.chain([expression.left, expression.right], exp => toConjunctionEditor(laag, exp).termEditors));
      case "BinaryComparison":
        return ConjunctionEditor([completedTermEditor(laag, expression)]);
    }
  };

  const fromConjunction: Function3<Option<string>, ke.ToegevoegdeVectorLaag, fltr.Conjunction, ExpressionEditor> = (
    name,
    laag,
    conjunction
  ) => {
    const conjunctionEditor = toConjunctionEditor(laag, conjunction);
    const current = conjunctionEditor.termEditors[0]; // Bij constructie heeft een Conjunction minstens 2 comparisons
    return ExpressionEditor(name, laag, current, DisjunctionEditor([conjunctionEditor]));
  };

  const toDisjunctionsEditor: Function2<ke.ToegevoegdeVectorLaag, fltr.Expression, DisjunctionsEditor> = (laag, expression) => {
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

  const fromDisjunction: Function3<Option<string>, ke.ToegevoegdeVectorLaag, fltr.Disjunction, ExpressionEditor> = (
    name,
    laag,
    disjunction
  ) => {
    const disjunctions = toDisjunctionsEditor(laag, disjunction);
    // Bij constructie minstens 2 conjunctions en elke conjunction minstens 1 comparison
    const current = disjunctions.conjunctionEditors[0].termEditors[0];
    return ExpressionEditor(name, laag, current, disjunctions);
  };

  // Maak een builder aan voor een bestaande expressie
  const fromExpression: Function3<Option<string>, ke.ToegevoegdeVectorLaag, fltr.Expression, ExpressionEditor> = (name, laag, expression) =>
    fltr.matchExpression({
      And: expr => fromConjunction(name, laag, expr),
      Or: expr => fromDisjunction(name, laag, expr),
      BinaryComparison: expr => fromComparison(name, laag, expr)
    })(expression);

  export const fromToegevoegdeVectorLaag: Function1<ke.ToegevoegdeVectorLaag, ExpressionEditor> = laag =>
    fltr.matchFilter({
      EmptyFilter: () => init(laag),
      ExpressionFilter: expr => fromExpression(expr.name, laag, expr.expression)
    })(laag.filterinstellingen.spec);

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

  const toExpression: Function1<ExpressionEditor, Option<fltr.Expression>> = expressionEditor =>
    toDisjunctionExpression(expressionEditor.disjunctions.conjunctionEditors);

  export const toExpressionFilter: Function1<ExpressionEditor, Option<fltr.ExpressionFilter>> = expressionEditor =>
    toExpression(expressionEditor).map(expression => fltr.ExpressionFilter(expressionEditor.name, expression));

  export interface TermEditorMatcher<A> {
    readonly Field: Function1<FieldSelection, A>;
    readonly Operator: Function1<OperatorSelection, A>;
    readonly Value: Function1<ValueSelection, A>;
    readonly Completed: Function1<Completed, A>;
  }

  export const matchTermEditor: <A>(_: TermEditorMatcher<A>) => Function1<TermEditor, A> = matchers.matchKind;
}
