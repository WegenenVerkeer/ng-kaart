# Component Developer Guide & Tutorial

Common Kaart is een Angular Library die ambieert om in te staan voor de afbeelding op kaart van alle GIS gegevens voor alle toepassingen van het Agentschap voor Wegen en Verkeer.
De bedoeling is dat alle AWV-applicaties geografische gegevens op een uniforme manier weergeven én om efficiënt hergebruik van code mogelijk te maken.

## Doelpubliek

Dit document is bedoeld voor ontwikkelaars die werken aan de common kaart component (CK vanaf nu). 
Dat kan gaan om het uitbreiden of verbeteren van bestaande componenten en hun interactie of het toevoegen van nieuwe componenten.

Ontwikkelaars die vooral geïnteresseerd zijn in het gebruiken van de kaart component in hun eigen applicatie, kunnen beter de
[client developer guide & tutorial](../client-developer-guide-tutorial/0001-guidelines.md) raadplegen.

## Overzicht

### Opbouw

De source code van CK zit in 1 repository met een aantal modules
- De Angular library
- De demo applicatie
- Webcomponents (_gepland_)
- Andere

In dit document bespreken we vooral de Angular library.

### De componenten

### Componenten

We hebben twee grote categorieën van componenten:
1. componenten die de nodig zijn voor de werking van ng-kaart ongeacht af die aangestuurd wordt door de API of de `awv-kaart-classic` tag
2. componenten die dienen om ng-kaart aan te sturen op de traditionele Angularmanier mbv tags.

De eerste komen in directories onder `projects/ng-kaart/src/lib/kaart/<component>` en de naam begint met `Kaart`. 

De tweede soort komt in directories onder `projects/ng-kaart/src/lib/classic/<component>` en de naam begint met `Classic`.

We hebben dan bijv.:

```
projects
  ng-kaart
    src
      lib
        kaart
          schaal
            kaart-schaal.component.ts
            kaart-schaal.component.html
            kaart-schaal.component.scss
          ...
        classic
          lagenkiezer
            classic-lagenkiezer.component.ts
            classic-lagenkiezer.component.html
            classic-lagenkiezer.component.scss
          ...
        ...
      ...  
```

`kaart-schaal.component.ts` bevat `KaartSchaalComponent` en `classic-lagenkiezer.component` bevat `ClassicLagenkiezerComponent`.

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

De eerste categorie van componenten horen bij `KaartComponent` en de tag `awv-kaart` en de tweede categorie bij `KaartClassicComponent` en de tag `awv-kaart-classic`.
Het is een verbeterpunt om die twee soorten in afzonderlijke (Angular) projecten uit elkaar te trekken. Op dit moment moet je kijken naar de directory waaronder een component zit.

## Principes

### Openlayers

KC is een wrapper rond [Openlayers](https://openlayers.org/en/v4.6.5/apidoc/) (4.6). We probeeren enerzijds de gebruikers af te schermen van de complexiteit van het direct werken 
met Openlayers, maar anderzijds is het niet de bedoeling om de interface zodanig abstract te maken dat Openlayers vervangen zou kunnen worden door een andere bibliotheek, zoals MapBox, 
zonder impact op de gebruikende applicaties. Upgraden naar een volgende versie van Openlayers zou wel met een minimum aan inspanning van de afhankelijke applicaties mogelijk moeten zijn.

### Componentinteracties en API

KC heeft een dispatcher waar boodschappen naartoe gestuurd kunnen worden. Dit is een patroon dat onder andere gekend is van [React](https://reactjs.org). 

De resultaten van deze boodschappen kunnen zich enerzijds manifesteren in wat er op de kaart getoond wordt of hoe die interageert met de gebruiker of kunnen als gevolg hebben dat 
vervolgboodschappen uitgestuurd worden op een kanaal waar een client zich op kan registreren. Dit is anders dan in een pure reactive applicatie waar enkel het model geüpdatet wordt 
en clients het model observeren of aangeboden krijgen (samen met subscriptions).


De set van boodschappen die KC ondersteunt en uitstuurt noemen we de API van de KC.

### RxJS en reactive programming

Veel van de infrastructuur is opgebouwd op RxJS: boodschappen worden op een `Subject` gezet, synchrone en asynchrone antwoorden worden gelezen van een `Observable`. Ook componenten worden intern 
bij voorkeur grotendeels reactief gemaakt door te werken met RxJS.

### Angular

De vraag kan gesteld worden wat de rol van Angular nog is. Het antwoord is dat Angular op component- en het allerhoogste niveau nog steeds een substantieel onderdeel van CK is. Templates, components en
dependency injection spelen nog steeds een belangrijke rol. Wat niet traditioneel is, is hoe de componenten met elkaar communiceren. De interne communicatie gebeurt niet met lange kettingen van 
componenten die gegevens naar elkaar doorsassen mbv `@Input`s, `@Output`s, `@ViewChild`ren of services. Er wordt hoofdzakelijk beroep gedaan op basis van boodschappen die steeds op dezelfde manier
uitgestuurd worden en observables die steeeds op dezelfde manier aangevraagd kunnen worden.

Er is dus meer uniformiteit in de componenten, maar de keerzijde van de medaille is dat we niet kunnen terugvallen op best practices zoals die voor Angular bekend zijn. Het is de bedoeling
van dit document om dit probleem zo goed mogelijk te ondervangen.

## Interne werking

In deze sectie wordt ingegaan op de structuur van de KC. Niet op die van concrete functionaliteiten, maar hoe de functionaliteit in het algemeen opgebouwd wordt.

Er moet hierbij opgemerkt worden dat de KC reeds een zekere geschiedenis achter de rug heeft en waar eerst voor een bepaalde aanpak gekozen werd daarna, met groeiend inzicht, een 
andere manier de voorkeur gekregen heeft. Dat maakt dat in de soortgelijke problemen op meer dan 1 manier opgelost zijn. Het is ook de bedoeling van deze tekst om aan te geven welke
keuzes momenteel de voorkeur hebben.

### De reducer

De reducer is het hart van de werking van de KC. Het is een functie `kaartCmdReducer` in het bestand `kaart-reducer.ts`.

Het kernidee van de reducer is dat een boodschap een bestaande toestand omvormt tot een nieuwe toestand. Maw een functie `S -> M -> S`. 

In de praktijk is het echter net iets ingewikkelder. De signatuur is namelijk als volgt:

```typescript
export function kaartCmdReducer<Msg extends prt.KaartMsg>(
  cmd: prt.Command<Msg>
): (model: Model, modelChanger: ModelChanger, modelChanges: ModelChanges, msgConsumer: prt.MessageConsumer<Msg>) => ModelWithResult<Msg>
```

We leggen hieronder uit hoe we hiertoe gekomen zijn, maar is het belangrijk het kernidee in het achterhoofd te houden.

Ten eerste is `kaartCmdReducer` een (partieel) gecurriede functie. Het eerste argument is de boodschap en de volgende vormen de context van de reducer. De
context is in de praktijk vast.
- `model` is het onderliggende model wat gemuteerd wordt. Dit is in de loop der tijd onderschikt geworden aan de `ModelChanger`. Het model is wat door de reducer primair geüpdatet wordt.
- `modelChanger` is de 'opvolger' van `model` (verder meer).
- `modelChanges` is afgeleid (in meer dan één betekenis van het woord) van `modelChanges` en wordt gebruikt om de subscriptions mee te voeden.
- `msgConsumer` is een callback die gebruikt wordt bij het sturen van asynchrone boodschappen.

Het returntype van `kaartCmdReducer` is `ModelWithResult`. We hebben dus niet alleen een nieuwe model, maar ook een, synchroon, resultaat dat naar de afzender van de boodschap teruggestuurt
wordt. Het is het equivalent van het return type bij een functie die synchroon aangeroepen wordt zonder een messagingsysteem er tussen.

### Het model

`KaartWithInfo` was de eerste 'store' voor modelgegevens. Het bevat voormamelijk gegevens die ook in het Openlayers `map` object voorhanden zijn, maar daar niet eenvoudig en correct getypeerd
uit op te vragen zijn. Voorbeelden zijn:
- `toegevoegdeLagenOpTitel`: de lagen die toegevoegd zijn aan de kaart, maar met inbegrip van metadata zoals een titel, een legende en een stijl.
- `stdInteracties`: de Openlayers kaartinteracties (klikken, zoomen, roteren, e.d.)

### Messages, msgConsumers en Subscriptions

### ModelChanger en ModelChanges

#### InternalMessages

### Rol van `KaartComponent`

### Rol van `KaartClassicComponent`
