import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

export class SchemaProcessor {
  private schemaDir: string;

  constructor(schemaDir: string) {
    this.schemaDir = path.resolve(schemaDir);
  }

  public findSchemaDefinition(schemaName: string) {
    let schemaNode: t.Node | null = null;
    this.scanSchemaDir(this.schemaDir, schemaName, (node) => {
      schemaNode = node;
    });
    return schemaNode;
  }

  private scanSchemaDir(
    dir: string,
    schemaName: string,
    callback: (node: t.Node) => void
  ) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.scanSchemaDir(filePath, schemaName, callback);
      } else if (file.endsWith(".ts")) {
        this.processSchemaFile(filePath, schemaName, callback);
      }
    });
  }

  /**
   * Function recognizes different elements of TS like variable, type, interface, enum
   */
  private processSchemaFile(
    filePath: string,
    schemaName: string,
    callback: (node: t.Node) => void
  ) {
    const content = fs.readFileSync(filePath, "utf-8");
    const ast = parse(content, {
      sourceType: "module",
      plugins: ["typescript", "decorators-legacy"],
    });

    traverse.default(ast, {
      VariableDeclarator: (path) => {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          callback(path.node.init || path.node);
        }
      },
      TSTypeAliasDeclaration: (path) => {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          callback(path.node.typeAnnotation);
        }
      },
      TSInterfaceDeclaration: (path) => {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          callback(path.node);
        }
      },
      TSEnumDeclaration: (path) => {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          callback(path.node);
        }
      },
    });
  }

  private processEnum(enumNode: t.TSEnumDeclaration): object {
    // Initialization OpenAPI enum object
    const enumSchema = {
      type: "string",
      enum: [],
    };

    // Iterate throught enum members
    enumNode.members.forEach((member) => {
      if (t.isTSEnumMember(member)) {
        const name = member.id?.name;
        const value = member.initializer?.value;
        let type = member.initializer?.type;

        if (type === "NumericLiteral") {
          enumSchema.type = "number";
        }

        const targetValue = value || name;

        enumSchema.enum.push(targetValue);
      }
    });

    return enumSchema;
  }

  private extractTypesFromSchema(schema, dataType) {
    const result = dataType === "params" ? [] : {};

    const handleProperty = (property) => {
      const key = property.key.name;
      const typeAnnotation = property.typeAnnotation?.typeAnnotation?.type;
      const type = this.getTypeFromAnnotation(typeAnnotation);
      const isOptional = !!property.optional; // check if property is optional
      // In case of typescript type get the name
      const typeName = property.typeAnnotation?.typeAnnotation?.typeName?.name;

      let description = "";

      // get comments for field
      if (property.trailingComments && property.trailingComments.length) {
        description = property.trailingComments[0].value.trim(); // get first comment
      }

      let field = {
        type: type,
        description: description,
      };

      // Handle custom types & enums
      if (type === "object") {
        const obj = this.findSchemaDefinition(typeName);

        if (obj?.type === "TSEnumDeclaration") {
          const enumValues = this.processEnum(obj);
          field = { ...field, ...enumValues };
        }
      }

      if (dataType === "params") {
        // @ts-ignore
        result.push({
          name: key,
          in: "query",
          schema: field,
          description,
          required: !isOptional,
        });
      } else {
        result[key] = field;
      }
    };

    if (schema.body?.body) {
      schema.body.body.forEach(handleProperty);
    }

    if (schema.type === "TSTypeLiteral" && schema.members) {
      schema.members.forEach(handleProperty);
    }

    // let enumValues = null;

    //   // check if type is enum
    //   if (
    //     typeAnnotation === "TSTypeReference"
    //     // (schema.enum && schema.enum[key])
    //   ) {
    //     console.log("ENUM", schema);
    //     enumValues = schema.enums[key]; // get value from enum
    //   }

    return result;
  }

  private getTypeFromAnnotation(type: string): string {
    switch (type) {
      case "TSStringKeyword":
        return "string";
      case "TSNumberKeyword":
        return "number";
      case "TSBooleanKeyword":
        return "boolean";
      // Add other cases as needed.
      default:
        return "object"; // fallback to object for unknown types
    }
  }

  public createRequestBodySchema(body: Record<string, any>) {
    return {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: body,
          },
        },
      },
    };
  }

  public createResponseSchema(responses: Record<string, any>) {
    return {
      200: {
        description: "Successful response",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: responses,
            },
          },
        },
      },
    };
  }

  public getSchemaContent({ paramsType, bodyType, responseType }) {
    const paramsSchema = paramsType
      ? this.findSchemaDefinition(paramsType)
      : null;
    const bodySchema = bodyType ? this.findSchemaDefinition(bodyType) : null;
    const responseSchema = responseType
      ? this.findSchemaDefinition(responseType)
      : null;

    let params = paramsSchema
      ? this.extractTypesFromSchema(paramsSchema, "params")
      : [];
    let body = bodySchema
      ? this.extractTypesFromSchema(bodySchema, "body")
      : {};
    let responses = responseSchema
      ? this.extractTypesFromSchema(responseSchema, "responses")
      : {};

    return {
      params,
      body,
      responses,
    };
  }
}
