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

De eerste categorie noemen we de "interne componenten" en de tweede de "classic componenten".

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

Oorspronkelijk was het zo dat componenten een stream van het model kregen. Met behulp van `map` en
`distinctUntilChanged` konden we dan reageren om aanpassingen in het model. Deze aanpak was functioneel gezond, maar
niet erg efficiënt. Naarmate het model uitegebreider werd en er meer bewerkingen op gebeurden, was de fractie van
wijzigingen die een component aanbelangden kleiner en kleiner. Terwijl er toch altijd een vork in stream voor nodig was.
Daarom zijn we al vrij vroeg overgestapt naar Observables van specifieke eigenschappen. Dat heeft wel als nadeel dat de
reducer elke wijziging aan het model moet melden aan het gepaste Subject (de generator van een Observable).

### Boodschappen

#### Opdrachtboodschappen

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

#### Feedbackboodschappen

Naast synchrone antwoorden op boodschappen (bijvoorbeeld: "Is mijn commando geslaagd?") ondersteunt CK ook asynchrone
gebeurtenissen (bijvoorbeeld "Op welke kaartlocatie heeft de gebruiker geklikt?"). Daarvoor is er het concept van
subscriptions.

Een component stuurt een boodschap dat het een subscription wil op een of ander event. Een subscription boodschap
bestaat er twee delen. Enerzijds is er het `SubscribeCmd`.

```typescript
export interface SubscribeCmd<Msg extends KaartMsg> {
  readonly type: "Subscription";
  readonly subscription: Subscription<Msg>;
  readonly wrapper: ValidationWrapper<SubscriptionResult, Msg>;
}
```

Het `SubscribeCmd` is voor alle subscriptions hetzelfde en geeft op welke specifieke subscription er aangemaakt moet
worden en hoe het resultaat terug moet komen. Het resultaat bevat een `SubscriptionResult` (in een `Validation` voor het
geval de subscription niet mogelijk zou zijn). Dit is een object dat gebruikt kan worden om zich van de subscription uit
te schrijven met behulp van het `UnsubscribeCmd` (verplicht ten laatste wanneer de component beïndigd wordt).

Het `subscription` veld is afhankelijk van wat de aanroeper wil volgen. Met de `MiddelpuntSubscription`
bijvoorbeeld, zal de component er van verwittigd worden dat de kaart verschoven is.

```typescript
export interface MiddelpuntSubscription<Msg> {
  readonly type: "Middelpunt";
  readonly wrapper: MsgGen<ol.Coordinate, Msg>;
}
```

Een subscription boodschap heeft altijd een `wrapper` veld. In dit geval zal de wrapper geen `ValidationWrapper` zijn
omdat er geen asynchrone excepties kunnen gebeuren (fouten kunnen desgevallend in een regulier veld of specifieke
boodschap gestoken worden).

Gezien subscriber de wrapper functie aanlevert, kan die er voor zorgen dat die functie een antwoord genereert dat hij
kan herkennen als voor hem bestemd. Er kunnen, en dat is ook zo in de praktijk, veel verschillende geïnteresseerden zijn
voor dezelfde subscription.

Omdat subscription ook vrijgegeven moet worden is er een Observable operator `subscriptionCmdOperator` die een array van
`Subscription`s kan registreren en deregistreren.

#### De eventbus

Het is al verschillende keren aangehaald hiervoor: antwoorden op opdrachtboodschappen en gebeurtenissen in subscriptions
komen uiteindelijk bij een component terecht. Dat gebeurt niet op dezeffde manier als opdrachtboodschappen bij de
reducer terechtkomen. Er is immers maar één reducer en er zijn veel componenten.

De reducer stuurt alles terug via hetzelfde kanaal. We kunnen dat kanaal dus zien als een eventbus. Wie geïnteresseerd
is in specifieke informatie filtert de objecten op de eventbus op basis van hun `type` veld.

Het `type` veld is dus dé manier voor ontvangers om antwoorden van elkaar te onderscheiden. De wrapper functies zullen
dus objecten met een voor hen herkenbare wwarde voor `type` aanmaken.

#### Protocol messages

Er is eigenlijk maar 1 vereiste voor opdrachtboodschappen en dat is dat ze een `type` veld hebben. We maken daarbij gebruik van structural typing: de boodschappen hoeven dus niet van een gemeenschappelijke interface of klasse af te leiden.

```typescript
export interface TypedRecord {
  type: string;
}
```

#### InternalMessages & KaartClassicMessages

Zowel boodschappen als subscriptions hebben als gevolg dat er informatie terug vloeit naar de componenten. Het zijn
echter niet alleen de componenten in de CK bibliotheek die boodschappen kunnen sturen en informatie terugkrijgen. Ook
externe gebruikers (Geoloket2 bijvoorbeeld) kunnen dat. En ze doen dat via exact hetzelfde mechanisme. Ze gebruiken
potentieel dezelfde boodschappen en dezelfde subscriptions. We willen echter niet dat de externe gebruikers de interne
boodschappen te zien krijgen. Zowel om redenen van performantie als encapsulatie.

Om de interne boodschappen tegen te houden, filteren we die weg. A priori zou dit niet zomaar gaan omdat de componenten
in hun wrappers om het even welke `type` waarden kunnen genereren. Daarom zorgen we ervoor dat wrappers van interne
componenten boodschappen met als `type` waarde `"KaartInternal"` aanmaken. Het typescript type dat hiermee overeenkomt
is `KaartInternalMsg`.

```typescript
export interface KaartInternalMsg {
  readonly type: "KaartInternal";
  readonly payload: Option<KaartInternalSubMsg>;
}
```
Code in `KaartComponent` filtert eerst op `"KaartInternal"` en biedt de interne componenten dan een Observable van
`KaartInternalSubMsg` aan. Die kunnen dan filteren op het `type` veld van `KaartInternalSubMsg` om hun eigen
boodschappen er uit te pikken.

Iets analoog gebeurt voor de classic componenten. Die hun wrappers maken `KaartClassicMsg`s.

```typescript
export interface KaartClassicMsg {
  readonly type: "KaartClassic";
  readonly payload: KaartClassicSubMsg;
}
```

`KaartClassicComponent` beperkt de stream van algemene boodschappen tot die van het type `"KaartClassic"` en houdt er de
`KaartClassicSubMsg` payload van over. Net zoals `KaartInternalSubMsg` is `KaartClassicSubMsg` een union type.

### ModelChanger en ModelChanges

Het systeem met `SubscribeCmd` en terugvloeiende componentspecifieke boodschappen werkt conceptueel heel goed. Alleen is
het zo dat er nogal wat boilerplate code voor nodig is terwijl het doorgaans niet nodig is dat verschillende componenten
dezelfde informatie in hun eigen gewrapte object krijgen.

Daarom is er ook een modernere manier van werken voor de interne componenten. De KaartComponent, die alle interne
componenten bevat, biedt ook een `modelChanges` object aan. Dit object bevat een uitgebreide verzameling observables die
elke een waarde opleveren wanneer een specifiek gedeelte van het model aangepast wordt. 

Het is taak van de reducer om telkens wanneer die een aanpassing maakt aan het conceptuele model dat te melden via de
gepaste Subject in de `modelChanger`. De `modelChanger` is het duale van de `modelChanges`. De ene is de schrijfzijde en
de andere de leeszijde. Dit verlegt een stuk extra werk naar de reducer maar minder dan uitgespaard wordt in de interne
componenten.

Er wordt gesproken van het *conceptuele* model. Wat hiermee bedoeld wordt, is dat sommige eigenschappen die via
`modelChanges` verspreid worden niet noodzakelijk ook expliciet opgenomen hoeven te zijn in `KaartWithInfo`. Als de
reducer geen nood heeft aan de actuele toestand, dan hoeft die ook niet bijgehouden te worden. En zelfs wanneer dat wel
zo is, dan kan nog steeds een `BehaviorSubject` in `modelChanges` gebruikt worden.

### Rol van `KaartComponent`

De `KaartComponent` is de centrale component van CK. Het is deze die de `kaartCmdReducer` functie aanroept. Het is ook
de DOM container voor het Openlayers `map` object. Verder zijn alle componenten, op de Classic componenten na, child
components van `KaartComponent`.

Applicaties die op laag niveau gebruik maken van CK zien alleen `KaartComponent`. Ze injecteren twee belangrijke velden:
1. `kaartCmd$`: de observable waarmee ze opdrachtboodschappen naar de KaartComponent zenden
2. `messageObsConsumer`: een functie die een Observable van `KaartMsg` krijgt. `KaartComponent` zet hiermee de
   Observable die feedbackboodschappen ontvangt.

#### De `KaartCmdDispatcher`

Boodschappen worden niet direct op een Subject gezet. Er wordt gebruik gemaakt van een intermediaire abstractie de
`KaartCmdDispatcher`.

```typescript
export interface KaartCmdDispatcher<Msg extends TypedRecord> {
  dispatch(cmd: prt.Command<Msg>): void;
}
```

De reden is tweeërlei.
1. Doordat we gebruik maken van `dispatch` zijn clients niet gebonden aan een Subject. We hebben dus extra vrijheid voor
   refactoren of testen.
2. We mogen niet zomaar `next` uitvoeren op een Subject. Als we dat wel doen, dan zou die boodschap verwerkt worden
   vooraleer de huidige functie gedan is, met corruptie van de state tot gevolg. Daarom moeten we een andere scheduler
   gebruiken. Die wordt afgedwongen door het gebruik van `dispatch`.


### Rol van `KaartClassicComponent`

Er is een groot gamma aan boodschappen die door `KaartComponent` verwerkt kunnen worden en de communicatie gebeurt door
middel van Observables. Dat wordt door veel projecten als een te hoge drempel gezien. Daarom zijn er ook wrappers voor
veel van de boodschappen. Niet noodzakelijk voor allemaal, want sommige worden enkel door Geoloket2 gebruikt.

`KaartClassicComponent` is dus een component met een template die `awv-kaart-component`, de tag voor `KaartComponent`,
bevat. Het injecteert dus zijn eigen observable van opdrachtboodschappen en een callbackfunctie die het een Observable
van feedbackboodschappen oplevert.

Geen van de child components van `KaartClassicComponent` heeft eigen templates. Het enige wat ze doen is:
1. Al dan niet op basis van `@Input`s boodschappen versturen naar `KaartComponent`
2. Luisteren op Subscriptions en de resultaten, eventueel getransformeerd, via `@Output`s aanbieden.

Het versturen van boodschappen gaat, uiteraard, via de de `ReplaySubjectKaartCmdDispatcher` die als dispatcher op
`KaartComponent` gezet is.
