#!/bin/bash

echo ""
echo ">>> Publish naar Nexus <<<"
echo ""
. $(dirname "$0")/_init.sh
cd $BASEDIR/dist
if [ ! -z $BAMBOO_AGENT_HOME ]; then
  npm publish --registry https://collab.mow.vlaanderen.be/artifacts/repository/npm-internal/
else
  echo "Lokaal kan je niet naar Nexus publishen, enkel Bamboo kan dat"
fi
