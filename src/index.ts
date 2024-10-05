#!/usr/bin/env node

import { Command } from "commander";

import { init } from "./commands/init.js";
import { generateOpenapiSpec } from "./commands/generate-openapi-spec.js";

const program = new Command();

program
  .name("next-openapi-gen")
  .version("0.0.1")
  .description(
    "Super fast and easy way to generate OpenAPI documentation for Next.js"
  );

program
  .command("init <ui> <docs-url>")
  .description("Initialize a openapi specification")
  .action(init);

program
  .command("generate")
  .description("Generate a specification based on api routes")
  .action(generateOpenapiSpec);

program.parse(process.argv);
