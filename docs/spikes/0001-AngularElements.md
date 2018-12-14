# Angular elements

## Doel van de spike

Nagaan of Angular Elements kan helpen bij het terbeschikking stellen van ng-kaart aan partijen die niet met (een compatible versie van) Angular werken.

## Context

Angular Elements is een manier om Web components te maken. Web components laten toe om in moderne browsers custom tags te maken die een even rijk gedrag kunnen vertonen als standaard tags. Ze kunnen de DOM aanpassen, events uitsturen en hun weergave aanpassen op basis van attribuutwaarden.

Met Angular Elements wordt het Angular framework gebundeld in 1 javascript klasse die verantwoordelijk is voor het gedrag van de webcomponent.

## Ondernomen stappen

Literatuurstudie met als interessantste documenten:

* [Telerik blog: Getting Started with Angular Elements](https://www.telerik.com/blogs/getting-started-with-angular-elements)
* [Angular guides: Angular elements overview](https://angular.io/guide/elements)

Een demo project dat een aantal mogelijkheden demonstreert

## Demo

De source code is ingechecked onder ng-kaart als project `webcomponent`.

Er wordt gedemonstreerd hoe een eenvoudige kaart als een eenvoudige tag in een pure HTML pagina weergegeven kan worden. 

Er wordt ook getoond hoe een property van awv-kaart-classic gezet kan worden.

De webcomponent wordt aangemaakt met `npm run build:elements`. Enerzijds maakt dit de klassen nodig voor een web component en anderzijds wordt een `webcomponent.js` en `styles.css` aangemaakt in `dist/elements`. Deze 2 bestanden kunnen aan een andere applicatie toegevoegd worden om de web component te testen.

Ga naar `dist\webcomponent` en start daar `npx static-server`. Browse vervolgens naar http://localhost:9080/

## Bevindingen

Het is wel degelijk bijna triviaal om een web component te maken.

Helaas zijn er wel een aantal beperkingen die ng-kaart parten spelen. In pincipe moe de ViewEncapsulation op `Native` of `ShadowDom` staan en dat is nu niet zo voor alle tags. Hier zouden we nog wel rond kunnen werken of dit aanpassen. Belangrijker echter, is dat de tag `awv-kaart-classic` intensief gebruik maakt van geneste tags om de kaart te configureren. En geneste tags worden (nog) niet ondersteund door Angular 7.1. Mochten we elke `awv-kaart-*` tag als een web component aanbieden, dan zouden die elk hun afzonderlijke instantie van Angular draaien. En die kunnen niet met elkaar communiceren (of toch geen gemeenschappelijke componenthierarchie opbouwen).

Er wordt gezegd dat de nieuwe Ivy backend voor Angular hier een uitkomst zou voor kunnen zijn, maar wanneer die gereleased wordt en of deze beperking dan effectief opgeheven zal zijn, is koffiedik kijken.

Er is echter wel een work-around die voor de meeste afnemers aanvaardbaar zou moeten zijn. Net zoals in de demo kan een minimale Angularapplicatie gemaakt worden die één projectspecifieke tag definieert. Deze tag configureert de kaart zoals een applicatie dat nodig acht. Als de applicatie de kaart dynamisch wil configureren, dan moeten `@Input`s voorzien worden op het niveau van deze projectspecifieke tag die de instelling projecteren op de manier die `awv-classic-kaart` verwacht. Ofwel als:
1. een `@Input` van `awv-classic-kaart`
1. een `@Input` van een geneste tag van `awv-classic-kaart`, bijv. `awv-kaart-lagenkiezer`
1. een dynamisch toegevoegde tag gecontroleerd door een `ngIf`. Bijv. `awv-kaart-vector-laag`
1. Een combinatie van voorgaande

In concreto voor werf bijvoorbeeld, betekent dit dat we best een module maken op hetzelfde niveau as `werf-ui` en daar een eigen `package.json` en `angular.json` definiëren.
