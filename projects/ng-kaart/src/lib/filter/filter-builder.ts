import { eq, option } from "fp-ts";
import * as array from "fp-ts/lib/Array";
import { array as ArrayMonad } from "fp-ts/lib/Array";
import {
  Curried2,
  Curried3,
  Endomorphism,
  flow,
  Function1,
  Function2,
  Function3,
  Function4,
  Function5,
  Lazy,
  not,
  Predicate,
  Refinement
} from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { ordString } from "fp-ts/lib/Ord";
import { pipe } from "fp-ts/lib/pipeable";
import {
  contramap,
  fromEquals,
  getArraySetoid,
  getRecordSetoid,
  getTupleSetoid,
  Setoid,
  setoidString,
  strictEqual
} from "fp-ts/lib/Setoid";
import { fromTraversable, Lens, Prism, Traversal } from "monocle-ts";

import * as ke from "../kaart/kaart-elementen";
import * as arrays from "../util/arrays";
import { parseDate } from "../util/date-time";
import { applySequential, PartialFunction1 } from "../util/function";
import * as maps from "../util/maps";
import * as matchers from "../util/matchers";
import { byKindSetoid, singletonSetoid } from "../util/setoid";

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

  export type TermEditor = FieldSelection | OperatorSelection | ValueSelection | Completed | CompletedWithValue;

  export interface Property extends fltr.Property {
    readonly distinctValues: string[];
  }

  export type ValueSelector = FreeInputValueSelector | SelectionValueSelector | RangeValueSelector | DateValueSelector | EmptyValueSelector;

  export type FreeInputValueType = "string" | "integer" | "double";

  export interface FreeInputValueSelector {
    readonly kind: "free";
    readonly valueType: FreeInputValueType;
  }

  export type SelectionType = "autocomplete" | "dropdown";

  export interface SelectionValueSelector {
    readonly kind: "selection";
    readonly selectionType: SelectionType;
    readonly values: string[];
  }

  export interface RangeValue {
    readonly label: string;
    readonly value: string;
  }

  export interface RangeValueSelector {
    readonly kind: "range";
    readonly valueType: FreeInputValueType;
    readonly values: RangeValue[];
  }

  export type DateType = "date";

  export interface DateValueSelector {
    readonly kind: "date";
    readonly dateType: DateType;
  }

  export interface EmptyValueSelector {
    readonly kind: "empty";
  }

  export interface FieldSelection {
    readonly kind: "Field";

    readonly properties: Property[];
  }

  export interface OperatorSelection {
    readonly kind: "Operator";

    readonly properties: Property[];

    readonly selectedProperty: Property;
    readonly operatorSelectors: ComparisonOperator[];

    readonly valueSelector: ValueSelector; // Deze ValueSelector is maar voorlopig. Kan verfijnd worden wanneer de operator gekozen is.
  }

  export type ComparisonOperator = BinaryComparisonOperator | UnaryComparisonOperator;

  export interface BinaryComparisonOperator {
    readonly kind: "BinaryComparisonOperator";
    readonly label: string;
    readonly shortLabel: string;
    readonly operator: fltr.BinaryComparisonOperator;
    readonly typeType: fltr.TypeType;
  }

  export interface UnaryComparisonOperator {
    readonly kind: "UnaryComparisonOperator";
    readonly label: string;
    readonly shortLabel: string;
    readonly operator: fltr.UnaryComparisonOperator;
  }

  export interface ValueSelection {
    readonly kind: "Value";

    readonly properties: Property[];
    readonly selectedProperty: Property;
    readonly operatorSelectors: ComparisonOperator[];

    readonly selectedOperator: ComparisonOperator;
    readonly caseSensitive: boolean;
    readonly valueSelector: ValueSelector;
    readonly workingValue: Option<SelectedValue>; // Om voorlopig ongeldige ingevoerde waarde bij te houden
  }

  export type SelectedValue = LiteralValue;

  export interface LiteralValue {
    readonly kind: "Literal";
    readonly value: fltr.ValueType;
    readonly valueType: fltr.TypeType; // We moeten onze eerstecommuniezieltje beloven dat overeenkomt met ValueType
  }

  export interface Completed {
    readonly kind: "Completed";

    readonly properties: Property[];
    readonly selectedProperty: Property;
    readonly operatorSelectors: ComparisonOperator[];
    readonly selectedOperator: UnaryComparisonOperator;
    readonly valueSelector: EmptyValueSelector;
  }

  export interface CompletedWithValue {
    readonly kind: "CompletedWithValue";

    readonly properties: Property[];
    readonly selectedProperty: Property;
    readonly operatorSelectors: ComparisonOperator[];
    readonly selectedOperator: BinaryComparisonOperator;
    readonly caseSensitive: boolean;
    readonly valueSelector: ValueSelector;

    readonly selectedValue: SelectedValue;
  }

  const Property: Function5<fltr.TypeType, string, string, Option<string>, string[], Property> = (
    typetype,
    name,
    label,
    sqlFormat,
    distinctValues
  ) => ({
    kind: "Property",
    type: typetype,
    ref: name,
    label,
    sqlFormat,
    distinctValues
  });

  export const LiteralValue: Curried2<fltr.TypeType, fltr.ValueType, LiteralValue> = valueType => value => ({
    kind: "Literal",
    value,
    valueType
  });

  export const isAtLeastOperatorSelection: Refinement<TermEditor, OperatorSelection> = (termEditor): termEditor is OperatorSelection =>
    termEditor.kind === "Operator" ||
    termEditor.kind === "Value" ||
    termEditor.kind === "Completed" ||
    termEditor.kind === "CompletedWithValue";
  export const isAtLeastValueSelection: Refinement<TermEditor, ValueSelection> = (termEditor): termEditor is ValueSelection =>
    termEditor.kind === "Value" || termEditor.kind === "Completed" || termEditor.kind === "CompletedWithValue";
  export const isCompleted: Refinement<TermEditor, Completed> = (termEditor): termEditor is Completed => termEditor.kind === "Completed";

  // We zijn heel conservatief en laten enkel kolommen met ASCII letters, underscore en punt toe
  const hasAcceptableName: Predicate<ke.VeldInfo> = veld => veld.naam.match(/^[\w\.]+$/) !== null;

  const veldinfos: Function1<ke.ToegevoegdeVectorLaag, ke.VeldInfo[]> = laag =>
    ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag).filter(
      // filter de speciale velden er uit
      veld =>
        fromNullable(veld.label).isSome() &&
        fromNullable(veld.constante).isNone() &&
        fromNullable(veld.template).isNone() &&
        fromNullable(veld.html).isNone() &&
        hasAcceptableName(veld)
    );

  type SimplePropertyType = Exclude<fltr.TypeType, "range">;
  const isAcceptedVeldType: Refinement<ke.VeldType, SimplePropertyType> = (t): t is SimplePropertyType =>
    array.elem(eq.eqString)(t, ["string", "boolean", "double", "integer", "date"]);

  const asAcceptedVeldType: PartialFunction1<ke.VeldType, fltr.TypeType> = option.fromRefinement(isAcceptedVeldType);

  const properties: (laag: ke.ToegevoegdeVectorLaag) => Property[] = flow(
    veldinfos,
    array.filterMap(vi =>
      pipe(
        vi.type,
        asAcceptedVeldType,
        option.map(typetype =>
          Property(
            typetype,
            vi.naam,
            fromNullable(vi.label).getOrElse(vi.naam),
            fromNullable(vi.sqlFormat),
            array.sort(ordString)(arrays.fromNullable(vi.uniekeWaarden))
          )
        )
      )
    )
  );

  // Initieer aanmaak van een Comparison
  const FieldSelection: Function1<ke.ToegevoegdeVectorLaag, TermEditor> = laag => ({ kind: "Field", properties: properties(laag) });

  const BinaryComparisonOperator: Function4<string, string, fltr.BinaryComparisonOperator, fltr.TypeType, BinaryComparisonOperator> = (
    label,
    shortLabel,
    operator,
    typeType
  ) => ({ kind: "BinaryComparisonOperator", label, shortLabel, operator, typeType });

  const UnaryComparisonOperator: Function3<string, string, fltr.UnaryComparisonOperator, UnaryComparisonOperator> = (
    label,
    shortLabel,
    operator
  ) => ({ kind: "UnaryComparisonOperator", label, shortLabel, operator });

  const unaryOperators: UnaryComparisonOperator[] = [
    UnaryComparisonOperator("heeft geen waarde", "heeft geen waarde", "isEmpty"),
    UnaryComparisonOperator("heeft een waarde", "heeft een waarde", "isNotEmpty")
  ];

  const stringOperators = [
    BinaryComparisonOperator("is", "is", "equality", "string"),
    BinaryComparisonOperator("is niet", "is niet", "inequality", "string"),
    BinaryComparisonOperator("bevat", "bevat", "contains", "string"),
    BinaryComparisonOperator("start met", "start met", "starts", "string"),
    BinaryComparisonOperator("eindigt met", "eindigt met", "ends", "string"),
    ...unaryOperators
  ];

  const numberOperatorsGen: Function1<fltr.TypeType, ComparisonOperator[]> = typeType => [
    BinaryComparisonOperator("is", "is", "equality", typeType),
    BinaryComparisonOperator("is niet", "is niet", "inequality", typeType),
    BinaryComparisonOperator("kleiner dan", "<", "smaller", typeType),
    BinaryComparisonOperator("kleiner dan of gelijk aan", "<=", "smallerOrEqual", typeType),
    BinaryComparisonOperator("groter dan", ">", "larger", typeType),
    BinaryComparisonOperator("groter dan of gelijk aan", ">=", "largerOrEqual", typeType),
    ...unaryOperators
  ];

  const doubleOperators = numberOperatorsGen("double");
  const integerOperators = numberOperatorsGen("integer");

  const booleanOperators: ComparisonOperator[] = [
    BinaryComparisonOperator("is waar", "is waar", "equality", "boolean"),
    BinaryComparisonOperator("is niet waar", "is niet waar", "inequality", "boolean"),
    ...unaryOperators
  ];

  const dateOperators = [
    BinaryComparisonOperator("op", "op", "equality", "date"),
    BinaryComparisonOperator("niet op", "niet op", "inequality", "date"),
    BinaryComparisonOperator("tot", "tot", "smaller", "date"),
    BinaryComparisonOperator("tot en met", "tot en met", "smallerOrEqual", "date"),
    BinaryComparisonOperator("na", "na", "larger", "date"),
    BinaryComparisonOperator("vanaf", "vanaf", "largerOrEqual", "date"),
    BinaryComparisonOperator("laatste", "binnen laatste", "within", "range"),
    ...unaryOperators
  ];

  interface OperatorLabels {
    readonly label: string;
    readonly shortLabel: string;
  }

  const fullOperatorMap: Function1<ComparisonOperator[], Map<fltr.ComparisonOperator, OperatorLabels>> = operators =>
    maps.toMapByKeyAndValue(operators, op => op.operator, op => ({ label: op.label, shortLabel: op.shortLabel }));

  const stringOperatorMap = fullOperatorMap(stringOperators);
  const doubleOperatorMap = fullOperatorMap(doubleOperators);
  const integerOperatorMap = fullOperatorMap(integerOperators);
  const booleanOperatorMap = fullOperatorMap(booleanOperators);
  const dateOperatorMap = fullOperatorMap(dateOperators);

  type OperatorLabelsByUnaryOperator = { readonly [P in fltr.UnaryComparisonOperator]: OperatorLabels };

  const unaryOperatorLabelsByOperator: OperatorLabelsByUnaryOperator = {
    isEmpty: { label: "heeft geen waarde", shortLabel: "heeft geen waarde" },
    isNotEmpty: { label: "heeft een waarde", shortLabel: "heeft een waarde" }
  };

  const typedComparisonOperator: Function3<
    Map<fltr.ComparisonOperator, OperatorLabels>,
    fltr.BinaryComparisonOperator,
    fltr.TypeType,
    BinaryComparisonOperator
  > = (opMap, operator, typeType) =>
    BinaryComparisonOperator(
      opMap.get(operator)!.label, // We moeten er maar voor zorgen dat onze map volledig is
      opMap.get(operator)!.shortLabel, // We moeten er maar voor zorgen dat onze map volledig is
      operator,
      typeType
    );

  const unaryComparisonOperator: Function1<fltr.UnaryComparisonOperator, UnaryComparisonOperator> = operator =>
    UnaryComparisonOperator(unaryOperatorLabelsByOperator[operator].label, unaryOperatorLabelsByOperator[operator].shortLabel, operator);

  const binaryComparisonOperator: Function2<fltr.BinaryComparisonOperator, fltr.Literal, BinaryComparisonOperator> = (operator, literal) =>
    fltr.matchTypeTypeWithFallback({
      string: () => typedComparisonOperator(stringOperatorMap, operator, literal.type),
      date: () => typedComparisonOperator(dateOperatorMap, operator, literal.type),
      integer: () => typedComparisonOperator(integerOperatorMap, operator, literal.type),
      double: () => typedComparisonOperator(doubleOperatorMap, operator, literal.type),
      boolean: () => typedComparisonOperator(booleanOperatorMap, operator, literal.type),
      range: () => typedComparisonOperator(dateOperatorMap, operator, literal.type),
      fallback: () => BinaryComparisonOperator("is", "is", "equality", "string") // niet ondersteund!
    })(literal.type);

  const FreeInputValueSelector: Function1<FreeInputValueType, FreeInputValueSelector> = valueType => ({ kind: "free", valueType });

  export const freeStringInputValueSelector: FreeInputValueSelector = FreeInputValueSelector("string");

  const SelectionValueSelector: Function2<SelectionType, string[], SelectionValueSelector> = (selectionType, values) => ({
    kind: "selection",
    selectionType,
    values
  });

  const RangeValueSelector = (valueType: FreeInputValueType, labels: string[], values: string[]): RangeValueSelector => ({
    kind: "range",
    valueType,
    values: pipe(
      array.zip(values, labels),
      array.map(([value, label]) => ({ value, label }))
    )
  });

  const DateValueSelector: Function1<DateType, DateValueSelector> = dateType => ({
    kind: "date",
    dateType
  });

  const EmptyValueSelector: EmptyValueSelector = { kind: "empty" };

  // Een eenvoudige wrapper om 2 soorten gegevens in 1 functie te kunnen berekenen
  interface OperatorsAndValueSelector {
    readonly operators: ComparisonOperator[];
    readonly valueSelector: ValueSelector;
  }

  const OperatorsAndValueSelector: Function2<ComparisonOperator[], ValueSelector, OperatorsAndValueSelector> = (
    operators,
    valueSelector
  ) => ({ operators, valueSelector });

  const bestStringValueSelector: Function2<Property, BinaryComparisonOperator, ValueSelector> = (property, operator) =>
    arrays.isNonEmpty(property.distinctValues) && ["equality", "inequality"].includes(operator.operator)
      ? arrays.hasAtLeastLength(0)(property.distinctValues) // Volgens acceptatiecrits AGL-3454 8 ipv 0, maar meerwaarde onduidelijk
        ? SelectionValueSelector("autocomplete", property.distinctValues)
        : SelectionValueSelector("dropdown", property.distinctValues)
      : FreeInputValueSelector("string");

  const bestDateValueSelector: Function1<BinaryComparisonOperator, ValueSelector> = operator =>
    operator.operator === "within"
      ? RangeValueSelector("integer", ["dag(en)", "maand(en)", "jaar"], ["day", "month", "year"])
      : DateValueSelector("date");

  const genericOperatorSelectors: Function1<fltr.Property, OperatorsAndValueSelector> = property =>
    fltr.matchTypeTypeWithFallback({
      string: () => OperatorsAndValueSelector(stringOperators, FreeInputValueSelector("string")),
      date: () => OperatorsAndValueSelector(dateOperators, DateValueSelector("date")),
      double: () => OperatorsAndValueSelector(doubleOperators, FreeInputValueSelector("double")),
      integer: () => OperatorsAndValueSelector(integerOperators, FreeInputValueSelector("integer")),
      boolean: () => OperatorsAndValueSelector(booleanOperators, EmptyValueSelector),
      fallback: () => OperatorsAndValueSelector([], EmptyValueSelector) // Geen ops voor onbekende types: beter terminale error operator
    })(property.type);

  const specificOperatorSelectors: Function2<Property, BinaryComparisonOperator, OperatorsAndValueSelector> = (property, operator) =>
    fltr.matchTypeTypeWithFallback({
      string: () => OperatorsAndValueSelector(stringOperators, bestStringValueSelector(property, operator)),
      date: () => OperatorsAndValueSelector(dateOperators, bestDateValueSelector(operator)),
      double: () => OperatorsAndValueSelector(doubleOperators, FreeInputValueSelector("double")),
      integer: () => OperatorsAndValueSelector(integerOperators, FreeInputValueSelector("integer")),
      boolean: () => OperatorsAndValueSelector(booleanOperators, EmptyValueSelector),
      fallback: () => OperatorsAndValueSelector([], EmptyValueSelector) // Geen ops voor onbekende types: beter terminale error operator
    })(property.type);

  const completedOperatorSelectors: Function2<Property, ComparisonOperator, OperatorsAndValueSelector> = (property, operator) =>
    matchComparisonOperator({
      UnaryComparisonOperator: () => OperatorsAndValueSelector(unaryOperators, EmptyValueSelector),
      BinaryComparisonOperator: binOp => specificOperatorSelectors(property, binOp)
    })(operator);

  // Overgang van FieldSelection naar OperatorSelection -> De overgangen zouden beter Validations zijn om er rekening
  // mee te houden dat de overgang eventueel niet mogelijk is. Bijvoorbeeld wanneer een veld opgegeven wordt dat niet in
  // de lijst staat.
  export const selectedProperty: Curried2<Property, FieldSelection, TermEditor> = property => selection => ({
    ...selection,
    kind: "Operator",
    selectedProperty: property,
    operatorSelectors: genericOperatorSelectors(property).operators,
    valueSelector: genericOperatorSelectors(property).valueSelector
  });

  const toValueSelection: Function4<OperatorSelection, ComparisonOperator, ValueSelector, boolean, ValueSelection> = (
    selection,
    selectedOperator,
    valueSelector,
    caseSensitive
  ) => ({ ...selection, kind: "Value", selectedOperator, valueSelector, workingValue: none, caseSensitive: caseSensitive });

  const booleanCompleted: Function2<OperatorSelection, BinaryComparisonOperator, TermEditor> = (selection, selectedOperator) => ({
    ...selection,
    kind: "CompletedWithValue",
    selectedOperator,
    EmptyValueSelector,
    // contra-intuitief willen we ook bij 'inequality' als boolean waarde 'true'
    // vermits we dan 'true' vergelijken via '!=' voor operator 'is niet waar'
    selectedValue: LiteralValue("boolean")(arrays.isOneOf("isEmpty", "equality", "inequality")(selectedOperator.operator)),
    workingValue: none,
    caseSensitive: false
  });

  // nooit aanroepen met lege array
  const ConjunctionEditor: Function1<TermEditor[], ConjunctionEditor> = termEditors => ({ termEditors });

  const DisjunctionEditor: Function1<ConjunctionEditor[], DisjunctionsEditor> = conjunctionEditors => ({ conjunctionEditors });

  // Overgang van OperatorSelection naar ValueSelection (of Completed voor unaire operators)
  export const selectOperator: Curried3<
    ComparisonOperator,
    boolean,
    OperatorSelection,
    TermEditor
  > = selectedOperator => caseSensitive => selection =>
    matchComparisonOperator<TermEditor>({
      UnaryComparisonOperator: unOp => ({
        ...selection,
        kind: "Completed",
        selectedOperator: unOp,
        workingValue: none,
        valueSelector: EmptyValueSelector
      }),
      BinaryComparisonOperator: binOp =>
        fltr.matchTypeTypeWithFallback<TermEditor>({
          string: () => toValueSelection(selection, binOp, bestStringValueSelector(selection.selectedProperty, binOp), caseSensitive),
          date: () => toValueSelection(selection, binOp, bestDateValueSelector(binOp), caseSensitive),
          double: () => toValueSelection(selection, binOp, FreeInputValueSelector("double"), caseSensitive),
          integer: () => toValueSelection(selection, binOp, FreeInputValueSelector("integer"), caseSensitive),
          boolean: () => booleanCompleted(selection, binOp),
          fallback: () =>
            // Hier raken we niet wegens geen operator
            toValueSelection(selection, selectedOperator, selection.valueSelector, caseSensitive)
        })(selection.selectedProperty.type)
    })(selectedOperator);

  // Overgang van ValueSelection naar CompletedWithValue als alles OK is. Kan ook van CompletedWithValue naar
  // ValueSelection gaan wanneer nieuwe input gegeven wordt.
  export const selectValue: Curried2<Option<SelectedValue>, ValueSelection, TermEditor> = maybeSelectedValue => selection => {
    // Voorlopig ondersteunen we dus enkel LiteralValues

    type SelectedValueChecker = PartialFunction1<SelectedValue, SelectedValue>;

    // in theorie zouden we meer constraints kunnen hebben
    const validateText: SelectedValueChecker = option.fromPredicate(selectedValue =>
      ["string"].includes(selectedValue.valueType) ? selectedValue.value.toString().length > 0 : true
    );

    // Wanneer de datum correct is, komt die binnen als een Literal met een type "date". Maar als dat niet zo is met
    // een type "string". Behalve wanneer de gebruiker zelf aan het typen geslagen is. Dan komt de waarde binnen als een
    // "string", of die nu geldig is of niet. Een geldige datum willen we in dat geval omzetten naar een Date.
    const validateDateValue: SelectedValueChecker = selectedValue =>
      pipe(
        selectedValue,
        option.fromPredicate(
          selectedValue => selection.selectedProperty.type !== "date" || ["date", "range"].includes(selectedValue.valueType)
        ),
        option.alt(() => parseDate(option.some("d/M/yyyy"))(selectedValue.value.toString()).map(date => LiteralValue("date")(date)))
      );

    const validateDistinct: SelectedValueChecker = option.fromPredicate(
      selectedValue =>
        selection.valueSelector.kind !== "selection" ||
        (typeof selectedValue.value === "string" && selection.valueSelector.values.includes(selectedValue.value))
    );

    // In de "normale" gevallen moet het type van de literal en de property overeenkomen
    const validateEqualType: SelectedValueChecker = option.fromPredicate(
      selectedValue => selection.selectedProperty.type === "date" || selectedValue.valueType === selection.selectedProperty.type
    );

    // Bij een date property kunnen de waarden ofwel een date ofwel een range zijn
    const validateDateType: SelectedValueChecker = option.fromPredicate(
      selectedValue =>
        selection.selectedProperty.type !== "date" ||
        pipe(
          selectedValue.valueType,
          arrays.isOneOf("date", "range")
        )
    );

    // Als er gesteld wordt dat het een range is, dan moet het ook echt een range zijn
    const validateDateRange: SelectedValueChecker = option.fromPredicate(
      selectedValue =>
        selection.selectedProperty.type !== "date" ||
        selectedValue.valueType !== "range" ||
        fltr.Range.isRelativeDateRange(selectedValue.value)
    );

    const validatedOperator: Option<BinaryComparisonOperator> = matchComparisonOperator<Option<BinaryComparisonOperator>>({
      UnaryComparisonOperator: () => none,
      BinaryComparisonOperator: binOp => some(binOp)
    })(selection.selectedOperator);

    // selectedValue verwijderen maakt geen verschil
    const failTransition: Lazy<ValueSelection> = () => ({ ...selection, kind: "Value", workingValue: maybeSelectedValue });

    // Alle onderstaande validaties moeten lukken om de transitie naar CompletedWithValue te kunnen maken. Validatie is
    // eigenlijk wat misleidend omdat een geslaagde "validatie" ook de conversie naar kan inhouden.
    return pipe(
      maybeSelectedValue,
      option.chain(validateEqualType),
      option.chain(validateText),
      option.chain(validateDateValue),
      option.chain(validateDateRange),
      option.chain(validateDateType),
      option.chain(validateDistinct),
      option.fold(failTransition, selectedValue =>
        validatedOperator.foldL<TermEditor>(failTransition, binOp => ({
          ...selection,
          kind: "CompletedWithValue",
          selectedValue,
          selectedOperator: binOp
        }))
      )
    );
  };

  export const selectHoofdletterGevoelig: Curried2<boolean, ValueSelection | Completed, TermEditor> = hoofdLetterGevoelig => selection => ({
    ...selection,
    caseSensitive: hoofdLetterGevoelig
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

  // Verwijder het huidige element, tenzij laatste chip, maak die dan leeg
  export const remove: Endomorphism<ExpressionEditor> = expressionEditor => {
    // We kunnen de laatste builder niet verwijderen. Wanneer we het huidige element in de conjunction verwijderen, dan
    // maken we de laatste term in de conjunction het nieuwe huidige element. Indien er geen is, dan gaan we naar de de
    // laatste term van de laatste disjunction.
    return canRemoveCurrent(expressionEditor)
      ? reallyRemove(expressionEditor)
      : update(FieldSelection(expressionEditor.laag))(expressionEditor);
  };

  // voeg onderaan een OF toe en maak de nieuwe TermEditor de actieve
  export const addDisjunction: Endomorphism<ExpressionEditor> = expressionEditor => {
    const newEditor = FieldSelection(expressionEditor.laag);
    return applySequential([
      disjunctionsLens.compose(conjunctionEditorsLens).modify(de => array.snoc(de, initConjunctionEditor(newEditor))),
      setCurrent(newEditor)
    ])(expressionEditor);
  };

  // voeg een EN toe op geselecteerde rij van de huidige TermEditor en maak die de nieuwe actieve
  export const addConjunction: Function1<ConjunctionEditor, Endomorphism<ExpressionEditor>> = conjunctionEditor => expressionEditor => {
    const newEditor = FieldSelection(expressionEditor.laag);
    return applySequential([
      getConjunctionEditorTraversal(conjunctionEditor)
        .composeLens(termEditorsLens)
        .modify(ce => array.snoc(ce, newEditor)),
      setCurrent(newEditor)
    ])(expressionEditor);
  };

  const ExpressionEditor: Function4<Option<string>, ke.ToegevoegdeVectorLaag, TermEditor, DisjunctionsEditor, ExpressionEditor> = (
    name,
    laag,
    current,
    disjunctions
  ) => ({ name, laag, current, disjunctions });

  const toLiteralValue: Function1<fltr.Literal, LiteralValue> = literal => LiteralValue(literal.type)(literal.value);

  const completedTermEditor: Function2<ke.ToegevoegdeVectorLaag, fltr.Comparison, TermEditor> = (laag, comparison) => {
    const distinctValues = array
      .findFirst(veldinfos(laag), vi => vi.naam === comparison.property.ref)
      .chain(vi => fromNullable(vi.uniekeWaarden).map(array.sort(ordString)))
      .getOrElse([]);
    const selectedProperty: Property = { ...comparison.property, distinctValues };

    return fltr.matchComparison<TermEditor>({
      UnaryComparison: unOp => {
        const selectedOperator = unaryComparisonOperator(unOp.operator);
        return {
          kind: "Completed",
          properties: properties(laag),
          selectedProperty,
          selectedOperator,
          operatorSelectors: genericOperatorSelectors(selectedProperty).operators,
          valueSelector: EmptyValueSelector
        };
      },
      BinaryComparison: binOp => {
        const selectedOperator = binaryComparisonOperator(binOp.operator, binOp.value);
        return {
          kind: "CompletedWithValue",
          properties: properties(laag),
          selectedProperty,
          operatorSelectors: genericOperatorSelectors(selectedProperty).operators,
          selectedOperator,
          selectedValue: toLiteralValue(binOp.value),
          valueSelector: completedOperatorSelectors(selectedProperty, selectedOperator).valueSelector,
          caseSensitive: binOp.caseSensitive
        };
      }
    })(comparison);
  };

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
      case "UnaryComparison":
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
      case "UnaryComparison":
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
      BinaryComparison: expr => fromComparison(name, laag, expr),
      UnaryComparison: expr => fromComparison(name, laag, expr)
    })(expression);

  export const fromToegevoegdeVectorLaag: Function1<ke.ToegevoegdeVectorLaag, ExpressionEditor> = laag =>
    fltr.matchFilter({
      EmptyFilter: () => init(laag),
      ExpressionFilter: expr => fromExpression(expr.name, laag, expr.expression)
    })(laag.filterinstellingen.spec);

  const toLiteral: Function2<BinaryComparisonOperator, LiteralValue, fltr.Literal> = (operator, lv) =>
    fltr.Literal(operator.typeType, lv.value);

  interface ComparisonOperatorMatcher<A> {
    readonly UnaryComparisonOperator: Function1<UnaryComparisonOperator, A>;
    readonly BinaryComparisonOperator: Function1<BinaryComparisonOperator, A>;
  }

  const matchComparisonOperator: <A>(_: ComparisonOperatorMatcher<A>) => Function1<ComparisonOperator, A> = matchers.matchKind;

  const toComparison: Function1<TermEditor, Option<fltr.Comparison>> = termEditor => {
    switch (termEditor.kind) {
      case "Completed":
        return some(fltr.UnaryComparison(termEditor.selectedOperator.operator, termEditor.selectedProperty));
      case "CompletedWithValue":
        return some(
          fltr.BinaryComparison(
            termEditor.selectedOperator.operator,
            termEditor.selectedProperty,
            toLiteral(termEditor.selectedOperator, termEditor.selectedValue),
            termEditor.caseSensitive
          )
        );
      default:
        return none; // De uiteindelijke conversie naar Expression zal falen als er ook maar 1 TermEditor niet Completed is
    }
  };

  const toConjunctionExpression: Function1<TermEditor[], Option<fltr.ConjunctionExpression>> = termEditors =>
    ArrayMonad.traverse(option.option)(termEditors, toComparison).chain(comps =>
      array.fold(
        comps,
        array.head(comps), // ingeval er maar 1 element is, bnehouden we dat gewoon
        (first, next) => some(next.reduce<fltr.ConjunctionExpression>((sum, val) => fltr.Conjunction(sum, val), first))
      )
    );

  const toDisjunctionExpression: Function1<ConjunctionEditor[], Option<fltr.Expression>> = conjunctionEditors =>
    ArrayMonad.traverse(option.option)(conjunctionEditors.map(ce => ce.termEditors), toConjunctionExpression).chain(conjs =>
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
    readonly CompletedWithValue: Function1<CompletedWithValue, A>;
  }

  export const matchTermEditor: <A>(_: TermEditorMatcher<A>) => Function1<TermEditor, A> = matchers.matchKind;

  const setoidFieldSelection: Setoid<FilterEditor.FieldSelection> = getRecordSetoid({
    kind: setoidString,
    properties: array.getSetoid(contramap<string, Property>(p => p.ref, setoidString))
  });

  const setoidBinaryComparisonOperator: Setoid<BinaryComparisonOperator> = contramap(o => o.operator, fltr.setoidBinaryComparisonOperator);

  const setoidUnaryComparisonOperator: Setoid<UnaryComparisonOperator> = contramap(o => o.operator, fltr.setoidUnaryComparisonOperator);

  export const setoidComparisonOperator: Setoid<ComparisonOperator> = byKindSetoid<ComparisonOperator, string>({
    BinaryComparisonOperator: setoidBinaryComparisonOperator,
    UnaryComparisonOperator: setoidUnaryComparisonOperator
  });

  const setoidOperatorSelection: Setoid<OperatorSelection> = getRecordSetoid({
    kind: setoidString,
    properties: array.getSetoid(fltr.setoidPropertyByRef),
    selectedProperty: fltr.setoidPropertyByRef,
    operatorSelectors: array.getSetoid(setoidComparisonOperator)
  });

  const freeInputValueTypeSetoid: Setoid<FreeInputValueType> = setoidString;

  const freeInputValueSelectorSetoid: Setoid<FreeInputValueSelector> = contramap(vs => vs.valueType, freeInputValueTypeSetoid);

  const rangeValueSelectorSetoid: Setoid<RangeValueSelector> = contramap(vs => vs.valueType, freeInputValueTypeSetoid);

  const selectionValueSelectorSetoid: Setoid<SelectionValueSelector> = contramap(
    vs => [vs.selectionType, vs.values] as [SelectionType, string[]],
    getTupleSetoid(setoidString, getArraySetoid(setoidString))
  );

  const dateTypeSetoid: Setoid<DateType> = setoidString;
  const dateValueSelectorSetoid: Setoid<DateValueSelector> = contramap(vs => vs.dateType, dateTypeSetoid);

  const setoidValueSelector: Setoid<ValueSelector> = byKindSetoid({
    empty: singletonSetoid,
    free: freeInputValueSelectorSetoid,
    selection: selectionValueSelectorSetoid,
    range: rangeValueSelectorSetoid,
    date: dateValueSelectorSetoid
  });

  const setoidValueSelection: Setoid<ValueSelection> = getRecordSetoid({
    kind: setoidString,
    properties: array.getSetoid(fltr.setoidPropertyByRef),
    selectedProperty: fltr.setoidPropertyByRef,
    operatorSelectors: array.getSetoid(setoidComparisonOperator),
    selectedOperator: setoidComparisonOperator,
    valueSelector: setoidValueSelector
  });

  const setoidLiteralValue: Setoid<LiteralValue> = fromEquals(strictEqual); // de waarden zijn v/h type string, number of boolean

  const setoidSelectedValue: Setoid<SelectedValue> = setoidLiteralValue;

  const setoidCompleted: Setoid<Completed> = getRecordSetoid({
    kind: setoidString,
    properties: array.getSetoid(fltr.setoidPropertyByRef),
    selectedProperty: fltr.setoidPropertyByRef,
    operatorSelectors: array.getSetoid(setoidComparisonOperator),
    selectedOperator: setoidComparisonOperator
  });

  const setoidCompletedWithValue: Setoid<CompletedWithValue> = getRecordSetoid({
    kind: setoidString,
    properties: array.getSetoid(fltr.setoidPropertyByRef),
    selectedProperty: fltr.setoidPropertyByRef,
    operatorSelectors: array.getSetoid(setoidComparisonOperator),
    selectedOperator: setoidComparisonOperator,
    valueSelector: setoidValueSelector,
    selectedValue: setoidSelectedValue
  });

  export const setoidTermEditor: Setoid<TermEditor> = fromEquals(
    (te1, te2) =>
      te1.kind === te2.kind &&
      matchTermEditor({
        Field: () => setoidFieldSelection.equals(te1 as FieldSelection, te2 as FieldSelection),
        Operator: () => setoidOperatorSelection.equals(te1 as OperatorSelection, te2 as OperatorSelection),
        Value: () => setoidValueSelection.equals(te1 as ValueSelection, te2 as ValueSelection),
        Completed: () => setoidCompleted.equals(te1 as Completed, te2 as Completed),
        CompletedWithValue: () => setoidCompletedWithValue.equals(te1 as CompletedWithValue, te2 as CompletedWithValue)
      })(te1)
  );

  export const matchLiteralValueWithFallback: <A>(
    _: matchers.FallbackMatcher<LiteralValue, A, fltr.TypeType>
  ) => Function1<LiteralValue, A> = matcher => matchers.matchWithFallback(matcher)(lv => lv.valueType);

  export interface ValueSelectorMatcher<A> {
    readonly empty: Function1<EmptyValueSelector, A>;
    readonly free: Function1<FreeInputValueSelector, A>;
    readonly selection: Function1<SelectionValueSelector, A>;
    readonly date: Function1<DateValueSelector, A>;
    readonly range: Function1<RangeValueSelector, A>;
  }

  export const matchValueSelector: <A>(matcher: ValueSelectorMatcher<A>) => Function1<ValueSelector, A> = matchers.matchKind;
}
