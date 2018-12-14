# 4. Intra-applicatiecommunicatie

Date: 13/12/2018

## Status

Draft

## Context

Angular bied een breed spectrum van primitieven aan om applicaties mee op te bouwen. De vele tutorials op het web richten zich echter vooral op hoe afzonderlijke componenten ontwikkeld worden.

We hebben ervaring met maken van 1 uitgebreide applicatie in Angular 4, nl. Werf. Een pijnpunt daar is echter hoe informatie gedeeld wordt tussen componenten. 

De standaard Angular mogelijkheden om informatie te delen zijn hoofdzakelijk:
1. Via `@Input` en `@Output` paramters op componentniveau
1. Via parent-child relaties (injectie van de parent en zoeken van kinden met bijv. `@ContentChild`)
1. Via Services

Het probleem hiermee is echter dat:
1. het moeilijk is om een bepaalde manier van werken af te dwingen, en belangrijker nog dat we ons constant moeten afvragen hoe een bepaald probleem het beste aangepakt kan worden
1. mogelijkheden 1 en 2 enkel vam toepassing zijn op componenten die direct met elkaar in verbinding staan (of er moeten hele kettingen opgebouwd worden)
1. alle mogelijkheden vrij bewerkelijk zijn

Ng-kaart is geen form-gedreven toepassing met een duidelijke hiërarchie, maar bestaat uit vele ogenschijnlijk losse functionaliteiten die toch een effect hebben op elkaar. Een typisch voorbeeld is het positieopvolging waarbij de locatie van het toestel waarop een ng-kaarttoepassing uitegevoerd wordt gebruikt wordt om het middelpunt, de oriëntatie en de schaal van de kaart continu aan te passen. Daarbij wordt ook een laag toegevoegd waarop de geschatte positie weergegeven wordt.

Concurerende frameworks zoals React (met Redux) bieden als antwoord hierop een globale, onveranderlijke applicatietoestand die gedisciplineerd aangepast en ondervraagd kan worden.

Er zijn aantal Angular extenties modules te verkrijgen, zoals ng-rx, die deze manier van werken, en een groot stuk van de code, porteren.

Naast componenten, directives en services is een ander belangrijk fundament van Angular Observables. Met name in de vorm van de RxJS bibliotheek. Observables zijn bij uitstek geschikt om met asynchrone updates om te gaan.

Observables hebben een niet-triviale leercurve, maar is binnen het team wel enige kennis van en ervaring met Observables aanwezig.

## Decision

We gaan geen gebruik maken van ng-rx, maar Geoloket2 wel opzetten om hoofdzakelijk met RxJS te werken. Hiermee bedoelen we dat Observables gebruikt zullen worden om verschillende delen van de applicatie op een centraal beheerd model te laten luisteren. Generieke events worden gebruikt om het model aan te passen (meer exact om een nieuwe versie van het model te genereren).

## Consequences

Ng-kaart en Geoloket 2 zullen een afwijkende design hebben van de doorsnee Angular applicatie.

We zijn niet gebonden aan een extern framework en kunnen Angular upgraden wanneer er een nieuwe versie beschikbaar komt zonder te hoeven wachten tot de externe bibliotheek ook een upgrade krijgt.

We kunnen op een veel functionele (a la functioneel programmeren) manier werken.
