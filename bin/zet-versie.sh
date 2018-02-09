#!/bin/bash
set -e
. $(dirname "$0")/_init.sh

echo "$NAAM rollen naar ${VERSION}..."

cd ${BASEDIR}
npm version ${VERSION}

cd ${BASEDIR}/src/lib
npm version ${VERSION}

echo "done"
