# Client Developer Guide & Tutorial

Common Kaart is een Angular Library die ambieert om in te staan voor de afbeelding op kaart van alle GIS gegevens voor alle toepassingen van het Agentschap voor Wegen en Verkeer.

## Doelpubliek

Dit document is bedoeld voor ontwikkelaars die de common kaart component (vanaf nu CK) willen integreren in hun applicaties en daarvoor de tag `awv-kaart-classic` gebruiken.

Ontwikkelaars die daarentegen extra componenten willen schrijven, kijken beter naar de [Component Developer Guide](../component-developer-guide/0001-guidelines.md).

## Overzicht

Hoewel dit document bedoeld is voor ontwikkelaars die `awv-kaart-classic` gebruiken, is het toch interessant om weten hoe de CK opgebouwd is.

```
+----------------------------------------------------------- +             +----------------------------------------------------------------+
|                                                            |             |                                                                |
|                         awv-kaart                          |             |                     awv-kaart-classic                          |
|                                                            |             |                                                                |
|  +----------------+ +----------------------+ +----------+  |             |   +--------------------+ +------------------+ +------------+   |
|  |                | |                      | |          |  |  <------>   |   |                    | |                  | |            |   |
|  | awv-kaart-zoom | | awv-kaart-teken-laag | |   ....   |  |             |   | awv-kaart-wms-laag | | awv-kaart-schaal | |    ....    |   |
|  |                | |                      | |          |  |             |   |                    | |                  | |            |   |
|  +----------------+ +----------------------+ +----------+  |             |   +--------------------+ +------------------+ +------------+   |
|                                                            |             |                                                                |
+----------------------------------------------------------- +             +----------------------------------------------------------------+
```

We hebben aan de ene kant de tag `awv-kaart` en aan de andere kant de tag `awv-kaart-classic`. Elk van deze tags hebben hun eigen mogelijke set van child components. 
Deze child components kunnen *niet* uitgewisseld worden: een component die bedoeld is voor `awv-kaart` werkt niet als een child component voor `awv-kaart-classic` en vice versa.
In de praktijk betekent dit dat gebruikers van `awv-kaart-classic` maar een subset van de componenten kunnen gebruiken die in de CK library gebundeld zijn.
De naamgeving van de componenten maakt helaas niet duidelijk over welke soort het gaat. Wel is het zo dat componenten voor `awv-kaart` afgeleid zijn van `KaartChildComponentBase`. 
De componenten voor `awv-kaart-classic` bevinden zich in onder de `classic` directory in de source code. Verder in dit document worden enkel nog de classic componenten behandeld.

## Configuratie van de kaart

De configuratie van beschikbare widgets:

> Dit document schrijven als een tutorial om de ng-kaart te integreren.  

> Duidelijk alle configuratieparameters beschrijven en eventueel sensible defaults introduceren. 

> Eventueel [compodoc](https://github.com/compodoc/compodoc) gebruiken gebruiken om het klassendiagramma te genereren?


### Algemene opties 

#### Pannen en zoomen

#### Bevragen van de kaart

#### De kaart roteren

#### Center-coördinaat 


### Opties linkerpaneel

#### Zoeken op de kaart

#### De lagen tonen

#### Lagen verwijderen

#### De legende

#### Custom header in linkerpaneel

#### Custom elementen in linkerpaneel

#### Custom afmetingen linkerpaneel


### Widgets onderaan rechts 

#### Meerdere achtergrondlagen

#### Streetview

#### Meten 

#### Mijn huidige locatie

#### Zoomknoppen


### Meten

Tekenmodus op- en afzetten na veranderingen. 

#### Toon info

#### Meerdere geometrieën 


### Kaartinfo onderaan rechts

#### Kaartschaal

#### Voorwaarden en disclaimer

#### Copyright  



## Orthofotos

## In- en Uitzoomen

## Features intekenen 

### Punt-elementen

### Lijn-elementen

### Offset rendering van lijn-elementen

### Styling

### Custom rendering

Verkeersborden 

### Features buiten de kaart


## Zoeken 


## Offline caching


## Meten

### Meten langs een lijn

### Meten van de oppervlakte van een polygoon

### Meten van een route langs de weg 

  

