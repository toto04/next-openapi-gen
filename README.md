# next-openapi-gen

**next-openapi-gen** super fast and easy way to generate OpenAPI 3.0 documentation automatically from API routes in a Next.js 14.

With support for multiple user interfaces next-openapi-gen makes documenting your API a breeze!

## Prerequisites

- Nextjs >= 14
- Node >= 18

## Supported interfaces

- Swagger
- Redoc
- Stoplight Elements
- RapiDoc

## Features

- **Automatic OpenAPI Generation**: Generate OpenAPI 3.0 documentation from your Next.js routes, automatically parsing TypeScript types for parameters, request bodies and responses.
- **TypeScript Type Scanning**: Automatically resolve TypeScript types for params, body, and responses based on your API endpoint's TypeScript definitions. Field comments in TypeScript types are reflected as descriptions in the OpenAPI schema.
- **JSDoc-Based Documentation (Optional)**:  Document API routes with JSDoc comments, including tags like `@openapi`, `@auth`, `@desc`, `@params`, `@body`, and `@response` to easily define route metadata.
- **UI Interface Options**: Choose between `Swagger UI`, `Redoc`, `Stoplight Elements` or `RapiDoc` to visualize your API documentation. Customize the interface to fit your preferences.
- **Real-time Documentation**: As your API evolves, regenerate the OpenAPI documentation with a single command, ensuring your documentation is always up to date.
- **Easy configuration**: Customize generator behavior using the `next.openapi.json` configuration file, allowing for quick adjustments without modifying the code.

## Installation

```bash
yarn add next-openapi-gen
```

## Demo

![Demo File](https://raw.githubusercontent.com/tazo90/next-openapi-gen/refs/heads/main/assets/demo.gif)

## Usage

### Step 1: Initialize Configuration and Setup

Run the following command to generate the `next.openapi.json` configuration file and automatically set up Swagger UI with `/api-docs` routes:

```bash
npx next-openapi-gen init --ui swagger --docs-url api-docs
```

Parameters:
- **ui**: `swagger` | `redoc` | `stoplight` | `rapidoc`
- **docs-url**: url on which api docs will be visible

This command does the following:

- Generates a `next.openapi.json` file, which stores the OpenAPI configuration for your project.
- Installs Swagger UI to provide an API documentation interface.
- Adds an `/api-docs` route in the Next.js app for visualizing the generated OpenAPI documentation.

### Step 2: Add JSDoc Comments to Your API Routes

Annotate your API routes using JSDoc comments. Here's an example:

```typescript
//app/api/auth/reset-password/route.ts

import { type NextRequest } from "next/server";

type ResetPasswordParams = {
  token: string; // Token for resetting the password
};

type ResetPasswordBody = {
  password: string; // The new password for the user
};

type ResetPasswordResponse = {
  message: string; // Confirmation message that password has been reset
};

/**
 * Reset the user's password.
 * @auth: bearer
 * @desc: Allows users to reset their password using a reset token.
 * @params: ResetPasswordParams
 * @body: ResetPasswordBody
 * @response: ResetPasswordResponse
 */
export async function POST(req: Request) {
  const searchParams = req.nextUrl.searchParams;

  const token = searchParams.get("token"); // Token from query params
  const { password } = await req.json(); // New password from request body

  // Logic to reset the user's password

  return Response.json({ message: "Password has been reset" });
}
```

- `@openapi`: Marks the route for inclusion in the OpenAPI specification.
- `@auth`: Specifies authentication type used for API route (`basic`, `bearer`, `apikey`)
- `@desc`: Provides a detailed description of the API route.
- `@params`: Specifies the TypeScript interface or Zod schema for the query parameters.
- `@body`: Specifies the TypeScript interface or Zod schema for the request body.
- `@response`: Specifies the TypeScript interface or Zod schema for the response.

### Step 3: Generate the OpenAPI Specification

Run the following command to generate the OpenAPI schema based on your API routes:

```bash
npx next-openapi-gen generate
```

This command processes all your API routes, extracts the necessary information from JSDoc comments, and generates the OpenAPI schema, typically saved to a `swagger.json` file in the `public` folder.

### Step 4: View API Documentation

With the `/api-docs` route generated from the init command, you can now access your API documentation through Swagger UI by navigating to `http://localhost:3000/api-docs`.

## Configuration Options

The `next.openapi.json` file allows you to configure the behavior of the OpenAPI generator, including options such as:

- **apiDir**: (default: `./src/app/api`) The directory where your API routes are stored.
- **schemaDir**: (default: `./src`) The directory where your schema definitions are stored.
- **docsUrl**: (default: `./api-docs`) Route where OpenAPI UI is available.
- **ui**: (default: `swagger`) OpenAPI UI interface.
- **outputFile**: (default: `./swagger.json`) The file where the generated OpenAPI specification will be saved in `public` folder.
- **includeOpenApiRoutes**: (default: `false`) When `true`, the generator will only include routes that have the `@openapi` tag in their JSDoc comments.

## Interface providers

<div align="center">
<table>
  <thead>
   <th>SwaggerUI</th>
   <th>Redoc</th>
   <th>Stoplight Elements</th>
   <th>RapiDoc</th>
  </thead>
  <tbody>
   <tr>
    <td>
	<img width="320" alt="swagger" src="https://raw.githubusercontent.com/tazo90/next-openapi-gen/refs/heads/main/assets/swagger.png" alt-text="swagger">
	</td>
	<td>
	<img width="320" alt="redoc" src="https://raw.githubusercontent.com/tazo90/next-openapi-gen/refs/heads/main/assets/redoc.png" alt-text="redoc">
	</td>
	<td>
	<img width="320" alt="stoplight" src="https://raw.githubusercontent.com/tazo90/next-openapi-gen/refs/heads/main/assets/stoplight.png" alt-text="stoplight">
	</td>
	<td>
	<img width="320" alt="rapidoc" src="https://raw.githubusercontent.com/tazo90/next-openapi-gen/refs/heads/main/assets/rapidoc.png" alt-text="rapidoc">
	</td>
   </tr>
  </tbody>
</table>
