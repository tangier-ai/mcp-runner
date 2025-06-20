# Tangier Secure MCP Runner

Dockerized API for running MCP servers securely and a standardized interface to connect to the remotely built in TypeScript.

## Fresh Server Setup

If you're on a fresh Ubuntu 24.04 server, run the setup script first:

```bash
source setup.sh
```

## Development

Install dependencies:
```bash
npm install
```

Start development server:
```bash
npm run start:dev
```

## Production

Build and run:
```bash
npm run build
npm run start:prod
```
