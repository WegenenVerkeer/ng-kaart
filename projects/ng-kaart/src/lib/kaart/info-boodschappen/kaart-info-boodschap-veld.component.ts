import { Component, Input } from "@angular/core";
import { option } from "fp-ts";
import { KaartChildDirective } from "../kaart-child.directive";
import { copyToClipboard } from "../../util/clipboard";
import { VeldType } from "../kaart-elementen";
import { formateerDate, parseDate } from "../../util/date-time";

@Component({
  selector: "awv-kaart-info-veld",
  templateUrl: "./kaart-info-boodschap-veld.component.html",
  styleUrls: ["./kaart-info-boodschap-veld.component.scss"],
})
export class KaartInfoBoodschapVeldComponent extends KaartChildDirective {
  @Input()
  label: string;

  @Input()
  waarde: string | number | boolean;

  @Input()
  veldType: VeldType = "string";

  @Input()
  isKopieerbaar = false;

  @Input()
  displayFormat?: string;

  @Input()
  parseFormat?: string;

  copyToClipboard(toCopy: string | number | boolean) {
    copyToClipboard(toCopy);
  }

  dateWaarde(): string {
    return this.maybeDateWaarde().getOrElse("");
  }

  validDateWaarde(): boolean {
    return this.maybeDateWaarde().isSome();
  }

  private maybeDateWaarde(): option.Option<string> {
    return option
      .fromNullable(this.waarde)
      .chain(parseDate(option.fromNullable(this.parseFormat)))
      .map(formateerDate(option.fromNullable(this.displayFormat)));
  }
}
