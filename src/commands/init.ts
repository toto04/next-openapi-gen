import path from "path";
import fse from "fs-extra";
import fs from "fs";
import ora from "ora";
import { exec } from "child_process";
import util from "util";

import openapiTemplate from "../openapi-template.js";

const execPromise = util.promisify(exec);

const spinner = ora("Initializing project with OpenAPI template...\n");

const getPackageManager = async () => {
  if (fs.existsSync(path.join(process.cwd(), "yarn.lock"))) {
    return "yarn";
  }
  if (fs.existsSync(path.join(process.cwd(), "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  return "npm";
};

async function createDocsPage() {
  const paths = ["app", "api-docs"];
  const srcPath = path.join(process.cwd(), "src");

  if (fs.existsSync(srcPath)) {
    paths.unshift("src");
  }

  const docsDir = path.join(process.cwd(), ...paths);
  await fs.promises.mkdir(docsDir, { recursive: true });

  const swaggerComponent = `
import "swagger-ui-react/swagger-ui.css";

import dynamic from "next/dynamic";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => <p>Loading Component...</p>,
});

export default async function ApiDocsPage() {
  return (
    <section>
      <SwaggerUI url="/swagger.json" />
    </section>
  );
}
`;

  const componentPath = path.join(docsDir, "page.tsx");
  await fs.promises.writeFile(componentPath, swaggerComponent.trim());
  spinner.succeed(`Created ${paths.join("/")}/page.tsx for Swagger UI.`);
}

async function installSwagger() {
  const packageManager = await getPackageManager();
  const installCmd = `${packageManager} ${
    packageManager === "npm" ? "install" : "add"
  }`;

  spinner.succeed("Installing swagger-ui-react...");
  const resp = await execPromise(`${installCmd} swagger-ui-react`);
  spinner.succeed("Successfully installed swagger-ui-react.");
}

function extendOpenApiTemplate(spec, options) {
  spec.ui = options.ui ?? spec.ui;
  spec.docsUrl = options.docsUrl ?? spec.docsUrl;
}

export async function init(ui: string, docsUrl: string) {
  spinner.start();

  try {
    const outputPath = path.join(process.cwd(), "next.openapi.json");
    const template = { ...openapiTemplate };

    extendOpenApiTemplate(template, { docsUrl, ui });

    await fse.writeJson(outputPath, template, { spaces: 2 });
    spinner.succeed(`Created OpenAPI template in next.openapi.json`);

    if (ui === "swagger") {
      createDocsPage();
      installSwagger();
    }
  } catch (error) {
    spinner.fail(`Failed to initialize project: ${error.message}`);
  }
}
