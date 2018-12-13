# 2. Geoloket2 basis

Date: 12/12/2018

## Status

Draft

## Context

Sinds verschillende jaren bestaat er een tool Geoloket die een aantal van de geografische datasets van het Agentschap Wegen en Verkeer ontsluit voor een intern publiek. Geoloket wordt als een webapplicatie aan de gebruikers aangeboden.

Deze applicatie functioneert nog steeds op moderne browsers, en was in zijn beginjaren een oogopener, maar naarmate de tijd vorderde dokem er een problemen op:
* de technologiestack (Ext JS) wordt als verouderd aanzien en ontwikkeling van nieuwe functionaliteit en zelfs onderhoud zijn erg tijdrovend
* ondertussen zijn platformen zoals Google Maps zo veel verder gevorderd in beschikbare features en gebruikservaring dat de gebruikers de oude geoloket als oudbollig en achterhaald beschouwen
* de bestaande toepassing is niet geschikt voor gebruik op mobiele platformen

Tegelijkertijd is het zo dat de geografische gegevens van AWV en verwante diensten in een specifiek formaat (projectie) zijn wat maakt dat die niet zo maar te integreren is in (ons bekende) toepassingen.

Verder wensen we, conform met de algemene AWV applicatiearchitectuur, de gegevens te blijven aanbieden als een webtoepassing.

## Decision

We gaan een volledig nieuwe versie van Geoloket bouwen, genaamd Geoloket 2.

De basisarchitectuur nemen we over van de andere toepassingen van AWV in het algemeen en Team Rood in het bijzonder. Dit zijn:

1. Een front-end op basis van Angular
2. Een back-end op basis van Play (Scala)
3. Persistentie op basis van Postgresql
4. Alles wordt gehost op AWS

## Consequences

We kunnen een groot deel van de expertise die we hebben blijven verder gebruiken.