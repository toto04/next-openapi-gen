import fs from "fs";
import fse from "fs-extra";
import path from "path";
import ora from "ora";

import { OpenApiGenerator } from "../lib/openapi-generator.js";

export async function generate() {
  const spinner = ora("Generating OpenAPI specification...\n").start();

  const generator = new OpenApiGenerator();

  const apiDocs = generator.generate();
  const config = generator.getConfig();

  // Check if public dir exists
  const outputDir = path.resolve("./public");
  await fse.ensureDir(outputDir);

  // Write api docs
  const outputFile = path.join(outputDir, config.outputFile);
  fs.writeFileSync(outputFile, JSON.stringify(apiDocs, null, 2));

  spinner.succeed(`OpenAPI specification generated at ${outputFile}`);
}
