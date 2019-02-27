// tslint:disable:max-line-length
export const vrijAdres = `Voer het adres in in het zoekveld. 

De zoekmachine zoekt zowel via de <a href="https://overheid.vlaanderen.be/informatie-vlaanderen/producten-diensten/centraal-referentieadressenbestand-crab">CRAB</a> als Google diensten. `;

export const identPlusRefpunt = `Voer de ident2 of ident8 in in het zoekveld om de volledige weg te vinden. Als je referentiepunt en optioneel de afstand tot het referentiepunt meegeeft, krijg je de exacte locatie naast de weg.
<p>
Voorbeelden:
<ul>
  <li><pre>R1</pre>
    <ul>
      <li>zoek de weg met ident8 R0010001</li>
    </ul>
  </li>
  <li><pre>A0141911 12.0</pre>
    <ul>
      <li>zoek op de A0141911 het referentiepunt 12.0</li>
    </ul>
  </li>
  <li><pre>N8 12.0-8</pre>
    <ul>
      <li>zoek op de N8 het punt op afstand -8 van refpunt 12.0​​​​​​​</li>
    </ul>
  </li>
</ul>
</p>`;

export const identPlusHuisnummer = `Om te zoeken op een huisnummer naast een ident2 of ident8 is het verplicht om ook een gemeente mee te geven
<p>
Voorbeeld:
<ul>
  <li><pre>N8 178 Kortrijk</pre>
    <ul>
      <li>zoek op de N0080001 in Kortrijk huisnummer 178</li>
    </ul>
  </li>
</ul>
</p>`;

export const eNummer = `Voer de Europese wegnummer in in het zoekveld om de volledige weg te vinden. Als je referentiepunt en optioneel de afstand tot het referentiepunt meegeeft, krijg je de exacte locatie naast de weg.
<p>
Voorbeeld:
<ul>
  <li><pre>E17 5.0+18</pre>
    <ul>
      <li>zoek op de E17 het punt met afstand +18m t.o.v. referentiepunt 5.0</li>
    </ul>
  </li>
</ul>
</p>`;

export const poi = `Via het zoekveld kan ook gezocht worden op de locatie van een point of interest, zoals bijvoorbeeld een restaurant, ziekenhuis of café. De resultaten hiervan komen uit de Google Places services.`;

export const emInstallatie = `In het vrij zoekveld kan gezocht worden op de locatie van een EM-installatie door (een deel van) het naampad in te voeren, voorafgegaand door "em".
      
De resultaten komen uit de applicatie EMInfra.
<p>
Voorbeeld:
<ul>
  <li><pre>em G1586/WV</pre>
    <ul>
      <li>zoek het EM onderdeel met 'G1586/WV' in het naampad</li>
    </ul>
  </li>
</ul>
</p>`;

export const kunstwerk = `In het vrij zoekveld kan gezocht worden op de locatie van een brug of tunnel door (een deel van) de id in te voeren, voorafgegaand door "kw".

De resultaten komen uit de applicatie Bryggja.
<p>
Voorbeeld:
<ul>
  <li><pre>kw 0.010.031.1</pre>
    <ul>
      <li>zoek het kunstwerk met Bryggja id '0.010.031.1'</li>
    </ul>
  </li>
</ul>
</p>`;

// tslint:enable:max-line-length
