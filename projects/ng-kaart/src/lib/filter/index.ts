import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MatAutocompleteModule,
  MatButtonModule,
  MatCheckboxModule,
  MatDatepickerModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatSelectModule
} from "@angular/material";

import { MAT_MOMENT_DATE_ADAPTER_OPTIONS, MatMomentDateModule, MomentDateAdapter } from "@angular/material-moment-adapter";

import { FilterDetailComponent } from "./filter-detail.component";
import { FilterEditorComponent } from "./filter-editor.component";
import { FilterExpressionComponent } from "./filter-expression.component";
import { FilterTermComponent } from "./filter-term.component";
import { FilterChipComponent } from "./querybuilder/filter-chip.component";
import { FilterConjunctionComponent } from "./querybuilder/filter-conjunction.component";
import { FilterLogicalConnectiveComponent } from "./querybuilder/filter-logical-connective.component";
import { FilterQueryBuilderComponent } from "./querybuilder/filter-query-builder.component";

const components: any[] = [
  FilterEditorComponent,
  FilterExpressionComponent,
  FilterDetailComponent,
  FilterTermComponent,
  FilterQueryBuilderComponent,
  FilterChipComponent,
  FilterConjunctionComponent,
  FilterLogicalConnectiveComponent
];

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatMomentDateModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatMenuModule,
    MatAutocompleteModule,
    MatSelectModule
  ],
  declarations: [components],
  exports: [components],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: "nl-BE" },
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_MOMENT_DATE_ADAPTER_OPTIONS, useValue: { strict: true } } // Blijkt niet te werken!
  ]
})
export class FilterModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: FilterModule,
      providers: []
    };
  }
}

export * from "./filter-cql";
export * from "./filter-builder";
export * from "./filter-model";
export * from "./filter-persistence";
export * from "./filter-totaal";
export * from "./filter-detail.component";
export * from "./filter-editor.component";
export * from "./filter-expression.component";
export * from "./filter-term.component";
export * from "./querybuilder/filter-conjunction.component";
export * from "./querybuilder/filter-chip.component";
export * from "./querybuilder/filter-logical-connective.component";
export * from "./querybuilder/filter-query-builder.component";
