import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "highlight" })
export class ZoekerHighlightPipe implements PipeTransform {
  transform(text: string, search): string {
    let result: string;
    if (search && typeof search === "string" && text) {
      let pattern = search.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
      pattern = pattern
        .split(" ")
        .filter(t => {
          return t.length > 0;
        })
        .join("|");
      const regex = new RegExp(pattern, "gi");

      result = text.replace(regex, match => `<span class="awv-zoeker-highlight">${match}</span>`);
    } else {
      result = text;
    }
    return `<span class="awv-zoeker-highlighter">${result}</span>`;
  }
}
