FROM node:24-slim

RUN apt-get update
RUN apt-get install -y ca-certificates

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build --if-present

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

EXPOSE 3000

# must be root because this image requires Docker in Docker
USER root

ENTRYPOINT ["./entrypoint.sh"]
