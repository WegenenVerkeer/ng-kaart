import { array, eq, option, ord } from "fp-ts";
import {
  Endomorphism,
  flow,
  Lazy,
  not,
  Predicate,
  Refinement,
} from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import { fromTraversable, Lens, Prism, Traversal } from "monocle-ts";

import * as ke from "../kaart/kaart-elementen";
import * as arrays from "../util/arrays";
import { parseDate } from "../util/date-time";
import { applySequential, PartialFunction1 } from "../util/function";
import * as maps from "../util/maps";
import * as matchers from "../util/matchers";
import { byKindEq, singletonEq } from "../util/setoid";

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

    readonly name: option.Option<string>;
    readonly laag: ke.ToegevoegdeVectorLaag;
  }

  export type TermEditor =
    | FieldSelection
    | OperatorSelection
    | ValueSelection
    | Completed
    | CompletedWithValue;

  export interface Property extends fltr.Property {
    readonly distinctValues: string[];
  }

  export type ValueSelector =
    | FreeInputValueSelector
    | SelectionValueSelector
    | RangeValueSelector
    | DateValueSelector
    | EmptyValueSelector;

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

  export type ComparisonOperator =
    | BinaryComparisonOperator
    | UnaryComparisonOperator;

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
    readonly workingValue: option.Option<SelectedValue>; // Om voorlopig ongeldige ingevoerde waarde bij te houden
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

  const Property: (
    typetype: fltr.TypeType,
    name: string,
    label: string,
    sqlFormat: option.Option<string>,
    distinctValues: string[]
  ) => Property = (typetype, name, label, sqlFormat, distinctValues) => ({
    kind: "Property",
    type: typetype,
    ref: name,
    label,
    sqlFormat,
    distinctValues,
  });

  export const LiteralValue: (
    valueType: fltr.TypeType
  ) => (value: fltr.ValueType) => LiteralValue = (valueType) => (value) => ({
    kind: "Literal",
    value,
    valueType,
  });

  export const isAtLeastOperatorSelection: Refinement<
    TermEditor,
    OperatorSelection
  > = (termEditor): termEditor is OperatorSelection =>
    termEditor.kind === "Operator" ||
    termEditor.kind === "Value" ||
    termEditor.kind === "Completed" ||
    termEditor.kind === "CompletedWithValue";
  export const isAtLeastValueSelection: Refinement<
    TermEditor,
    ValueSelection
  > = (termEditor): termEditor is ValueSelection =>
    termEditor.kind === "Value" ||
    termEditor.kind === "Completed" ||
    termEditor.kind === "CompletedWithValue";
  export const isCompleted: Refinement<TermEditor, Completed> = (
    termEditor
  ): termEditor is Completed => termEditor.kind === "Completed";

  // We zijn heel conservatief en laten enkel kolommen met ASCII letters, underscore en punt toe
  const hasAcceptableName: Predicate<ke.VeldInfo> = (veld) =>
    veld.naam.match(/^[\w\.]+$/) !== null;

  const veldinfos: (arg: ke.ToegevoegdeVectorLaag) => ke.VeldInfo[] = (laag) =>
    ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag).filter(
      // filter de speciale velden er uit
      (veld) =>
        pipe(option.fromNullable(veld.label), option.isSome) &&
        pipe(option.fromNullable(veld.constante), option.isNone) &&
        pipe(option.fromNullable(veld.template), option.isNone) &&
        pipe(option.fromNullable(veld.html), option.isNone) &&
        hasAcceptableName(veld)
    );

  type SimplePropertyType = Exclude<fltr.TypeType, "range">;
  const isAcceptedVeldType: Refinement<ke.VeldType, SimplePropertyType> = (
    t
  ): t is SimplePropertyType =>
    array.elem(eq.eqString)(t, [
      "string",
      "boolean",
      "double",
      "integer",
      "date",
    ]);

  const asAcceptedVeldType: PartialFunction1<ke.VeldType, fltr.TypeType> = flow(
    option.fromNullable,
    option.filter(isAcceptedVeldType)
  );

  const properties: (laag: ke.ToegevoegdeVectorLaag) => Property[] = flow(
    veldinfos,
    array.filterMap((vi) =>
      pipe(
        vi.type,
        asAcceptedVeldType,
        option.map((typetype) =>
          Property(
            typetype,
            vi.naam,
            pipe(
              option.fromNullable(vi.label),
              option.getOrElse(() => vi.naam)
            ),
            option.fromNullable(vi.sqlFormat),
            array.sort(ord.ordString)(arrays.fromNullable(vi.uniekeWaarden))
          )
        )
      )
    )
  );

  // Initieer aanmaak van een Comparison
  const FieldSelection: (arg: ke.ToegevoegdeVectorLaag) => TermEditor = (
    laag
  ) => ({ kind: "Field", properties: properties(laag) });

  const BinaryComparisonOperator: (
    label: string,
    shortLabel: string,
    operator: fltr.BinaryComparisonOperator,
    typeType: fltr.TypeType
  ) => BinaryComparisonOperator = (label, shortLabel, operator, typeType) => ({
    kind: "BinaryComparisonOperator",
    label,
    shortLabel,
    operator,
    typeType,
  });

  const UnaryComparisonOperator: (
    label: string,
    shortLabel: string,
    operator: fltr.UnaryComparisonOperator
  ) => UnaryComparisonOperator = (label, shortLabel, operator) => ({
    kind: "UnaryComparisonOperator",
    label,
    shortLabel,
    operator,
  });

  const unaryOperators: UnaryComparisonOperator[] = [
    UnaryComparisonOperator(
      "heeft geen waarde",
      "heeft geen waarde",
      "isEmpty"
    ),
    UnaryComparisonOperator(
      "heeft een waarde",
      "heeft een waarde",
      "isNotEmpty"
    ),
  ];

  const stringOperators = [
    BinaryComparisonOperator("is", "is", "equality", "string"),
    BinaryComparisonOperator("is niet", "is niet", "inequality", "string"),
    BinaryComparisonOperator("bevat", "bevat", "contains", "string"),
    BinaryComparisonOperator("start met", "start met", "starts", "string"),
    BinaryComparisonOperator("eindigt met", "eindigt met", "ends", "string"),
    ...unaryOperators,
  ];

  const numberOperatorsGen: (arg: fltr.TypeType) => ComparisonOperator[] = (
    typeType
  ) => [
    BinaryComparisonOperator("is", "is", "equality", typeType),
    BinaryComparisonOperator("is niet", "is niet", "inequality", typeType),
    BinaryComparisonOperator("kleiner dan", "<", "smaller", typeType),
    BinaryComparisonOperator(
      "kleiner dan of gelijk aan",
      "<=",
      "smallerOrEqual",
      typeType
    ),
    BinaryComparisonOperator("groter dan", ">", "larger", typeType),
    BinaryComparisonOperator(
      "groter dan of gelijk aan",
      ">=",
      "largerOrEqual",
      typeType
    ),
    ...unaryOperators,
  ];

  const doubleOperators = numberOperatorsGen("double");
  const integerOperators = numberOperatorsGen("integer");

  const booleanOperators: ComparisonOperator[] = [
    BinaryComparisonOperator("is waar", "is waar", "equality", "boolean"),
    BinaryComparisonOperator(
      "is niet waar",
      "is niet waar",
      "inequality",
      "boolean"
    ),
    ...unaryOperators,
  ];

  const dateOperators = [
    BinaryComparisonOperator("op", "op", "equality", "date"),
    BinaryComparisonOperator("niet op", "niet op", "inequality", "date"),
    BinaryComparisonOperator("tot", "tot", "smaller", "date"),
    BinaryComparisonOperator(
      "tot en met",
      "tot en met",
      "smallerOrEqual",
      "date"
    ),
    BinaryComparisonOperator("na", "na", "larger", "date"),
    BinaryComparisonOperator("vanaf", "vanaf", "largerOrEqual", "date"),
    BinaryComparisonOperator("laatste", "binnen laatste", "within", "range"),
    ...unaryOperators,
  ];

  interface OperatorLabels {
    readonly label: string;
    readonly shortLabel: string;
  }

  const fullOperatorMap: (
    arg: ComparisonOperator[]
  ) => Map<fltr.ComparisonOperator, OperatorLabels> = (operators) =>
    maps.toMapByKeyAndValue(
      operators,
      (op) => op.operator,
      (op) => ({ label: op.label, shortLabel: op.shortLabel })
    );

  const stringOperatorMap = fullOperatorMap(stringOperators);
  const doubleOperatorMap = fullOperatorMap(doubleOperators);
  const integerOperatorMap = fullOperatorMap(integerOperators);
  const booleanOperatorMap = fullOperatorMap(booleanOperators);
  const dateOperatorMap = fullOperatorMap(dateOperators);

  type OperatorLabelsByUnaryOperator = {
    readonly [P in fltr.UnaryComparisonOperator]: OperatorLabels;
  };

  const unaryOperatorLabelsByOperator: OperatorLabelsByUnaryOperator = {
    isEmpty: { label: "heeft geen waarde", shortLabel: "heeft geen waarde" },
    isNotEmpty: { label: "heeft een waarde", shortLabel: "heeft een waarde" },
  };

  const typedComparisonOperator: (
    opMap: Map<fltr.ComparisonOperator, OperatorLabels>,
    operator: fltr.BinaryComparisonOperator,
    typeType: fltr.TypeType
  ) => BinaryComparisonOperator = (opMap, operator, typeType) =>
    BinaryComparisonOperator(
      opMap.get(operator)!.label, // We moeten er maar voor zorgen dat onze map volledig is
      opMap.get(operator)!.shortLabel, // We moeten er maar voor zorgen dat onze map volledig is
      operator,
      typeType
    );

  const unaryComparisonOperator: (
    arg: fltr.UnaryComparisonOperator
  ) => UnaryComparisonOperator = (operator) =>
    UnaryComparisonOperator(
      unaryOperatorLabelsByOperator[operator].label,
      unaryOperatorLabelsByOperator[operator].shortLabel,
      operator
    );

  const binaryComparisonOperator: (
    operator: fltr.BinaryComparisonOperator,
    literal: fltr.Literal
  ) => BinaryComparisonOperator = (operator, literal) =>
    fltr.matchTypeTypeWithFallback({
      string: () =>
        typedComparisonOperator(stringOperatorMap, operator, literal.type),
      date: () =>
        typedComparisonOperator(dateOperatorMap, operator, literal.type),
      integer: () =>
        typedComparisonOperator(integerOperatorMap, operator, literal.type),
      double: () =>
        typedComparisonOperator(doubleOperatorMap, operator, literal.type),
      boolean: () =>
        typedComparisonOperator(booleanOperatorMap, operator, literal.type),
      range: () =>
        typedComparisonOperator(dateOperatorMap, operator, literal.type),
      fallback: () =>
        BinaryComparisonOperator("is", "is", "equality", "string"), // niet ondersteund!
    })(literal.type);

  const FreeInputValueSelector: (
    arg: FreeInputValueType
  ) => FreeInputValueSelector = (valueType) => ({ kind: "free", valueType });

  export const freeStringInputValueSelector: FreeInputValueSelector = FreeInputValueSelector(
    "string"
  );

  const SelectionValueSelector: (
    arg1: SelectionType,
    arg2: string[]
  ) => SelectionValueSelector = (selectionType, values) => ({
    kind: "selection",
    selectionType,
    values,
  });

  const RangeValueSelector = (
    valueType: FreeInputValueType,
    labels: string[],
    values: string[]
  ): RangeValueSelector => ({
    kind: "range",
    valueType,
    values: pipe(
      array.zip(values, labels),
      array.map(([value, label]) => ({ value, label }))
    ),
  });

  const DateValueSelector: (arg: DateType) => DateValueSelector = (
    dateType
  ) => ({
    kind: "date",
    dateType,
  });

  const EmptyValueSelector: EmptyValueSelector = { kind: "empty" };

  // Een eenvoudige wrapper om 2 soorten gegevens in 1 functie te kunnen berekenen
  interface OperatorsAndValueSelector {
    readonly operators: ComparisonOperator[];
    readonly valueSelector: ValueSelector;
  }

  const OperatorsAndValueSelector: (
    arg1: ComparisonOperator[],
    arg2: ValueSelector
  ) => OperatorsAndValueSelector = (operators, valueSelector) => ({
    operators,
    valueSelector,
  });

  const bestStringValueSelector: (
    arg1: Property,
    arg2: BinaryComparisonOperator
  ) => ValueSelector = (property, operator) =>
    arrays.isNonEmpty(property.distinctValues) &&
    ["equality", "inequality"].includes(operator.operator)
      ? arrays.hasAtLeastLength(0)(property.distinctValues) // Volgens acceptatiecrits AGL-3454 8 ipv 0, maar meerwaarde onduidelijk
        ? SelectionValueSelector("autocomplete", property.distinctValues)
        : SelectionValueSelector("dropdown", property.distinctValues)
      : FreeInputValueSelector("string");

  const bestDateValueSelector: (
    arg: BinaryComparisonOperator
  ) => ValueSelector = (operator) =>
    operator.operator === "within"
      ? RangeValueSelector(
          "integer",
          ["dag(en)", "maand(en)", "jaar"],
          ["day", "month", "year"]
        )
      : DateValueSelector("date");

  const genericOperatorSelectors: (
    arg: fltr.Property
  ) => OperatorsAndValueSelector = (property) =>
    fltr.matchTypeTypeWithFallback({
      string: () =>
        OperatorsAndValueSelector(
          stringOperators,
          FreeInputValueSelector("string")
        ),
      date: () =>
        OperatorsAndValueSelector(dateOperators, DateValueSelector("date")),
      double: () =>
        OperatorsAndValueSelector(
          doubleOperators,
          FreeInputValueSelector("double")
        ),
      integer: () =>
        OperatorsAndValueSelector(
          integerOperators,
          FreeInputValueSelector("integer")
        ),
      boolean: () =>
        OperatorsAndValueSelector(booleanOperators, EmptyValueSelector),
      fallback: () => OperatorsAndValueSelector([], EmptyValueSelector), // Geen ops voor onbekende types: beter terminale error operator
    })(property.type);

  const specificOperatorSelectors: (
    arg1: Property,
    arg2: BinaryComparisonOperator
  ) => OperatorsAndValueSelector = (property, operator) =>
    fltr.matchTypeTypeWithFallback({
      string: () =>
        OperatorsAndValueSelector(
          stringOperators,
          bestStringValueSelector(property, operator)
        ),
      date: () =>
        OperatorsAndValueSelector(
          dateOperators,
          bestDateValueSelector(operator)
        ),
      double: () =>
        OperatorsAndValueSelector(
          doubleOperators,
          FreeInputValueSelector("double")
        ),
      integer: () =>
        OperatorsAndValueSelector(
          integerOperators,
          FreeInputValueSelector("integer")
        ),
      boolean: () =>
        OperatorsAndValueSelector(booleanOperators, EmptyValueSelector),
      fallback: () => OperatorsAndValueSelector([], EmptyValueSelector), // Geen ops voor onbekende types: beter terminale error operator
    })(property.type);

  const completedOperatorSelectors: (
    arg1: Property,
    arg2: ComparisonOperator
  ) => OperatorsAndValueSelector = (property, operator) =>
    matchComparisonOperator({
      UnaryComparisonOperator: () =>
        OperatorsAndValueSelector(unaryOperators, EmptyValueSelector),
      BinaryComparisonOperator: (binOp) =>
        specificOperatorSelectors(property, binOp),
    })(operator);

  // Overgang van FieldSelection naar OperatorSelection -> De overgangen zouden beter Validations zijn om er rekening
  // mee te houden dat de overgang eventueel niet mogelijk is. Bijvoorbeeld wanneer een veld opgegeven wordt dat niet in
  // de lijst staat.
  export const selectedProperty: (
    Property
  ) => (FieldSelection) => TermEditor = (property) => (selection) => ({
    ...selection,
    kind: "Operator",
    selectedProperty: property,
    operatorSelectors: genericOperatorSelectors(property).operators,
    valueSelector: genericOperatorSelectors(property).valueSelector,
  });

  const toValueSelection: (
    selection: OperatorSelection,
    selectedOperator: ComparisonOperator,
    valueSelector: ValueSelector,
    caseSensitive: boolean
  ) => ValueSelection = (
    selection,
    selectedOperator,
    valueSelector,
    caseSensitive
  ) => ({
    ...selection,
    kind: "Value",
    selectedOperator,
    valueSelector,
    workingValue: option.none,
    caseSensitive: caseSensitive,
  });

  const booleanCompleted: (
    arg1: OperatorSelection,
    arg2: BinaryComparisonOperator
  ) => TermEditor = (selection, selectedOperator) => ({
    ...selection,
    kind: "CompletedWithValue",
    selectedOperator,
    EmptyValueSelector,
    // contra-intuitief willen we ook bij 'inequality' als boolean waarde 'true'
    // vermits we dan 'true' vergelijken via '!=' voor operator 'is niet waar'
    selectedValue: LiteralValue("boolean")(
      arrays.isOneOf(
        "isEmpty",
        "equality",
        "inequality"
      )(selectedOperator.operator)
    ),
    workingValue: option.none,
    caseSensitive: false,
  });

  // nooit aanroepen met lege array
  const ConjunctionEditor: (arg: TermEditor[]) => ConjunctionEditor = (
    termEditors
  ) => ({ termEditors });

  const DisjunctionEditor: (arg: ConjunctionEditor[]) => DisjunctionsEditor = (
    conjunctionEditors
  ) => ({ conjunctionEditors });

  // Overgang van OperatorSelection naar ValueSelection (of Completed voor unaire operators)
  export const selectOperator: (
    ComparisonOperator
  ) => (boolean) => (OperatorSelection) => TermEditor = (selectedOperator) => (
    caseSensitive
  ) => (selection) =>
    matchComparisonOperator<TermEditor>({
      UnaryComparisonOperator: (unOp) => ({
        ...selection,
        kind: "Completed",
        selectedOperator: unOp,
        workingValue: option.none,
        valueSelector: EmptyValueSelector,
      }),
      BinaryComparisonOperator: (binOp) =>
        fltr.matchTypeTypeWithFallback<TermEditor>({
          string: () =>
            toValueSelection(
              selection,
              binOp,
              bestStringValueSelector(selection.selectedProperty, binOp),
              caseSensitive
            ),
          date: () =>
            toValueSelection(
              selection,
              binOp,
              bestDateValueSelector(binOp),
              caseSensitive
            ),
          double: () =>
            toValueSelection(
              selection,
              binOp,
              FreeInputValueSelector("double"),
              caseSensitive
            ),
          integer: () =>
            toValueSelection(
              selection,
              binOp,
              FreeInputValueSelector("integer"),
              caseSensitive
            ),
          boolean: () => booleanCompleted(selection, binOp),
          fallback: () =>
            // Hier raken we niet wegens geen operator
            toValueSelection(
              selection,
              selectedOperator,
              selection.valueSelector,
              caseSensitive
            ),
        })(selection.selectedProperty.type),
    })(selectedOperator);

  // Overgang van ValueSelection naar CompletedWithValue als alles OK is. Kan ook van CompletedWithValue naar
  // ValueSelection gaan wanneer nieuwe input gegeven wordt.
  export const selectValue: (
    maybeSelectedValue: option.Option<SelectedValue>
  ) => (ValueSelection) => TermEditor = (maybeSelectedValue) => (selection) => {
    // Voorlopig ondersteunen we dus enkel LiteralValues

    type SelectedValueChecker = PartialFunction1<SelectedValue, SelectedValue>;

    // in theorie zouden we meer constraints kunnen hebben
    const validateText: SelectedValueChecker = option.fromPredicate(
      (selectedValue) =>
        ["string"].includes(selectedValue.valueType)
          ? selectedValue.value.toString().length > 0
          : true
    );

    // Wanneer de datum correct is, komt die binnen als een Literal met een type "date". Maar als dat niet zo is met
    // een type "string". Behalve wanneer de gebruiker zelf aan het typen geslagen is. Dan komt de waarde binnen als een
    // "string", of die nu geldig is of niet. Een geldige datum willen we in dat geval omzetten naar een Date.
    const validateDateValue: SelectedValueChecker = (selectedValue) =>
      pipe(
        selectedValue,
        option.fromPredicate(
          (selectedValue) =>
            selection.selectedProperty.type !== "date" ||
            ["date", "range"].includes(selectedValue.valueType)
        ),
        option.alt(() =>
          pipe(
            parseDate(option.some("d/M/yyyy"))(selectedValue.value.toString()),
            option.map((date) => LiteralValue("date")(date))
          )
        )
      );

    const validateDistinct: SelectedValueChecker = option.fromPredicate(
      (selectedValue) =>
        selection.valueSelector.kind !== "selection" ||
        (typeof selectedValue.value === "string" &&
          selection.valueSelector.values.includes(selectedValue.value))
    );

    // In de "normale" gevallen moet het type van de literal en de property overeenkomen
    const validateEqualType: SelectedValueChecker = option.fromPredicate(
      (selectedValue) =>
        selection.selectedProperty.type === "date" ||
        selectedValue.valueType === selection.selectedProperty.type
    );

    // Bij een date property kunnen de waarden ofwel een date ofwel een range zijn
    const validateDateType: SelectedValueChecker = option.fromPredicate(
      (selectedValue) =>
        selection.selectedProperty.type !== "date" ||
        pipe(selectedValue.valueType, arrays.isOneOf("date", "range"))
    );

    // Als er gesteld wordt dat het een range is, dan moet het ook echt een range zijn
    const validateDateRange: SelectedValueChecker = option.fromPredicate(
      (selectedValue) =>
        selection.selectedProperty.type !== "date" ||
        selectedValue.valueType !== "range" ||
        fltr.Range.isRelativeDateRange(selectedValue.value)
    );

    const validatedOperator: option.Option<BinaryComparisonOperator> = matchComparisonOperator<
      option.Option<BinaryComparisonOperator>
    >({
      UnaryComparisonOperator: () => option.none,
      BinaryComparisonOperator: (binOp) => option.some(binOp),
    })(selection.selectedOperator);

    // selectedValue verwijderen maakt geen verschil
    const failTransition: Lazy<ValueSelection> = () => ({
      ...selection,
      kind: "Value",
      workingValue: maybeSelectedValue,
    });

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
      option.fold(failTransition, (selectedValue) =>
        option.fold(
          () => failTransition,
          (binOp) => ({
            ...selection,
            kind: "CompletedWithValue",
            selectedValue,
            selectedOperator: binOp,
          })
        )(validatedOperator)
      )
    );
  };

  export const selectHoofdletterGevoelig: (
    boolean
  ) => (selection: ValueSelection | Completed) => TermEditor = (
    hoofdLetterGevoelig
  ) => (selection) => ({
    ...selection,
    caseSensitive: hoofdLetterGevoelig,
  });

  const initConjunctionEditor: (arg: TermEditor) => ConjunctionEditor = (
    termEditor
  ) => ConjunctionEditor([termEditor]);

  // Maak een compleete nieuwe builder aan
  export const init: (arg: ke.ToegevoegdeVectorLaag) => ExpressionEditor = (
    laag
  ) => {
    const current = FieldSelection(laag);
    return {
      laag,
      name: option.none,
      current: current,
      disjunctions: DisjunctionEditor([ConjunctionEditor([current])]),
    };
  };

  const currentLens: Lens<ExpressionEditor, TermEditor> = Lens.fromProp<
    ExpressionEditor
  >()("current");
  const disjunctionsLens: Lens<
    ExpressionEditor,
    DisjunctionsEditor
  > = Lens.fromProp<ExpressionEditor>()("disjunctions");
  const conjunctionEditorsLens: Lens<
    DisjunctionsEditor,
    ConjunctionEditor[]
  > = Lens.fromProp<DisjunctionsEditor>()("conjunctionEditors");
  const termEditorsLens: Lens<ConjunctionEditor, TermEditor[]> = Lens.fromProp<
    ConjunctionEditor
  >()("termEditors");
  const conjunctionEditorTraversal: Traversal<
    ConjunctionEditor[],
    ConjunctionEditor
  > = fromTraversable(array.array)<ConjunctionEditor>();
  const termEditorTraversal: Traversal<
    TermEditor[],
    TermEditor
  > = fromTraversable(array.array)<TermEditor>();

  const sameTermEditorAs: (arg: TermEditor) => Predicate<TermEditor> = (
    ee1
  ) => (ee2) => ee1 === ee2;
  const differentTermEditorFrom: (arg: TermEditor) => Predicate<TermEditor> = (
    ee
  ) => not(sameTermEditorAs(ee));
  const sameConjuctionEditorAs: (
    arg: ConjunctionEditor
  ) => Predicate<ConjunctionEditor> = (conj1) => (conj2) => conj1 === conj2;
  const containsSameEditorAs: (
    arg: TermEditor
  ) => Predicate<ConjunctionEditor> = (ee1) =>
    termEditorsLens
      .composeTraversal(termEditorTraversal)
      .asFold()
      .exist(sameTermEditorAs(ee1));

  const getTermEditorInTermEditorsPrism: (
    arg: TermEditor
  ) => Prism<TermEditor, TermEditor> = (ee) =>
    Prism.fromPredicate(sameTermEditorAs(ee));
  const getTermEditorInConjunctionEditorPrism: (
    arg: TermEditor
  ) => Prism<ConjunctionEditor, ConjunctionEditor> = (ee) =>
    Prism.fromPredicate(containsSameEditorAs(ee));
  const getConjunctionEditorPrism: (
    arg: ConjunctionEditor
  ) => Prism<ConjunctionEditor, ConjunctionEditor> = (conj) =>
    Prism.fromPredicate(sameConjuctionEditorAs(conj));
  const nameLens: Lens<ExpressionEditor, option.Option<string>> = Lens.fromProp<
    ExpressionEditor
  >()("name");

  const getTermEditorTraversal: (
    arg: TermEditor
  ) => Traversal<ExpressionEditor, TermEditor> = (ee) =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .composeTraversal(conjunctionEditorTraversal)
      .composeLens(termEditorsLens)
      .compose(termEditorTraversal)
      .composePrism(getTermEditorInTermEditorsPrism(ee));

  const getConjunctionEditorForTermEditorTraversal: (
    arg: TermEditor
  ) => Traversal<ExpressionEditor, ConjunctionEditor> = (ee) =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .composeTraversal(conjunctionEditorTraversal)
      .composePrism(getTermEditorInConjunctionEditorPrism(ee));

  const getConjunctionEditorTraversal: (
    arg: ConjunctionEditor
  ) => Traversal<ExpressionEditor, ConjunctionEditor> = (conj) =>
    disjunctionsLens
      .compose(conjunctionEditorsLens)
      .composeTraversal(conjunctionEditorTraversal)
      .composePrism(getConjunctionEditorPrism(conj));

  // Pas de huidige TermEditor aan
  export const update: (arg: TermEditor) => Endomorphism<ExpressionEditor> = (
    termEditor
  ) => (expressionEditor) => {
    const originalTermEditor = currentLens.get(expressionEditor);
    return applySequential([
      currentLens.set(termEditor), //
      getTermEditorTraversal(originalTermEditor).set(termEditor),
    ])(expressionEditor);
  };

  export const setName: (
    arg: option.Option<string>
  ) => Endomorphism<ExpressionEditor> = nameLens.set;

  export const setCurrent: (arg: TermEditor) => Endomorphism<ExpressionEditor> =
    currentLens.set;

  export const isCurrent: (arg: ExpressionEditor) => Predicate<TermEditor> = (
    expressionEditor
  ) => sameTermEditorAs(currentLens.get(expressionEditor));

  // Controleer of het huidige element verwijderd mag worden (geen lege expressies!)
  export const canRemoveCurrent: Predicate<ExpressionEditor> = (
    expressionEditor
  ) =>
    expressionEditor.disjunctions.conjunctionEditors.length > 1 ||
    expressionEditor.disjunctions.conjunctionEditors.some(
      (ce) => ce.termEditors.length > 1
    );

  const reallyRemove: Endomorphism<ExpressionEditor> = (expressionEditor) => {
    const affectedConjunctionEditorTraversal = getConjunctionEditorForTermEditorTraversal(
      expressionEditor.current
    );
    // De ExpressionEditor zonder current in de disjunctions (heeft mogelijks lege conjunctions)
    const unsafeRemoved = affectedConjunctionEditorTraversal
      .composeLens(termEditorsLens)
      .modify((terms) =>
        array.filter(differentTermEditorFrom(expressionEditor.current))(terms)
      )(expressionEditor);
    // We moeten er voor zorgen dat er geen conjunctions zonder terms in zijn
    const normalised = disjunctionsLens
      .compose(conjunctionEditorsLens)
      .modify((conjunctionEditors) =>
        array.filter((conjunctionEditor: ConjunctionEditor) =>
          arrays.isNonEmpty(conjunctionEditor.termEditors)
        )(conjunctionEditors)
      )(unsafeRemoved);
    // De laatste TermEditor in dezelfde ConjunctionEditor als current
    const maybeLastSibling = pipe(
      affectedConjunctionEditorTraversal
        .composeLens(termEditorsLens)
        .asFold()
        .headOption(expressionEditor),
      option.chain((terms) =>
        array.findLast(differentTermEditorFrom(expressionEditor.current))(terms)
      )
    );
    // Met NonEmptyArray ipv Array zou `last` veel properder zijn
    const next = option.getOrElse(() =>
      pipe(
        array.last(normalised.disjunctions.conjunctionEditors),
        option.chain((ce) => array.last(ce.termEditors)),
        option.getOrElse(() => expressionEditor.current) // Omdat de arrays niet leeg kunnen zijn, weten we dat dit nooit nodig zal zijn
      )
    )(maybeLastSibling);
    return setCurrent(next)(normalised);
  };

  // Verwijder het huidige element, tenzij laatste chip, maak die dan leeg
  export const remove: Endomorphism<ExpressionEditor> = (expressionEditor) => {
    // We kunnen de laatste builder niet verwijderen. Wanneer we het huidige element in de conjunction verwijderen, dan
    // maken we de laatste term in de conjunction het nieuwe huidige element. Indien er geen is, dan gaan we naar de de
    // laatste term van de laatste disjunction.
    return canRemoveCurrent(expressionEditor)
      ? reallyRemove(expressionEditor)
      : update(FieldSelection(expressionEditor.laag))(expressionEditor);
  };

  // voeg onderaan een OF toe en maak de nieuwe TermEditor de actieve
  export const addDisjunction: Endomorphism<ExpressionEditor> = (
    expressionEditor
  ) => {
    const newEditor = FieldSelection(expressionEditor.laag);
    return applySequential([
      disjunctionsLens
        .compose(conjunctionEditorsLens)
        .modify((de) => array.snoc(de, initConjunctionEditor(newEditor))),
      setCurrent(newEditor),
    ])(expressionEditor);
  };

  // voeg een EN toe op geselecteerde rij van de huidige TermEditor en maak die de nieuwe actieve
  export const addConjunction: (
    arg: ConjunctionEditor
  ) => Endomorphism<ExpressionEditor> = (conjunctionEditor) => (
    expressionEditor
  ) => {
    const newEditor = FieldSelection(expressionEditor.laag);
    return applySequential([
      getConjunctionEditorTraversal(conjunctionEditor)
        .composeLens(termEditorsLens)
        .modify((ce) => array.snoc(ce, newEditor)),
      setCurrent(newEditor),
    ])(expressionEditor);
  };

  const ExpressionEditor: (
    name: option.Option<string>,
    laag: ke.ToegevoegdeVectorLaag,
    current: TermEditor,
    disjunctions: DisjunctionsEditor
  ) => ExpressionEditor = (name, laag, current, disjunctions) => ({
    name,
    laag,
    current,
    disjunctions,
  });

  const toLiteralValue: (literal: fltr.Literal) => LiteralValue = (literal) =>
    LiteralValue(literal.type)(literal.value);

  const completedTermEditor: (
    arg1: ke.ToegevoegdeVectorLaag,
    arg2: fltr.Comparison
  ) => TermEditor = (laag, comparison) => {
    const distinctValues = pipe(
      array.findFirst((vi: ke.VeldInfo) => vi.naam === comparison.property.ref)(
        veldinfos(laag)
      ),
      option.chain((vi) =>
        pipe(
          option.fromNullable(vi.uniekeWaarden),
          option.map(array.sort(ord.ordString))
        )
      ),
      option.getOrElse(() => [])
    );
    const selectedProperty: Property = {
      ...comparison.property,
      distinctValues,
    };

    return fltr.matchComparison<TermEditor>({
      UnaryComparison: (unOp) => {
        const selectedOperator = unaryComparisonOperator(unOp.operator);
        return {
          kind: "Completed",
          properties: properties(laag),
          selectedProperty,
          selectedOperator,
          operatorSelectors: genericOperatorSelectors(selectedProperty)
            .operators,
          valueSelector: EmptyValueSelector,
        };
      },
      BinaryComparison: (binOp) => {
        const selectedOperator = binaryComparisonOperator(
          binOp.operator,
          binOp.value
        );
        return {
          kind: "CompletedWithValue",
          properties: properties(laag),
          selectedProperty,
          operatorSelectors: genericOperatorSelectors(selectedProperty)
            .operators,
          selectedOperator,
          selectedValue: toLiteralValue(binOp.value),
          valueSelector: completedOperatorSelectors(
            selectedProperty,
            selectedOperator
          ).valueSelector,
          caseSensitive: binOp.caseSensitive,
        };
      },
    })(comparison);
  };

  const fromComparison: (
    name: option.Option<string>,
    laag: ke.ToegevoegdeVectorLaag,
    comparison: fltr.Comparison
  ) => ExpressionEditor = (name, laag, comparison) => {
    const current: TermEditor = completedTermEditor(laag, comparison);
    return ExpressionEditor(
      name,
      laag,
      current,
      DisjunctionEditor([ConjunctionEditor([current])])
    );
  };

  const toConjunctionEditor: (
    arg1: ke.ToegevoegdeVectorLaag,
    arg2: fltr.ConjunctionExpression
  ) => ConjunctionEditor = (laag, expression) => {
    switch (expression.kind) {
      case "And":
        return ConjunctionEditor(
          array.chain(
            (exp: fltr.ConjunctionExpression) =>
              toConjunctionEditor(laag, exp).termEditors
          )([expression.left, expression.right])
        );
      case "BinaryComparison":
        return ConjunctionEditor([completedTermEditor(laag, expression)]);
      case "UnaryComparison":
        return ConjunctionEditor([completedTermEditor(laag, expression)]);
    }
  };

  const fromConjunction: (
    name: option.Option<string>,
    laag: ke.ToegevoegdeVectorLaag,
    conjunction: fltr.Conjunction
  ) => ExpressionEditor = (name, laag, conjunction) => {
    const conjunctionEditor = toConjunctionEditor(laag, conjunction);
    const current = conjunctionEditor.termEditors[0]; // Bij constructie heeft een Conjunction minstens 2 comparisons
    return ExpressionEditor(
      name,
      laag,
      current,
      DisjunctionEditor([conjunctionEditor])
    );
  };

  const toDisjunctionsEditor: (
    arg1: ke.ToegevoegdeVectorLaag,
    arg2: fltr.Expression
  ) => DisjunctionsEditor = (laag, expression) => {
    switch (expression.kind) {
      case "Or":
        return DisjunctionEditor(
          array.chain(
            (exp: fltr.Expression) =>
              toDisjunctionsEditor(laag, exp).conjunctionEditors
          )([expression.left, expression.right])
        );
      case "And":
        return DisjunctionEditor([toConjunctionEditor(laag, expression)]);
      case "BinaryComparison":
        return DisjunctionEditor([
          ConjunctionEditor([completedTermEditor(laag, expression)]),
        ]);
      case "UnaryComparison":
        return DisjunctionEditor([
          ConjunctionEditor([completedTermEditor(laag, expression)]),
        ]);
    }
  };

  const fromDisjunction: (
    name: option.Option<string>,
    laag: ke.ToegevoegdeVectorLaag,
    disjunction: fltr.Disjunction
  ) => ExpressionEditor = (name, laag, disjunction) => {
    const disjunctions = toDisjunctionsEditor(laag, disjunction);
    // Bij constructie minstens 2 conjunctions en elke conjunction minstens 1 comparison
    const current = disjunctions.conjunctionEditors[0].termEditors[0];
    return ExpressionEditor(name, laag, current, disjunctions);
  };

  // Maak een builder aan voor een bestaande expressie
  const fromExpression: (
    name: option.Option<string>,
    laag: ke.ToegevoegdeVectorLaag,
    expression: fltr.Expression
  ) => ExpressionEditor = (name, laag, expression) =>
    fltr.matchExpression({
      And: (expr) => fromConjunction(name, laag, expr),
      Or: (expr) => fromDisjunction(name, laag, expr),
      BinaryComparison: (expr) => fromComparison(name, laag, expr),
      UnaryComparison: (expr) => fromComparison(name, laag, expr),
    })(expression);

  export const fromToegevoegdeVectorLaag: (
    arg: ke.ToegevoegdeVectorLaag
  ) => ExpressionEditor = (laag) =>
    fltr.matchFilter({
      EmptyFilter: () => init(laag),
      ExpressionFilter: (expr) =>
        fromExpression(expr.name, laag, expr.expression),
    })(laag.filterinstellingen.spec);

  const toLiteral: (
    arg1: BinaryComparisonOperator,
    arg2: LiteralValue
  ) => fltr.Literal = (operator, lv) =>
    fltr.Literal(operator.typeType, lv.value);

  interface ComparisonOperatorMatcher<A> {
    readonly UnaryComparisonOperator: (arg: UnaryComparisonOperator) => A;
    readonly BinaryComparisonOperator: (arg: BinaryComparisonOperator) => A;
  }

  const matchComparisonOperator: <A>(
    _: ComparisonOperatorMatcher<A>
  ) => (arg: ComparisonOperator) => A = matchers.matchKind;

  const toComparison: (arg: TermEditor) => option.Option<fltr.Comparison> = (
    termEditor
  ) => {
    switch (termEditor.kind) {
      case "Completed":
        return option.some(
          fltr.UnaryComparison(
            termEditor.selectedOperator.operator,
            termEditor.selectedProperty
          )
        );
      case "CompletedWithValue":
        return option.some(
          fltr.BinaryComparison(
            termEditor.selectedOperator.operator,
            termEditor.selectedProperty,
            toLiteral(termEditor.selectedOperator, termEditor.selectedValue),
            termEditor.caseSensitive
          )
        );
      default:
        return option.none; // De uiteindelijke conversie naar Expression zal falen als er ook maar 1 TermEditor niet Completed is
    }
  };

  const toConjunctionExpression: (
    arg: TermEditor[]
  ) => option.Option<fltr.ConjunctionExpression> = (termEditors) =>
    pipe(
      array.array.traverse(option.option)(termEditors, toComparison),
      option.chain((comps) =>
        array.foldLeft(
          () => array.head(comps), // ingeval er maar 1 element is, bnehouden we dat gewoon
          (first: fltr.Comparison, next) =>
            option.some(
              next.reduce<fltr.ConjunctionExpression>(
                (sum, val) => fltr.Conjunction(sum, val),
                first
              )
            )
        )(comps)
      )
    );

  const toDisjunctionExpression: (
    arg: ConjunctionEditor[]
  ) => option.Option<fltr.Expression> = (conjunctionEditors) =>
    pipe(
      array.array.traverse(option.option)(
        conjunctionEditors.map((ce) => ce.termEditors),
        toConjunctionExpression
      ),
      option.chain((conjs) =>
        array.foldLeft(
          () => array.head(conjs), // ingeval er maar 1 element is, bnehouden we dat gewoon
          (first: fltr.ConjunctionExpression, next) =>
            option.some(
              next.reduce<fltr.Expression>(
                (sum, val) => fltr.Disjunction(sum, val),
                first
              )
            )
        )(conjs)
      )
    );

  const toExpression: (
    arg: ExpressionEditor
  ) => option.Option<fltr.Expression> = (expressionEditor) =>
    toDisjunctionExpression(expressionEditor.disjunctions.conjunctionEditors);

  export const toExpressionFilter: (
    arg: ExpressionEditor
  ) => option.Option<fltr.ExpressionFilter> = (expressionEditor) =>
    pipe(
      toExpression(expressionEditor),
      option.map((expression) =>
        fltr.ExpressionFilter(expressionEditor.name, expression)
      )
    );

  export interface TermEditorMatcher<A> {
    readonly Field: (arg: FieldSelection) => A;
    readonly Operator: (arg: OperatorSelection) => A;
    readonly Value: (arg: ValueSelection) => A;
    readonly Completed: (arg: Completed) => A;
    readonly CompletedWithValue: (arg: CompletedWithValue) => A;
  }

  export const matchTermEditor: <A>(
    _: TermEditorMatcher<A>
  ) => (arg: TermEditor) => A = matchers.matchKind;

  const setoidFieldSelection: eq.Eq<FilterEditor.FieldSelection> = eq.getStructEq(
    {
      kind: eq.eqString,
      properties: array.getEq(
        eq.contramap<string, Property>((p) => p.ref)(eq.eqString)
      ),
    }
  );

  const setoidBinaryComparisonOperator: eq.Eq<BinaryComparisonOperator> = pipe(
    fltr.setoidBinaryComparisonOperator,
    eq.contramap((o) => o.operator)
  );

  const setoidUnaryComparisonOperator: eq.Eq<UnaryComparisonOperator> = pipe(
    fltr.setoidUnaryComparisonOperator,
    eq.contramap<fltr.UnaryComparisonOperator, UnaryComparisonOperator>(
      (o) => o.operator
    )
  );

  export const setoidComparisonOperator: eq.Eq<ComparisonOperator> = byKindEq<
    ComparisonOperator,
    string
  >({
    BinaryComparisonOperator: setoidBinaryComparisonOperator,
    UnaryComparisonOperator: setoidUnaryComparisonOperator,
  });

  const setoidOperatorSelection: eq.Eq<OperatorSelection> = eq.getStructEq({
    kind: eq.eqString,
    properties: array.getEq(fltr.setoidPropertyByRef),
    selectedProperty: fltr.setoidPropertyByRef,
    operatorSelectors: array.getEq(setoidComparisonOperator),
  });

  const freeInputValueTypeSetoid: eq.Eq<FreeInputValueType> = eq.eqString;

  const freeInputValueSelectorSetoid: eq.Eq<FreeInputValueSelector> = pipe(
    freeInputValueTypeSetoid,
    eq.contramap((vs) => vs.valueType)
  );
  const freeInputValueSelectorSetoid2: eq.Eq<FreeInputValueSelector> = pipe(
    freeInputValueTypeSetoid,
    eq.contramap((vs) => vs.valueType)
  );

  const rangeValueSelectorSetoid: eq.Eq<RangeValueSelector> = pipe(
    freeInputValueTypeSetoid,
    eq.contramap((vs) => vs.valueType)
  );

  const selectionValueSelectorSetoid: eq.Eq<SelectionValueSelector> = pipe(
    eq.getTupleEq(eq.eqString, array.getEq(eq.eqString)),
    eq.contramap(
      (vs) => [vs.selectionType, vs.values] as [SelectionType, string[]]
    )
  );

  const dateTypeSetoid: eq.Eq<DateType> = eq.eqString;
  const dateValueSelectorSetoid: eq.Eq<DateValueSelector> = pipe(
    dateTypeSetoid,
    eq.contramap((vs) => vs.dateType)
  );

  const setoidValueSelector: eq.Eq<ValueSelector> = byKindEq({
    empty: singletonEq,
    free: freeInputValueSelectorSetoid,
    selection: selectionValueSelectorSetoid,
    range: rangeValueSelectorSetoid,
    date: dateValueSelectorSetoid,
  });

  const setoidValueSelection: eq.Eq<ValueSelection> = eq.getStructEq({
    kind: eq.eqString,
    properties: array.getEq(fltr.setoidPropertyByRef),
    selectedProperty: fltr.setoidPropertyByRef,
    operatorSelectors: array.getEq(setoidComparisonOperator),
    selectedOperator: setoidComparisonOperator,
    valueSelector: setoidValueSelector,
  });

  const setoidLiteralValue: eq.Eq<LiteralValue> = eq.fromEquals(eq.strictEqual); // de waarden zijn v/h type string, number of boolean

  const setoidSelectedValue: eq.Eq<SelectedValue> = setoidLiteralValue;

  const setoidCompleted: eq.Eq<Completed> = eq.getStructEq({
    kind: eq.eqString,
    properties: array.getEq(fltr.setoidPropertyByRef),
    selectedProperty: fltr.setoidPropertyByRef,
    operatorSelectors: array.getEq(setoidComparisonOperator),
    selectedOperator: setoidComparisonOperator,
  });

  const setoidCompletedWithValue: eq.Eq<CompletedWithValue> = eq.getStructEq({
    kind: eq.eqString,
    properties: array.getEq(fltr.setoidPropertyByRef),
    selectedProperty: fltr.setoidPropertyByRef,
    operatorSelectors: array.getEq(setoidComparisonOperator),
    selectedOperator: setoidComparisonOperator,
    valueSelector: setoidValueSelector,
    selectedValue: setoidSelectedValue,
  });

  export const setoidTermEditor: eq.Eq<TermEditor> = eq.fromEquals(
    (te1, te2) =>
      te1.kind === te2.kind &&
      matchTermEditor({
        Field: () =>
          setoidFieldSelection.equals(
            te1 as FieldSelection,
            te2 as FieldSelection
          ),
        Operator: () =>
          setoidOperatorSelection.equals(
            te1 as OperatorSelection,
            te2 as OperatorSelection
          ),
        Value: () =>
          setoidValueSelection.equals(
            te1 as ValueSelection,
            te2 as ValueSelection
          ),
        Completed: () =>
          setoidCompleted.equals(te1 as Completed, te2 as Completed),
        CompletedWithValue: () =>
          setoidCompletedWithValue.equals(
            te1 as CompletedWithValue,
            te2 as CompletedWithValue
          ),
      })(te1)
  );

  export const matchLiteralValueWithFallback: <A>(
    _: matchers.FallbackMatcher<LiteralValue, A, fltr.TypeType>
  ) => (lv: LiteralValue) => A = (matcher) =>
    matchers.matchWithFallback(matcher)((lv) => lv.valueType);

  export interface ValueSelectorMatcher<A> {
    readonly empty: (arg: EmptyValueSelector) => A;
    readonly free: (arg: FreeInputValueSelector) => A;
    readonly selection: (arg: SelectionValueSelector) => A;
    readonly date: (arg: DateValueSelector) => A;
    readonly range: (arg: RangeValueSelector) => A;
  }

  export const matchValueSelector: <A>(
    matcher: ValueSelectorMatcher<A>
  ) => (arg: ValueSelector) => A = matchers.matchKind;
}
