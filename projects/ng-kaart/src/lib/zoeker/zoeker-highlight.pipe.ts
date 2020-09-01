import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "highlight" })
export class ZoekerHighlightPipe implements PipeTransform {
  transform(text: string, search): string {
    // We moeten heel de lijn in een span zetten.
    const span = (res) => `<span class="awv-zoeker-highlighter">${res}</span>`;

    // De value van de control (search) kan ook een object zijn, dan doen we de highlighting niet.
    // Enkel wanneer search een niet-lege string is, gaan we highlighting doen.
    if (
      search &&
      typeof search === "string" &&
      search.trim().length > 0 &&
      text
    ) {
      // We splitsen onze zoekterm op spaties en gebruiken ieder stukje om te matchen.
      const pattern = search
        .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|<>]/g, "\\$&")
        .split(" ")
        .filter((t) => t.length > 0)
        .map((expr) => "(?<!<[^>]*)" + expr + "(?!>)") // Negeer matches in een tag.
        .join("|");
      const regex = new RegExp(pattern, "gi");

      // Iedere match wordt nog eens in een andere span gezet.
      return span(
        text.replace(
          regex,
          (match) => `<span class="awv-zoeker-highlight">${match}</span>`
        )
      );
    } else {
      return span(text);
    }
  }
}
