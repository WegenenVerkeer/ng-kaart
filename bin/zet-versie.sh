#!/bin/bash
set -e
. $(dirname "$0")/_init.sh

echo "$NAAM rollen naar ${VERSION}..."

cd ${BASEDIR}
npm version ${VERSION}

cd ${BASEDIR}/projects/ng-kaart
npm version ${VERSION}

echo "done"
