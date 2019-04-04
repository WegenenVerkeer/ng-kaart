# 4. Webcomponent voor classic ng-kaartFeature caching zonder service worker

Date: 04/04/2019

## Status

Accepted

## Context

Ng-kaart moet als webcomponent gebruikt kunnen worden.

## Decision

We gebruiken Angular Elements om onze classic-kaart tags om te vormen naar webcomponents.

## Consequences

Parent injection (waarbij de component die de enclosing tag beheert, geinjecteerd wordt in de component van de enclosed tag), werkt niet in Angular Elements.

Onze classic kaart componenten steunen heel hard op parent injection om de KaartClassicComponent te krijgen en in het geval van de Legende componenten ook op de @ContentChildren annotatie, die ook niet werkt in Angular Elements.

Wat wel werkt zijn services, dus alles wat door de NgModule waarin de Angular Elements geregistreerd zijn, geprovide wordt, wordt gedeeld door de verschillende componenten.

De workaround is dus om een KaartClassicLocatorService te maken die de DOM tree afgaat om te zoeken naar de Component van de enclosing tag ipv de injector.

Dit betekent dat alle classic kaart componenten aangepast moeten worden om die service te gebruiken.

Een nadeel van deze manier van werken is dat we moeten zorgen dat de enclosing componenten aangemaakt worden voordat de enclosed componenten hun parent component nodig hebben.

Dit is een bijkomend probleem in Angular Elements, want het is niet de DOM tree die bepaalt in welke volgorde componenten aangemaakt worden, maar de volgorde waarin componenten geregistreerd zijn bij Angular Elements.

### Implementatienotas

De meeste componenten zijn niet zo moeilijk om te vormen en kunnen gebruik maken van een nieuwe ClassicBaseComponent die het werk doet.

Extra werk is nodig voor de legende componenten: daar moet de injectie omgedraaid worden, ipv dat de parent zijn kinderen opvraagt, moeten de kinderen zichzelf registreren bij hun parent.