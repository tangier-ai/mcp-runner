# Tangier Secure MCP Runner

Dockerized API for running MCP servers securely and a standardized interface to connect to the remotely built in TypeScript.

## License

Copyright (C) 2025 Tangier AI, Inc.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

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
