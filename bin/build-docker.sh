#!/usr/bin/env bash

VERSION=`jq -r ".version" package.json`
SERIES=${VERSION:0:4}-latest

cat package.json | grep -v electron > server-package.json

sudo docker build -t jkaplon/trilium-dev:$VERSION --network host .

#if [[ $VERSION != *"beta"* ]]; then
  #sudo docker tag zadam/trilium:$VERSION zadam/trilium:latest
#fi
