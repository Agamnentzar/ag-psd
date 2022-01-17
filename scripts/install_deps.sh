#!/bin/bash -e
apk add --no-cache --virtual build-deps \
      python \
      g++ \
      build-base \
      cairo-dev \
      jpeg-dev \
      pango-dev \
      musl-dev \
      giflib-dev \
      pixman-dev \
      pangomm-dev \
      libjpeg-turbo-dev \
      freetype-dev \
      cairo \
      jpeg \
      pango \
      musl \
      giflib \
      pixman \
      pangomm \
      libjpeg-turbo \
      freetype
