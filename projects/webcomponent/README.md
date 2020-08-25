# ng-kaart webcomponent

## Algemeen

* webcomponent: is de wrapper en de demo in angular context.
* webcomponentdemo: is de puur html/js (dus zonder angular) demo van de webcomponent. Zie readme in /webcomponentdemo om die te testen

Builden via npm run build:elements (om dist/webcomponent/ng-kaart-webcomponent.js aan te maken)

Start via 

docker-compose -f docker-compose-tunnel.yml 
npm run start-wc-apigateway

## Publishen naar npm

Eerst:  
    npm adduser --registry=https://registry.npmjs.org/

Dan:
    
    npm run build
    npm run build:elements
    npm run publishToNpmjs
    cd dist/webcomponent/
    npm publish --public
