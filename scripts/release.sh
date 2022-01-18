#!/bin/bash -e

npm config set @moonpig:registry=https:$MNPG_NPM_REGISTRY_URL
npm config set $MNPG_NPM_REGISTRY_URL:_authToken=$MNPG_NPM_REGISTRY_PUSH_API_KEY
npm config set $MNPG_NPM_REGISTRY_URL:always-auth=true

npm run build
npm publish --registry $MNPG_NPM_REGISTRY_URL --conventional-commits --no-commit-hooks --m 'chore(release): new version [ci skip]' --yes
