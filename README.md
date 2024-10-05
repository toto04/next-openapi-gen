# Next OpenAPI Gen

**Next OpenAPI Gen** is a library that automatically generates an `openapi.json` specification for your Next.js project. This tool scans your API routes, schemas, and models, and generates a complete OpenAPI definition.

## Features

- Auto-generates `next.openapi.json` in your project's root directory.
- Scans API routes from `app/api/` and includes them in the generated OpenAPI specification.
- Scans schemas from the `schemas/` directory and includes them in the OpenAPI components.

## Installation

To install **Next OpenAPI Gen**, run:

```bash
npm install next-openapi-gen --save-dev
