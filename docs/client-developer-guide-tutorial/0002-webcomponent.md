# Gebruik van de webcomponent classic kaart

We gebruiken een automatisch framework om onze Angular components te exposen voor gebruik als een webcomponent.

Dit heeft als voordeel dat de meeste input/output automatisch wordt omgevormd en dat de standaard gegenereerde documentatie eenvoudig gebruikt kan worden om te developen met de webcomponent/

Er zijn enkele regels om te volgen.

## Voorbeeld

```html
  <awv-kaart-element id="k1" zoom="2">
    <awv-kaart-lagenkiezer verwijderbare-lagen="true" verplaatsbare-lagen="true" toon-legende="true"></awv-kaart-lagenkiezer>
    <awv-kaart-tilecache-laag titel="Dienstkaart grijs" laag-naam="dienstkaart-grijs"></awv-kaart-tilecache-laag>
    <awv-kaart-ortho-laag titel="Ortho" groep="Achtergrond"></awv-kaart-ortho-laag>
    <awv-kaart-standaard-interacties focus-voor-zoom="true"></awv-kaart-standaard-interacties>
    <awv-meet-knop toon-info-boodschap="true"></awv-meet-knop>

    <awv-kaart-geoserver-laag titel="Referentiepunten 3" laag-naam="referentiepunten" versie="1.1.1" min-zoom="6">
      <awv-legende-lijn-item beschrijving="Referentiepunten 3 (lijn)" kleur="yellow"></awv-legende-lijn-item>
      <awv-legende-polygoon-item beschrijving="Referentiepunten 3 (polygoon)" kleur="green"></awv-legende-polygoon-item>
    </awv-kaart-geoserver-laag>

    <awv-kaart-wmts-laag titel="GRB" laag-naam="grb_bsk" urls='["https://tile.informatievlaanderen.be/ws/raadpleegdiensten/wmts"]'
      extent="[ 9928, 66928, 272072, 329072 ]" origin="[ 9928, 329072 ]"
      matrix-set="BPL72VL" matrix-ids='[ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15" ]'>
    </awv-kaart-wmts-laag>

    <awv-kaart-zoomknoppen></awv-kaart-zoomknoppen>
    <awv-kaart-streetview></awv-kaart-streetview>
    <awv-kaart-schaal></awv-kaart-schaal>
    <awv-kaart-voorwaarden titel="AWV voorwaarden"></awv-kaart-voorwaarden>
    <awv-kaart-copyright copyright="BoeBoe"></awv-kaart-copyright>

    <awv-kaart-zoeker>
    </awv-kaart-zoeker>

    <awv-kaart-knop-achtergrondlaag-kiezer></awv-kaart-knop-achtergrondlaag-kiezer>
  </awv-kaart-element>
```

## Inputs

Iedere input van de component komt overeen met een tag. De naam van de tag wordt omgezet naar [kebab-case](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles).

Een voorbeeld: in de `ClassicLagenkiezerComponent` is er een input met de naam `verwijderbareLagen`. Als je dit wilt zetten in html, gebruik je:

```html
<awv-kaart-lagenkiezer verwijderbare-lagen="true"></awv-kaart-lagenkiezer>
```

### Complexe inputs

De meeste inputs zijn vrij simpel: strings, booleans, numbers. Er zijn echter ook een aantal complexere inputs die niet uitgedrukt kunnen worden in simpele HTML.

In die gevallen (wanneer het mogelijk is), gebruiken we de JSON voorstelling van het complexe type.

Een voorbeeld: in de `ClassicWmtsLaagComponent` is er een input met de naam `urls`. Dit is van het type `string[]`. Dat kunnen we op volgende manier doorgeven:

```html
<awv-kaart-wmts-laag ... urls='["https://tile.informatievlaanderen.be/ws/raadpleegdiensten/wmts"]' ... >
</awv-kaart-wmts-laag>
```

:warning: **JSON verwacht dubbele quotes (") rond property-namen en -waardes. In plaats van quotes te nesten, kan je heel de attribuut waarde met enkele quotes (') omringen, zoals in bovenstaand voorbeeld.**

## Outputs