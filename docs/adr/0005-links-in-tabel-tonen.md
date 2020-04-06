# 5. Links in tabel tonen

Date: 15/03/2020

## Status

Accepted

## Context

URL's worden gestyled zodat deze clickable zijn in het Identify paneel. We willen graag dat ze ook bruikbaar zijn in de tabel. 
Uit de lagen.json heb ik afgeleid dat sommige van deze links veldtype URL hebben en andere veldtype String. 
We willen deze URL's graag op dynamische wijze tonen in de tabel (niet gewoon de URL zelf, maar ook niet telkens gewoon LINK).

Een groot deel kan getoond worden op basis van de waarde in een ander veld bv dossiernummer bij AV.
Voor andere lagen mag er een vaste string getoond worden.
En voor sommige lagen een combinatie van 2 velden als label.

## Decision

Momenteel detecteren we links automatisch door naar de start van de string of naar veldtype te kijken. Als het met http of https begint of 
veldtype 'url' heeft beelden we het af als een link.

We houden voor de tabel vanaf nu rekening met 'html' veld. Indien ingevuld, dan gebruiken we de inhoud van dat html veld om de weergave af te beelden. 
We staan toe dat er tokens instaan om bepaalde velden dynamisch 
in te vullen. Bvb: 

{ "isBasisVeld": true, "label": "Rapport", "naam": "rapport_url_1", "veldType": "url", "html": "{{periode_1_begin}} - {{periode_1_einde}}" },

Indien 'html' leeg is, nemen we de waarde in 'label'.
 
Met het veld "constante" moet ook rekening gehouden worden, dat moet soms genomen worden ipv de waarde van het veld. Bvb:

  { 
  "isBasisVeld": true, 
  "label": "Open in Werf", 
  "naam": "externeurl", 
  "veldType": "string", 
  "html": "{werfid}", 
  "constante": "https://{domain.name}/werf/schermen/werf/{werfid};werf=werf%2Fapi%2Fwerf%2F{werfid}" 
  },
