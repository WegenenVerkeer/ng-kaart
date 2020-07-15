#!/bin/bash

echo ""
echo ">>> Bouw release candidate <<<"
echo ""
. $(dirname "$0")/_init.sh
EXIT_STATUS=0 # standaard gaan we uit van een feilloze werking

$BASEDIR/bin/zet-versie.sh

echo "bouw ng-kaart"
cd $BASEDIR || exit
npm run build-prod
