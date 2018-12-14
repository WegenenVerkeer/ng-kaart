# 1. Record architecture decisions

Date: 14/12/2018

## Status

Draft

## Context

Geoloket 2 is een Single Page Application waarbij het voornaamste deel van de gegevens die getoond worden, de laagdata, van externe servers komen.

De taak van de Geoloket 2 backend is vooral het opslaan van de configuratie van kaarten en lagen en bepalen wie welke kaarten en lagen mag raadplegen.

Geoloket 2 wordt gradueel ontwikkeld waarbij frequente wijzingen aan de datastructuren die gepersisteerd moeten worden te verwachten zijn.

Gezien quasi de totaliteit van de logica zich in de web UI bevindt, hoeft de backend geen businessregels af te dwingen. De backend heeft dus ook geen nood aan de specifieke kennis van datastructuren van de UI.

De standaard architectuur van AWV legt het gebruik van Postgresql als de persistentiebackend op.

## Decision

We gebruiken verschillende tabellen voor bijv. lagen en stijlen. De beschrijving van hun specifieke configuratie echter wordt als een JSON blob opgeslagen in Postgresql.

Verbanden tussen entiteiten kunnen zowel in JSON als via traditionele relationele wegen (Foreign keys, tussentabellen) opgeslagen worden.

## Consequences

De Scala backend is maar een dunne laag die een REST api aanbiedt boven de database. De voornaamste taake is de de gepaste gegevens met elkaar verbinden.

We moeten er op letten dat er geen discrepanties optreden tussen verwijzingen als JSON-attributen en als foreign keys.
