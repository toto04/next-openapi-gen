import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import fs from "fs";
import fse from "fs-extra";
import path from "path";
import ora from "ora";

const apiDir = path.resolve("./src/app/api");
const schemaDir = path.resolve("./src/types/schemas");
const swaggerPaths = {};

function extractSchemaFromZod(schemaNode) {
  const properties = {};
  schemaNode.arguments.forEach((arg) => {
    if (t.isObjectExpression(arg)) {
      arg.properties.forEach((prop) => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
          // @ts-ignore
          const type = prop.value.callee.property.name;
          properties[prop.key.name] = { type };
        }
      });
    }
  });
  return { type: "object", properties };
}

function findSchemaDefinition(schemaName) {
  let schemaNode = null;

  function processSchemaFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const ast = parse(content, {
      sourceType: "module",
      plugins: ["typescript"],
    });

    traverse.default(ast, {
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          if (t.isCallExpression(path.node.init)) {
            schemaNode = path.node.init;
          }
        }
      },
    });
  }

  function scanSchemaDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        scanSchemaDir(filePath);
      } else if (file.endsWith(".ts")) {
        processSchemaFile(filePath);
      }
    });
  }

  scanSchemaDir(schemaDir);
  return schemaNode;
}

function isRoute(varName) {
  return (
    varName === "POST" ||
    varName === "GET" ||
    varName === "PUT" ||
    varName === "PATCH" ||
    varName === "DELETE"
  );
}

function addSchemaDefinition(schema, handler, options) {
  // Handle schema definition
  if (
    fs.existsSync(schemaDir) &&
    t.isCallExpression(handler) &&
    t.isIdentifier(handler.callee, { name: "withAPI" })
  ) {
    const [schemaIdentifier] = handler.arguments;

    if (t.isIdentifier(schemaIdentifier)) {
      const schemaNode = findSchemaDefinition(schemaIdentifier.name);

      const optionsNode = schemaNode.arguments[0];

      if (schemaNode) {
        // @TODO: add z.array tracking
        if (t.isObjectExpression(optionsNode)) {
          schema = extractSchemaFromZod(schemaNode);

          options = optionsNode.properties.reduce((acc, prop) => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              // @ts-ignore
              acc[prop.key.name] = prop.value.callee.property.name;
            }
            return acc;
          }, {});
        }
      }
    }
  }
}

function addRouteToPaths(varName, filePath, options, swaggerPaths, schema) {
  const method = varName.toLowerCase();
  const routePath = filePath
    .replace(apiDir, "")
    .replace("route.ts", "")
    .replaceAll("\\", "/")
    .replace(/\/$/, "");

  const rootPath = routePath.split("/")[1];

  if (!swaggerPaths[routePath]) {
    swaggerPaths[routePath] = {};
  }

  swaggerPaths[routePath][method] = {
    operationId: options.opId,
    description: options.desc,
    tags: [rootPath],
    requestBody: {
      content: {
        "application/json": {
          schema,
        },
      },
    },
    responses: {
      200: {
        description: "Successful response",
        content: {
          "application/json": {
            schema: options.res,
          },
        },
      },
      400: {
        description: "Validation error",
      },
      500: {
        description: "Server error",
      },
    },
  };
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const ast = parse(content, { sourceType: "module", plugins: ["typescript"] });

  traverse.default(ast, {
    ExportNamedDeclaration(path) {
      const declaration = path.node.declaration;

      // Route defined as function
      if (
        t.isFunctionDeclaration(declaration) &&
        t.isIdentifier(declaration.id)
      ) {
        const funcName = declaration.id.name;

        if (isRoute(funcName)) {
          addRouteToPaths(funcName, filePath, {}, swaggerPaths, {});
        }
      }

      // Route defined as variable
      if (t.isVariableDeclaration(declaration)) {
        declaration.declarations.forEach((decl) => {
          if (t.isVariableDeclarator(decl) && t.isIdentifier(decl.id)) {
            const varName = decl.id.name;
            let schema = {};
            let options: any = {};

            if (isRoute(varName)) {
              const handler = decl.init;

              addSchemaDefinition(schema, handler, options);

              addRouteToPaths(varName, filePath, options, swaggerPaths, schema);
            }
          }
        });
      }
    },
  });
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDir(filePath);
    } else if (file.endsWith(".ts")) {
      processFile(filePath);
    }
  });
}

export async function generateOpenapiSpec() {
  const spinner = ora("Generating openapi specification...\n").start();

  scanDir(apiDir);

  const openapiPath = path.resolve("./next.openapi.json");
  const openapiSpec = JSON.parse(fs.readFileSync(openapiPath, "utf-8"));

  openapiSpec.paths = swaggerPaths;

  const outputDir = path.resolve("./public");
  await fse.ensureDir(outputDir);

  const outputFile = path.join(outputDir, openapiSpec.outputFile);
  fs.writeFileSync(outputFile, JSON.stringify(openapiSpec, null, 2));

  spinner.succeed(`Swagger spec generated at ${outputFile}`);
}
