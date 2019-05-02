import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  MatAutocompleteModule,
  MatButtonModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule
} from "@angular/material";

import { FilterDetailComponent } from "./filter-detail.component";
import { FilterEditorComponent } from "./filter-editor.component";
import { FilterExpressionComponent } from "./filter-expression.component";
import { FilterTermComponent } from "./filter-term.component";
import { FilterChipComponent } from "./querybuilder/filter-chip.component";
import { FilterConjunctionComponent } from "./querybuilder/filter-conjunction.component";
import { FilterQueryBuilderComponent } from "./querybuilder/filter-query-builder.component";

const components: any[] = [
  FilterEditorComponent,
  FilterExpressionComponent,
  FilterDetailComponent,
  FilterTermComponent,
  FilterQueryBuilderComponent,
  FilterConjunctionComponent,
  FilterChipComponent
];

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatMenuModule,
    MatAutocompleteModule
  ],
  declarations: [components],
  exports: [components],
  providers: []
})
export class FilterModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: FilterModule,
      providers: []
    };
  }
}

export * from "./filter-detail.component";
export * from "./filter-editor.component";
export * from "./filter-expression.component";
export * from "./filter-model";
export * from "./filter-persistence";
export * from "./filter-editor.component";
export * from "./filter-term.component";
export * from "./querybuilder/filter-conjunction.component";
export * from "./querybuilder/filter-chip.component";
export * from "./querybuilder/filter-query-builder.component";
