# 3. Feature caching zonder service worker

Date: 17/01/2019

## Status

Accepted

## Context

We moeten zowel tiles als features kunnen cachen in ng-kaart voor offline gebruik

## Decision

Om offline data te voorzien in ng-kaart werd er initieel beslist om met service workers te werken voor zowel de features
als de kaart tiles. De bounding box gebruikt om de features op te vragen is echter afhankelijk van de extent van de view
op de kaart. Omdat de service worker enkel URL's kan cachen die altijd dezelfde URL parameters hebben werd volgend
systeem bedacht: 

1. Er komt een extent binnen van de kaart om de features op te vragen
2. De NosqlfsLoader component van ng-kaart gaat deze call opsplitsen in X aantal nieuwe calls gebaseerd op een vaste
   grid (bvb 1km x 1km gebieden)
3. De service worker kijkt voor de X aantal calls of er op die vaste grid boundaries al een tile bestaat. Indien ja,
   stuur terug, indien nee vraag online op

Deze oplossing gaat echter de gevolgen van de beperkingen van de service worker doortrekken tot in de logica van feature
loaders van ng-kaart. Bovendien is het aantal effectieve calls per request dan veel hoger (met performantie gevolgen).
Daarom werd beslist om voor het ophalen van de features geen gebruik te maken van een service worker maar om die wel of
niet in een indexeddb bewaren mee te integreren binnen de Nosqlfs van ng-kaart. 

Stappen:

1. Er komt een extent binnen van de kaart om de features op te vragen
2. NosqlfsLoader gaat de features voor die extent opvragen aan featureserver
3. Bij ontvangen van de features worden deze bewaard in een indexeddb (1 per laag), gemanaged door ng-kaart
4. Indien NosqlfsLoader binnen 5 seconden geen antwoord heeft gekregen, worden de features uit de indexeddb gehaald 

## Consequences

Iets meer fetch strategy ontwikkelingen binnen ng-kaart, maar efficienter ophalen en beheren van features. Mogelijkheden
ook om extra metadata bij features op te slaan (bvb time saved in indexeddb).

### Implementatienotas

IndexedDB is essentieel een key-value store. Bij basale key-value stores vergen complexe queries op de inhoud van values
table scans. Bij IndexedDB kunnen echter wel indices aangemaakt worden om opzoekingen te versnellen.

Voor de gekozen oplossing hebben we vaak queries & deletes op een view extent nodig. Een extent is 2-dimensionaal maar
een index is 1-dimensionaal. Bovendien heeft een feature, in het algemeen, zelf een bounding box, wat maakt dat een
feature gedeeltelijk in een view extent kan vallen.

Performant opvragen van features die geheel of gedeeltelijk met een extent overlappen is dus niet zo triviaal. Een
eenvoudig verstaanbaar algoritme is als volgt:
1. We maken indices aan voor de minX, maxX, minY, maxY waarden van de bounding box van de features
2. We halen de keys op van alle features waarvoor de minX binnen de [minX, maxX] van de extent ligt
3. We halen de keys op van alle features waarvoor de maxX binnen de [minX, maxX] van de extent ligt
4. We halen de keys op van alle features waarvoor de minY binnen de [minY, maxY] van de extent ligt
5. We halen de keys op van alle features waarvoor de maxY binnen de [minY, maxY] van de extent ligt
6. We maken de doorsnede van alle keys en daarmee halen we alle waarden op

Hoewel deze aanpak correct is, kunnen we toch beter doen. Eens we een index gebruiken kunnen we de waarden die bij de
index horen inspecteren en die features weerhouden die met de extent overlappen. Op die manier hoeven we maar een keer
door de features te lopen. Het meeste voordeel kunnen we behalen als we die index nemen die het minste features zal
opleveren. We weten helaas niet op voorhand welke dat zal zijn. Maar als we die dimensie nemen waarvoor de extent het
smalste is, dan hebben we de grootste kans de best index te kiezen. Er is evenwel ook een nadeel aan deze aanpak in
vergelijking met die met 4 doorsnedes. In plaats enkel over keys te itereren, moeten we de waarden ook binnen trekken en
dat heeft (de)serialisatie overhead.

Metingen op voorbeelddata tonen echter aan dat er zowel voor kleine (11 features: van 2.1 naar 0.0 s) als grote extents
(3675: van 44 naar 7 s) significante snelheidswinst behaald wordt.

Een ander belangrijk voordeel van een enkele index is dat de features onmiddellijk tijdens het itereren geëmit kunnen
worden. Gebruikers kunnen zo dus direct feedback van hun selectie krijgen.
