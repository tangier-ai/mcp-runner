# Tangier Secure MCP Runner

A secure, isolated platform for running MCP (Model Context Protocol) servers in Docker containers with GVisor runtime. Built with NestJS and TypeScript, this service provides ephemeral, multi-tenant deployments of MCP servers with robust security isolation.

## Motivation

This project solves key challenges when integrating with MCP servers:

- **Security**: Run untrusted MCP servers in isolated containers that cannot access host resources or communicate with each other
- **Multi-tenancy**: Multiple clients can safely connect to the same MCP server instance without data leakage
- **Ephemeral deployments**: Complete cleanup of all deployment data (configs, logs, network, users) when deleted
- **Legacy transport support**: Connect to local MCP servers and expose them via modern HTTP/SSE endpoints
- **Resource management**: Enforce memory and CPU limits on shared infrastructure

Perfect for developers building applications that need to integrate with various MCP servers, especially untrusted or locally-running ones like Wikipedia MCP.

## License

Copyright (C) 2025 Tangier AI, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.


## How It Works

The secure MCP runner operates through several layers of isolation:

1. **Container Isolation**: Each MCP server runs in its own Docker container with GVisor runtime (`runsc`)
2. **Network Isolation**: Containers are placed in isolated bridge networks that prevent inter-container communication
3. **User Isolation**: Each container runs as a unique unprivileged Linux user with minimal permissions
4. **Resource Limits**: Memory and CPU constraints prevent resource exhaustion
5. **Transport Standardization**: All MCP servers are exposed via Streamable HTTP/SSE endpoints for remote access regardless of their original transport (includes STDIO)

## Security Model

Security is enforced through multiple layers:

- **GVisor Runtime**: All containers use `runsc` runtime for kernel-level isolation
- **Capability Dropping**: Containers drop dangerous capabilities (`SYS_ADMIN`, `NET_ADMIN`, `SYS_PTRACE`, `SYS_MODULE`)
- **Security Options**: `no-new-privileges`, `apparmor:docker-default`, `seccomp:unconfined`
- **Network Isolation**: Networks are created for each deployment with inter-container communication disabled
- **DNS Control**: Containers use only Google (8.8.8.8) and Cloudflare (1.1.1.1) DNS servers
- **Ephemeral Data**: Complete cleanup of all deployment artifacts (containers, networks, users, logs) upon deletion

## Quick Start

### Server Setup

Create a new Ubuntu 24.04 VM (minimum 2GB RAM recommended) and run:

```bash
source setup.sh
```

### Running the Service

Start the MCP runner service:

```bash
docker run -d \
  --privileged \
  --network=host \
  --name mcp-runner-container \
  --restart=always \
  -e NODE_ENV=production \
  -e API_KEY=your-secure-api-key \
  -e BIND_IP=0.0.0.0 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc:/etc \
  -v /var/mcp-runner:/var/mcp-runner \
  tangierai/mcp-runner:latest
```

The service will start on `localhost:3000` by default.

### Environment Variables

- `PORT`: Server port (default: 3000)
- `BIND_IP`: Interface to bind to (default: 127.0.0.1, use 0.0.0.0 for public access)
- `API_KEY`: Authentication key (auto-generated if not provided)
- `SENTRY_DSN`: Sentry error reporting endpoint (optional)
- `NODE_ENV`: Environment mode (production/development)

If no `API_KEY` is provided, one will be auto-generated and logged to the console.

### External Access

By default, the service binds to localhost only. For external access:

**Option 1: Direct binding**
```bash
docker run -d \
  --privileged \
  --network=host \
  --name mcp-runner-container \
  --restart=always \
  -e NODE_ENV=production \
  -e API_KEY=your-secure-api-key \
  -e BIND_IP=0.0.0.0 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc:/etc \
  -v /var/mcp-runner:/var/mcp-runner \
  tangierai/mcp-runner:latest
```

**Option 2: Nginx proxy**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        client_max_body_size 0;
        proxy_http_version 1.1;
        proxy_request_buffering off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## API Usage

### Authentication

All API requests require an `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/deployment
```

### Create a Deployment

```bash
curl -X POST http://localhost:3000/api/deployment \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "image": "mcp/sequentialthinking:latest",
    "transport": {
      "type": "stdio"
    },
    "maxMemory": 512,
    "maxCpus": 1,
    "deleteAfterSeconds": 3600
  }'
```

### List Deployments

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/deployment
```

### Connect to MCP Server

Once deployed, connect to your MCP server via the provided SSE or HTTP endpoints.

## Monitoring & Observability

### Sentry Integration

Enable error reporting with Sentry, include a `SENTRY_DSN` environment variable when starting the service:

```bash
docker run -d \
  --privileged \
  --network=host \
  --name mcp-runner-container \
  --restart=always \
  -e NODE_ENV=production \
  -e SENTRY_DSN=your-sentry-dsn \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc:/etc \
  -v /var/mcp-runner:/var/mcp-runner \
  tangierai/mcp-runner:latest
```

**Privacy**: Environment variables and arguments from deployment requests are automatically stripped from Sentry error reports to prevent data leakage.

### Source Maps

To publish source maps to Sentry for better error tracking:

```bash
docker run -d \
  -e SENTRY_ORG=your-org \
  -e SENTRY_PROJECT=your-project \
  -e SENTRY_AUTH_TOKEN=your-auth-token \
  tangierai/mcp-runner:latest \
  publish:sourcemap
```

## Development

### Local Development

Install dependencies:
```bash
npm install
```

Start development server:
```bash
npm run start:dev
```

### Building

Build and run locally:
```bash
npm run build
npm run start:prod
```

### API Documentation

Once running, visit `http://localhost:3000/api` for interactive Swagger documentation.
