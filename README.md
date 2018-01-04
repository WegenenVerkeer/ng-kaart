# AWV commons angular

[![Build Status](https://travis-ci.org/WegenenVerkeer/ng-kaart.svg?branch=master)](https://travis-ci.org/WegenenVerkeer/ng-kaart)

Angular kaart component gebaseerd op open layers voor gebruik bij AWV.

## Waar te vinden?

Deze component is gepubliceerd als `@wegenenverkeer/ng-kaart` op [NPM](https://www.npmjs.com/package/@wegenenverkeer/ng-kaart).

## Hoe werkt het?

Dit project ambieert de implementatie van Angular Package Format v4.0.

Er is nog geen support voor een dergelijke packaging in Angular-CLI. We baseren ons op [https://github.com/filipesilva/angular-quickstart-lib]()

## Beperkingen

Deze component is enkel ontwikkeld om gebruikt te worden op Google Chrome. Om in Firefox te werken bijvoorbeeld zijn een aantal shims nodig. Zie ook de openlayers website. 

## Development

Deze component is gebaseerd op de source code van de kaartcomponent gebruikt door district center. 
Nog niet alle features van de oorspronkelijke component zijn geïmplementeerd. Gelieve voor noodzakelijke features een featurerequest in github aan te maken.

### Code testen

Deze component library is voorzien van een test Angular app.

    npm start
    
Deze is dan te bereiken via http://localhost:4220/

In `src\testApp` kan je je module toevoegen en op de pagina plaatsen om zo door te testen. 

Dit laat je ook toe om protractors te schrijven.

Tot slot vormt de source code van deze pagina de gebruiksaanwijzing van de componenten.

### Locatie zoeker testen

*Dit is nog niet getest sinds de refactoring*

Dit doet CORS requests via een SSH tunnel:

* Leg een SSH tunnel naar de apigateway van dev:

        ssh -L 5100:apigateway.dev.awv.internal:80 management.apps.mow.vlaanderen.be
                          
* Zet chrome open zonder web security om dit te testen.

    macos:
    
        open -a Google\ Chrome --args --disable-web-security --user-data-dir 
        
    *nix:
    
        chromium-browser --disable-web-security --user-data-dir

### Code style

De code style wordt automatisch afgedwongen via tslint + prettier. Deze is ingesteld dat de code wordt herschreven on commit, tenzij er brekende wijzigingen zijn (zoals foute typering en dergelijke meer).

## Publish

We gebruiken [travis-ci](https://travis-ci.org/WegenenVerkeer/ng-kaart) als CI tool

# Resources

* [Angular Package Format v4.0](https://goo.gl/AMOU5G)
* [NGConf 2017 presentatie](https://www.youtube.com/watch?v=unICbsPGFIA)

* [https://github.com/jasonaden/simple-ui-lib]()
* [https://github.com/filipesilva/angular-quickstart-lib]()

