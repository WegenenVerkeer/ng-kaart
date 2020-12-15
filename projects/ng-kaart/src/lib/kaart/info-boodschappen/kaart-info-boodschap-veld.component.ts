import { Component, Input } from "@angular/core";
import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
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
  kopieerWaarde?: string | number | boolean;

  @Input()
  displayFormat?: string;

  @Input()
  parseFormat?: string;

  copyToClipboard() {
    pipe(
      option.fromNullable(this.kopieerWaarde),
      option.fold(
        () => copyToClipboard(this.waarde),
        (waarde) => copyToClipboard(waarde)
      )
    );
  }

  dateWaarde(): string {
    return pipe(
      this.maybeDateWaarde(),
      option.getOrElse(() => "")
    );
  }

  validDateWaarde(): boolean {
    return pipe(this.maybeDateWaarde(), option.isSome);
  }

  private maybeDateWaarde(): option.Option<string> {
    return pipe(
      option.fromNullable(this.waarde),
      option.chain(parseDate(option.fromNullable(this.parseFormat))),
      option.map(formateerDate(option.fromNullable(this.displayFormat)))
    );
  }
}
