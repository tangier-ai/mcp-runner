FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN --mount=type=secret,id=sentry_auth_token,required=false \
    --mount=type=secret,id=sentry_org,required=false \
    --mount=type=secret,id=sentry_project,required=false \
    if [ -f "/run/secrets/sentry_auth_token" ] && [ -f "/run/secrets/sentry_org" ] && [ -f "/run/secrets/sentry_project" ]; then \
        export SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_auth_token) \
        SENTRY_ORG=$(cat /run/secrets/sentry_org) \
        SENTRY_PROJECT=$(cat /run/secrets/sentry_project); \
    fi && \
    npm run build --if-present


EXPOSE 3000

CMD ["npm", "start"]
