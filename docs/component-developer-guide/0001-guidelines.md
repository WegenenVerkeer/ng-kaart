# Component Developer Guide & Tutorial

Common Kaart is een Angular Library die ambieert om in te staan voor de afbeelding op kaart van alle GIS gegevens voor
alle toepassingen van het Agentschap voor Wegen en Verkeer. De bedoeling is dat alle AWV-applicaties geografische
gegevens op een uniforme manier weergeven én om efficiënt hergebruik van code mogelijk te maken.

## Doelpubliek

Dit document is bedoeld voor ontwikkelaars die werken aan de common kaart component (CK vanaf nu). Dat kan gaan om het
uitbreiden of verbeteren van bestaande componenten en hun interactie of het toevoegen van nieuwe componenten.

Ontwikkelaars die vooral geïnteresseerd zijn in het gebruiken van de kaart component in hun eigen applicatie, kunnen
beter de [client developer guide & tutorial](../client-developer-guide-tutorial/0001-guidelines.md) raadplegen.

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
1. componenten die de nodig zijn voor de werking van ng-kaart ongeacht af die aangestuurd wordt door de API of de
   `awv-kaart-classic` tag
2. componenten die dienen om ng-kaart aan te sturen op de traditionele Angularmanier mbv tags.

De eerste komen in directories onder `projects/ng-kaart/src/lib/kaart/<component>` en de naam begint met `Kaart`. 

De tweede soort komt in directories onder `projects/ng-kaart/src/lib/classic/<component>` en de naam begint met
`Classic`.

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

De eerste categorie van componenten horen bij `KaartComponent` en de tag `awv-kaart` en de tweede categorie bij
`KaartClassicComponent` en de tag `awv-kaart-classic`. Het is een verbeterpunt om die twee soorten in afzonderlijke
(Angular) projecten uit elkaar te trekken. Op dit moment moet je kijken naar de directory waaronder een component zit.

## Principes

### Openlayers

CK is een wrapper rond [Openlayers](https://openlayers.org/en/v4.6.5/apidoc/) (4.6). We probeeren enerzijds de
gebruikers af te schermen van de complexiteit van het direct werken met Openlayers, maar anderzijds is het niet de
bedoeling om de interface zodanig abstract te maken dat Openlayers vervangen zou kunnen worden door een andere
bibliotheek, zoals MapBox, zonder impact op de gebruikende applicaties. Upgraden naar een volgende versie van Openlayers
zou wel met een minimum aan inspanning van de afhankelijke applicaties mogelijk moeten zijn.

### Componentinteracties en API

CK heeft een dispatcher waar boodschappen naartoe gestuurd kunnen worden. Dit is een patroon dat onder andere gekend is
van [React](https://reactjs.org). 

De resultaten van deze boodschappen kunnen zich enerzijds manifesteren in wat er op de kaart getoond wordt of hoe die
interageert met de gebruiker of kunnen als gevolg hebben dat vervolgboodschappen uitgestuurd worden op een kanaal waar
een client zich op kan registreren. Dit is anders dan in een pure reactive applicatie waar enkel het model geüpdatet
wordt en clients het model observeren of aangeboden krijgen (samen met subscriptions).


De set van boodschappen die KC ondersteunt en uitstuurt noemen we de API van CK.

### RxJS en reactive programming

Veel van de infrastructuur is opgebouwd op RxJS: boodschappen worden op een `Subject` gezet, synchrone en asynchrone antwoorden worden gelezen van een `Observable`. Ook componenten worden intern 
bij voorkeur grotendeels reactief gemaakt door te werken met RxJS.

### Angular

De vraag kan gesteld worden wat de rol van Angular nog is. Het antwoord is dat Angular op component- en het allerhoogste
niveau nog steeds een substantieel onderdeel van CK is. Templates, components en dependency injection spelen nog steeds
een belangrijke rol. Wat niet traditioneel is, is hoe de componenten met elkaar communiceren. De interne communicatie
gebeurt niet met lange kettingen van componenten die gegevens naar elkaar doorsassen mbv `@Input`s, `@Output`s,
`@ViewChild`ren of services. Er wordt hoofdzakelijk beroep gedaan op basis van boodschappen die steeds op dezelfde
manier uitgestuurd worden en observables die steeeds op dezelfde manier aangevraagd kunnen worden.

Er is dus meer uniformiteit in de componenten, maar de keerzijde van de medaille is dat we niet kunnen terugvallen op
best practices zoals die voor Angular bekend zijn. Het is de bedoeling van dit document om dit probleem zo goed mogelijk
te ondervangen.

## Interne werking

In deze sectie wordt ingegaan op de structuur van CK. Niet op die van concrete functionaliteiten, maar hoe de
functionaliteit in het algemeen opgebouwd wordt.

Er moet hierbij opgemerkt worden dat CK reeds een zekere geschiedenis achter de rug heeft en waar eerst voor een
bepaalde aanpak gekozen werd daarna, met groeiend inzicht, een andere manier de voorkeur gekregen heeft. Dat maakt dat
in de soortgelijke problemen op meer dan 1 manier opgelost zijn. Het is ook de bedoeling van deze tekst om aan te geven
welke keuzes momenteel de voorkeur hebben.

### De reducer

De reducer is het hart van de werking van CK. Het is een functie `kaartCmdReducer` in het bestand `kaart-reducer.ts`.

Het kernidee van de reducer is dat een boodschap een bestaande toestand omvormt tot een nieuwe toestand. Maw een functie
`S -> M -> S` waarbij `S` staat voor een toestand en `M` voor een boodschap.

In de praktijk is het echter net iets ingewikkelder. De signatuur is namelijk als volgt:

```typescript
export function kaartCmdReducer<Msg extends prt.KaartMsg>(
  cmd: prt.Command<Msg>
): (model: Model, modelChanger: ModelChanger, modelChanges: ModelChanges, msgConsumer: prt.MessageConsumer<Msg>) => ModelWithResult<Msg>
```

We leggen hieronder uit hoe we hiertoe gekomen zijn, maar is het belangrijk het kernidee in het achterhoofd te houden.

Ten eerste is `kaartCmdReducer` een (partieel) gecurriede functie. Het eerste argument is de boodschap en de volgende
vormen de context van de reducer. De context is in de praktijk vast.
- `cmd` is de boodschap die ontvangen wordt.
- `model` is het onderliggende model wat gemuteerd wordt. Dit is in de loop der tijd onderschikt geworden aan de
  `ModelChanger`. Het model is wat door de reducer primair geüpdatet wordt.
- `modelChanger` is de 'opvolger' van `model` (verder meer).
- `modelChanges` is afgeleid (in meer dan één betekenis van het woord) van `modelChanges` en wordt gebruikt om de
  subscriptions mee te voeden.
- `msgConsumer` is een callback die gebruikt wordt bij het sturen van asynchrone boodschappen.

Het returntype van `kaartCmdReducer` is `ModelWithResult`. 

```typescript
export interface ModelWithResult<Msg> {
  readonly model: KaartWithInfo;
  readonly message: Option<Msg>;
}
```

We hebben dus niet alleen een nieuwe model, maar ook een optioneel, synchroon, resultaat dat naar de afzender van de
boodschap teruggestuurd wordt. Het is het equivalent van het return type bij een functie die synchroon aangeroepen wordt
zonder een messagingsysteem er tussen (`none` = `void`).

Gezien de reducer zorgt voor een reeks van observeerbare toestanden is het **niet** de bedoeling om side effects te
laten gebeuren in de reducerfuncties. Alle effecten moeten uitgevoerd worden in de componenten die het model observeren.
Een uitzondering wordt gemaakt voor aanpassingen van het Openlayers `map` object. Gezien de rijke structuur en het
complexe gedrag van dat object is het bijhouden van een object die de toestand van `map` spiegelt een tijdrovende en
foutgevoelige bezigheid die bovendien gezien we niet van plan zijn om Openlayers te vervangen door een andere
kaartimplementatie weinig toegevoegde waarde biedt (en al zeker niet omdat we helemaal niet test-driven werken).

Er moet ook over gewaakt worden dat een invocatie van de reducer functie niet te lang duurt. We mogen er met andere
woorden niet in blokkeren. Dit is immers de kern van de event loop van CK. Als de reducefunctie te veel tijd neemt,
zal de gebruiker dit ervaren als een niet-responsieve applicatie.

Evenzeer moet er gelet worden op het alloceren van resources. Wanneer dat gebeurt, moet er een mechanisme zijn om die
resources ook vrij te geven. Een voorbeeld zijn de subscriptions waar componenten zich kunnen op inschrijven.
Componenten moeten zijn ook kunnen onregistreren.

### Het model

`KaartWithInfo` was de eerste 'store' voor modelgegevens. Het bevat voormamelijk gegevens die ook in het Openlayers
`map` object voorhanden zijn, maar daar niet eenvoudig of correct getypeerd uit op te vragen zijn. 

Voorbeelden zijn:
- `toegevoegdeLagenOpTitel`: de lagen die toegevoegd zijn aan de kaart, maar met inbegrip van metadata zoals een titel,
  een legende en een stijl.
- `stdInteracties`: de Openlayers kaartinteracties (klikken, zoomen, roteren, e.d.)

Een andere categorie van members zijn collecties die achter de schermen door Openlayers bijgewerkt worden. Een voorbeeld
van dit type is `geselecteerdeFeatures`. Het is niet de bedoeling dat componenten rechtstreeks met deze collecties
werken, maar dat ze een subscription opzetten die hen verwittigt van wijzingen aan de inhoud van de collecties. Achteraf
gezien hadden we het model kunnen splitsen in een publiek gedeelte en een privaat gedeelte. Dat is dus nog een
verbeterpunt.

Tenslotte zijn er nog een aantal RxJs `Subscription`s die gebruikt worden als bronnen om subscriptions van boodschappen
mee op te bouwen. Dit betreft oudere code. In nieuwere code wordt hiervoor de combo `ModelChanger`/`ModelChanges`
gebruikt.

### Messages, msgConsumers

Wanneer een component een actie waarneemt die een effect heeft buiten de component zelf, dan stuurt die een boodschap
naar de reducer. Een typisch voorbeeld is de zoomcomponent. Wanneer een gebruiker bijvoorbeeld op de `+` drukt, dan
wordt een `VeranderZoomCmd` uitgestuurd.

```typescript
export interface VeranderZoomCmd<Msg extends KaartMsg> {
  readonly type: "VeranderZoom";
  readonly zoom: number;
  readonly wrapper: BareValidationWrapper<Msg>;
}
```

Naast het nieuwe zoomniveau zien we ook een `wrapper` veld. Het doel van dit veld is om feedback te geven aan de
component die de boodschap uitstuurt. De `BareValidationWrapper` is essentieel een functie die een
`Validation<string[], undefined>` ontvangt en die verpakt (vandaar de naam) in een `Msg`. Het is dit object dat in het
`message` veld van `ModelWithResult` geplaatst wordt.

Deze indirectie is nodig omdat meerdere componenten dezelfde boodschappen kunnen sturen en we de reducer zeker niet
afhankelijk willen maken van één afzender van boodschappen. Wanneer een boodschap met een wrapper door de reducer
verwerkt wordt, dan zal de reducer de wrapper functie uitvoeren en het `Msg` resultaat teruggeven. Later zal dit
resultaat uit een subscription waar de component op luistert te voorschijn komen. De component die de oorspronkelijke
booschap stuurt controleert de wrapper en dus ook het type van de `Msg`. De component kan er dus voor zorgen dat hij die
antwoordboodschap kan onderscheiden van alle andere antwoordboodschappen.

Dit mechanisme laat toe dat een component kan te weten komen dat de booschap die hij uitgestuurd heeft verworpen was en
voor welke reden. Het is evenwel zo dat in de praktijk gebleken is dat veel componenten "slim" genoeg zijn om
boodschappen te sturen die altijd correct zijn of dat hij geen effectieve acties kan ondernemen wanneer het resultaat
toch negatief zou zijn. Daarom hebben veel latere boodschappen geen `wrapper` veldje meer.

De boodschappen die uit de `wrapper` functies komen zijn het equivalent van synchrone returnwaarden van functies. Omdat
die functies geen excepties mogen opgooien, zijn de resultaten altijd verpakt in een `Validation`.

Het is **niet** de bedoeling om side effects uit te voeren tijdens de uitvoering van de `wrapper` functie. De enige
uitzondering is logging. Daarvoor is er de `kaartLogOnlyWrapper`.

Merk op dat in de code er afkortingen als `Msg`, `Cmd` en `Evt` gebruikt worden. Het is echter verkeerd om te denken aan
een event-sourcing systeem. Het is niet zo dat er commandos gestuurd kunnen worden die ofwel verworpen kunnen worden of
aanleiding geven tot één of meer events. Je kan wel zeggen dat sommige booschappen eerder opdrachten zijn en andere
eerdere gebeurtenissen, maar op het typeniveau zijn deze niet van elkaar te onderscheiden. Het is dus best om `Msg`,
`Cmd` en `Evt` als synoniemen te zien. Opnieuw een geval van voortschrijdend inzicht.

#### Subscriptions

Naast synchrone antwoorden op boodschappen (bijvoorbeeld: "Is mijn commando geslaagd?") ondersteunt CK ook asynchrone
gebeurtenissen (bijvoorbeeld "Op welke kaartlocatie heeft de gebruiker geklikt?"). Daarvoor is er het concept van
subscriptions.

#### InternalMessages & KaartClassicMessages

### ModelChanger en ModelChanges

### Rol van `KaartComponent`

### Rol van `KaartClassicComponent`
