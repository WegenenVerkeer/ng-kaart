# Changelog

## Major 6.x

2019-09-23: aan en afzetten van progressbar, opvolgen progressbar, zie feature-demo bij configurator en straatkolken.

2019-10-15: toevoegen van tabel om details van features te tonen.

2019-11-13: identify functionaliteit nu in een eigen component

2019-11-18: formattering van de kolommen in de tabel adhv de types en eventueel ook displayFormat in
VeldInfo/lagen.json. Voor de formattering van nummers gebruiken we de functie en de formaten van Angular
(https://angular.io/api/common/DecimalPipe). Denk er ook ook om de locale (nl-BE) te enablen in app.module.ts. Voor
datumformattering gebruiken we Luxon (https://moment.github.io/luxon/docs/class/src/datetime.js~DateTime.html)
