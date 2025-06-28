FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN --mount=type=secret,id=sentry_auth_token \
    --mount=type=secret,id=sentry_org \
    --mount=type=secret,id=sentry_project \
    SENTRY_ORG=$(cat /run/secrets/sentry_org) \
    SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_auth_token) \
    SENTRY_PROJECT=$(cat /run/secrets/sentry_project) \
    npm run build --if-present


EXPOSE 3000

CMD ["npm", "start"]
