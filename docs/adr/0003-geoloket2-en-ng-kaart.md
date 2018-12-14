# 3. Geoloket2 en ng-kaart

Date: 13/12/2018

## Status

Draft

## Context

Er zijn bijkomende redenen in de beslissing om te stoppen met Geoloket en over te gaan naar Geoloket 2. We wensen namelijk dat alle toepassingen binnen AWV die gegevens op een kaart willen weergeven (en er zijn er zo nogal wat):

1. dat allemaal met een gelijkaardige look en feel doen
1. dat met een minimum aan ontwikkelingsinspanning kunnen doen
1. daarbij gebruik kunnen maken van features die in eerste instantie voor andere toepassingen ontwikkeld zijn maar ook in de betreffende applicatie een toegevoegde waarde kunnen bieden

Er bestaat al een kern van een Javascript module onder de vorm van een Angular bibliotheek die kaartgegevens kan visualiseren.

Niet alleen willen andere teams dan Team Rood gebruik maken van bestaande functionaliteit, ze moeten ook kunnen bijdragen in de ontwikkeling van features die voor meer dan hun eigen applicaties nuttig kunnen zijn.

## Decision

We hebben besloten om de ontwikkeling van Geoloket2 in twee afzonderlijke delen te splitsen. Enerzijds de bibliotheek *ng-kaart* en anderzijds de applicatie *Geoloket2*.

### ng-kaart

In ng-kaart brengen we alle gemeenschappelijke functionaliteit onder. Die omvat alle interacties op het niveau van een enkele kaart die opgebouwd is uit lagen die over elkaar heen weergegeven worden. Dit is onder andere:

1. toevoegen, verwijderen, zichtbaar en onzichtbaar maken van lagen
1. opvragen van data voor die lagen bij servers van geografische data
1. schalen en verschuiven van de kaart
1. weergeven van een legende en overzicht van alle lagen
1. zoekers voor algemene data (bijv. in Google of CRAB)

Daarnaast bieden we een raamwerk aan waarbij applicaties ng-kaart verder kunnen customiseren op een applicatiespecifieke manier. Voorbeelden daarvan zijn:

1. zoekers voor applicatiespecifieke databronnen
1. weergave van applicatiespecifieke data wanneer op een plaats in de kaart geklikt wordt

Uiteraard hebben applicaties controle over de manier waarmee gegevens op een kaart weergegeven worden (o.a. vorm, kleur en grootte).

### Geoloket 2

In Geoloket 2 maken we gebruik van ng-kaart en voegen daar specifieke functionaliteit aan toe zoals:

1. Wisselen tussen kaarten (verzameling van lagen)
1. Persistentie van de definities van kaarten en lagen
1. Personalisering van een kaart
1. Opladen van data naar een server en registratie daarvan als een laag

## Consequences

Geoloket 2 en ng-kaart worden als afzonderlijke softwareartefacten elk met hun eigen ontwikkelingscyclus behandeld.

Er is een significante extra kost verbonden aan de ontwikkeling voor Geoloket 2 gezien functionaliteit doorgaans generieker geïmplementeerd zal worden in ng-kaart. Er is ook altijd een volledige build van ng-kaart nodig eer een ontwikkeling in ng-kaart in Geoloket 2 gebruikt of zelfs maar getest kan worden.

ng-kaart heeft een afzonderlijke demoapplicatie nodig om enerzijds de ontwikkeling en debugging van functionaliteit te ondersteunen en anderzijds om als voorbeeld te dienen in het gebruik voor de afnemers in andere teams.
