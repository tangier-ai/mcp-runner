# Tangier Secure MCP Runner

Dockerized API for running MCP servers securely and a standardized interface to connect to the remotely built in TypeScript.

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
