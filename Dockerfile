FROM node:24-alpine

WORKDIR /app
RUN apk add --no-cache python3 make gcc g++


COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
