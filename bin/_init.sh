#!/bin/bash
#
# Source dit script in elk afzonderlijk script, zodat de noodzakelijke variabelen/tooling beschikbaar zijn.

# Bepaal de BASEDIR
export BASEDIR
BASEDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"; cd ..; pwd)"
echo BASEDIR is $BASEDIR
echo

# laad settings in
SAVE=$(set +o)
set -o allexport
. $BASEDIR/bin/_settings.sh
eval "$SAVE"

# Brouw een versie nummer
export VERSION
if [ ! -z $BAMBOO_AGENT_HOME ]; then
  BUILD_NUMBER=.${bamboo_buildNumber}
else
  BUILD_NUMBER=.0-SNAPSHOT
fi
VERSION="$(cat $BASEDIR/VERSION)${BUILD_NUMBER}"
echo VERSION is $VERSION
echo

# Laad tooling in
if [ ! -z $BAMBOO_AGENT_HOME ]; then
  . $BASEDIR/bin/_init_bamboo_tooling.sh
else
  . $BASEDIR/bin/_init_local_tooling.sh
fi
echo

# Notify functie
function notify() {
  MESSAGE=$1

  if [ -z "$MESSAGE" ]; then
    echo "Geef een bericht op om weer te geven als notification."
    exit 1
  fi

  if [ `which notify-send` ]; then # ubuntu
    notify-send "$MESSAGE"
  fi

  if [ `which terminal-notifier` ]; then # osx, brew install terminal-notifier
    terminal-notifier -title "$NAAM" -message "$MESSAGE"
  elif [[ $OSTYPE == "darwin"* ]]; then # osx, geen terminal notifier
    echo "Bericht ontvangen om weer te geven in Notification Center:"
    echo "-- $MESSAGE --"
    echo "Installeer terminal-notifier om deze in het vervolg in Notification Center te ontvangen: brew install terminal-notifier"
  fi

  if [ ! -z $BAMBOO_AGENT_HOME ]; then
    curl -X "POST" "https://api.hipchat.com/v2/room/265297/notification?auth_token=znWGOwp4hb5PoswejaRMt5k2l9JkAeNK0Me2ink5" \
    	-H "Content-Type: application/json" \
    	-d "{\"message\":\"$MESSAGE\",\"message_format\":\"text\",\"from\":\"$NAAM (Bamboo)\",\"color\":\"gray\"}"
  fi
}
