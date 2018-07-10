#!/bin/bash

echo ""
echo ">>> Loop acceptatie testen <<<"
echo ""
. $(dirname "$0")/_init.sh
EXIT_STATUS=0 # standaard gaan we uit van een feilloze werking

echo "run e2e"
cd $BASEDIR || exit
npm run e2e || EXIT_STATUS=$?

echo "Exit status na het runnen van de testen is " $EXIT_STATUS

if [ $EXIT_STATUS != 0 ]; then
  echo
  echo ">>> Er zijn gefaalde acceptatie testen <<<"
  echo
fi

exit $EXIT_STATUS
