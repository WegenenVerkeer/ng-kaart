#!/bin/bash
#
# !!! Source dit script niet rechtstreeks, source _init.sh !!!
#

function addCommandToPath() {
  if [ -z "$1" ]; then
    echo "Geef een commando op om aan het pad toe te voegen."
    exit 1
  fi

  COMMAND_PATH=$(dirname $1)

  if [ "$COMMAND_PATH" = "/usr/bin" ] || [ "$COMMAND_PATH" = "/usr/local/bin" ]; then
    echo "$COMMAND_PATH zit al in het pad."
  else
    export PATH=$COMMAND_PATH:$PATH
  fi
}

echo "== NODEJS =="
if ! [ -z $bamboo_capability_system_builder_node_Node_js_8 ]; then
  echo "We gebruiken de NodeJS capability van Bamboo: $bamboo_capability_system_builder_node_Node_js_8"
  addCommandToPath $bamboo_capability_system_builder_node_Node_js_8
  echo Node "$(node --version)"
  echo NPM "$(npm --version)"
else
  echo "Issue met NodeJS capability van Bamboo"
fi
echo
