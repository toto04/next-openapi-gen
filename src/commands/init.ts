import path from "path";
import fse from "fs-extra";
import fs from "fs";
import ora from "ora";
import { exec } from "child_process";
import util from "util";

import openapiTemplate from "../openapi-template.js";
import { swaggerDeps, SwaggerUI } from "../components/swagger.js";
import { redocDeps, RedocUI } from "../components/redoc.js";

const execPromise = util.promisify(exec);

const spinner = ora("Initializing project with OpenAPI template...\n");

const getPackageManager = async () => {
  let currentDir = process.cwd();

  while (true) {
    // Check for Yarn lock file
    if (fs.existsSync(path.join(currentDir, "yarn.lock"))) {
      return "yarn";
    }
    // Check for PNPM lock file
    if (fs.existsSync(path.join(currentDir, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    // If we're at the root directory, break the loop
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // We've reached the root
    }
    currentDir = parentDir; // Move up one directory
  }

  // Default to npm if no lock files are found
  return "npm";
};

function getDocsPage(ui: string, outputFile: string) {
  if (ui === "swagger") {
    return SwaggerUI(outputFile);
  } else if (ui === "redoc") {
    return RedocUI(outputFile);
  }
}

function getDocsPageDependencies(ui: string) {
  let deps = [];

  if (ui === "swagger") {
    deps = swaggerDeps;
  } else if (ui === "redoc") {
    deps = redocDeps;
  }

  return deps.join(" ");
}

async function createDocsPage() {
  const paths = ["app", "api-docs"];
  const srcPath = path.join(process.cwd(), "src");
  const { ui, outputFile } = openapiTemplate;

  if (fs.existsSync(srcPath)) {
    paths.unshift("src");
  }

  const docsDir = path.join(process.cwd(), ...paths);
  await fs.promises.mkdir(docsDir, { recursive: true });

  const docsPage = getDocsPage(ui, outputFile);

  const componentPath = path.join(docsDir, "page.tsx");
  await fs.promises.writeFile(componentPath, docsPage.trim());
  spinner.succeed(`Created ${paths.join("/")}/page.tsx for ${ui}.`);
}

async function installDependencies(ui: string) {
  const packageManager = await getPackageManager();
  const installCmd = `${packageManager} ${
    packageManager === "npm" ? "install" : "add"
  }`;

  const deps = getDocsPageDependencies(ui);

  spinner.succeed(`Installing ${deps} dependencies...`);
  const resp = await execPromise(`${installCmd} ${deps}`);
  spinner.succeed(`Successfully installed ${deps}.`);
}

function extendOpenApiTemplate(spec, options) {
  spec.ui = options.ui ?? spec.ui;
  spec.docsUrl = options.docsUrl ?? spec.docsUrl;
}

export async function init(options: { ui: string; docsUrl: string }) {
  const { ui, docsUrl } = options;

  spinner.start();

  try {
    const outputPath = path.join(process.cwd(), "next.openapi.json");
    const template = { ...openapiTemplate };

    extendOpenApiTemplate(template, { docsUrl, ui });

    await fse.writeJson(outputPath, template, { spaces: 2 });
    spinner.succeed(`Created OpenAPI template in next.openapi.json`);

    createDocsPage();
    installDependencies(ui);
  } catch (error) {
    spinner.fail(`Failed to initialize project: ${error.message}`);
  }
}
