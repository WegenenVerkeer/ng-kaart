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
import { FilterExpressionComponent } from "./filter-expression.component";
import { FilterComponent } from "./filter.component";

const components: any[] = [FilterComponent, FilterExpressionComponent, FilterDetailComponent];

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
export * from "./filter-expression.component";
export * from "./filter-model";
export * from "./filter-persistence";
export * from "./filter.component";
