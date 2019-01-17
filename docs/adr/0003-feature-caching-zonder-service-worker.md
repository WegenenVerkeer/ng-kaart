# 2. Feature caching zonder service worker

Date: 17/01/2019

## Status

Accepted

## Context

We moeten zowel tiles als features kunnen cachen in ng-kaart voor offline gebruik

## Decision

Om offline data te voorzien in ng-kaart werd er initieel beslist om met service workers te werken voor zowel de features als de kaart tiles. De bounding
box gebruikt om de features op te vragen is echter afhankelijk van de extent van de view op de kaart. Omdat de service worker enkel URL's kan cachen
die altijd dezelfde URL parameters hebben werd volgend systeem bedacht: 

1. Er komt een extent binnen van de kaart om de features op te vragen
2. De NosqlfsLoader component van ng-kaart gaat deze call opsplitsen in X aantal nieuwe calls gebaseerd op een vaste grid (bvb 1km x 1km gebieden)
3. De service worker kijkt voor de X aantal calls of er op die vaste grid boundaries al een tile bestaat. Indien ja, stuur terug, indien nee vraag online op

Deze oplossing gaat echter de gevolgen van de beperkingen van de service worker doortrekken tot in de logica van feature loaders van ng-kaart. 
Daarom werd beslist om voor het ophalen van de features geen gebruik te maken van een service worker maar om die wel of niet in een indexeddb bewaren mee te integreren
binnen de Nosqlfs van ng-kaart. 

Stappen:

1. Er komt een extent binnen van de kaart om de features op te vragen
2. NosqlfsLoader gaat de features voor die extent opvragen aan featureserver
3. Bij ontvangen van de features worden deze bewaard in een indexeddb (1 per laag), gemanaged door ng-kaart
4. Indien NosqlfsLoader binnen 5 seconden geen antwoord heeft gekregen, worden de features uit de indexeddb gehaald 

## Consequences

Iets meer fetch strategy ontwikkelingen binnen ng-kaart, maar efficienter ophalen en beheren van features. 
Mogelijkheden ook om extra metadata bij features op te slaan (bvb time saved in indexeddb).
