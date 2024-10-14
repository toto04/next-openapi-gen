export default {
  openapi: "3.0.0",
  info: {
    title: "API Documentation",
    version: "1.0.0",
    description: "This is the OpenAPI specification for your project.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
  paths: {},
  apiPath: "./src/app/api",
  docsUrl: "api-docs",
  ui: "swagger",
  outputPath: "./public/swagger.json",
  includeOpenApiRoutes: true,
};
