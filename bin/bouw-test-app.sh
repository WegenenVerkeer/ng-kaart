#!/bin/bash

echo ""
echo ">>> Bouw test app <<<"
echo ""
. $(dirname "$0")/_init.sh
EXIT_STATUS=0 # standaard gaan we uit van een feilloze werking

echo "bouw ng-kaart test app"
cd $BASEDIR || exit
npm run build-test-app
