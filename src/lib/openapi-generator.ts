import path from "path";
import fs from "fs";

import { RouteProcessor } from "./route-processor.js";
import { cleanSpec } from "./utils.js";
import { OpenApiConfig, OpenApiTemplate } from "../types.js";

export class OpenApiGenerator {
  private config: OpenApiConfig;
  private template: OpenApiTemplate;
  private routeProcessor: RouteProcessor;

  constructor() {
    const templatePath = path.resolve("./next.openapi.json");

    this.template = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
    this.config = this.getConfig();

    this.routeProcessor = new RouteProcessor(this.config);
  }

  public getConfig() {
    // @ts-ignore
    const { apiDir, schemaDir, docsUrl, ui, outputFile, includeOpenApiRoutes } =
      this.template;

    return {
      apiDir,
      schemaDir,
      docsUrl,
      ui,
      outputFile,
      includeOpenApiRoutes,
    };
  }

  public generate() {
    const { apiDir } = this.config;

    this.routeProcessor.scanApiRoutes(apiDir);

    this.template.paths = this.routeProcessor.getSwaggerPaths();

    const openapiSpec = cleanSpec(this.template);

    return openapiSpec;
  }
}
