import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

import { Params, Property } from "../types";

export class SchemaProcessor {
  private schemaDir: string;
  private typeDefinitions: any = {};
  private openapiDefinitions: any = {};
  private contentType: string = "";

  private directoryCache: Record<string, string[]> = {};
  private statCache: Record<string, fs.Stats> = {};
  private processSchemaTracker: Record<string, boolean> = {};
  private processingTypes = new Set();

  constructor(schemaDir: string) {
    this.schemaDir = path.resolve(schemaDir);
  }

  public findSchemaDefinition(schemaName: string, contentType: string) {
    let schemaNode: t.Node | null = null;

    // assign type that is actually processed
    this.contentType = contentType;

    this.scanSchemaDir(this.schemaDir, schemaName);

    return schemaNode;
  }

  private scanSchemaDir(dir: string, schemaName: string) {
    let files = this.directoryCache[dir];
    if (typeof files === "undefined") {
      files = fs.readdirSync(dir);
      this.directoryCache[dir] = files;
    }

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      let stat = this.statCache[filePath];
      if (typeof stat === "undefined") {
        stat = fs.statSync(filePath);
        this.statCache[filePath] = stat;
      }

      if (stat.isDirectory()) {
        this.scanSchemaDir(filePath, schemaName);
      } else if (file.endsWith(".ts")) {
        this.processSchemaFile(filePath, schemaName);
      }
    });
  }

  private collectTypeDefinitions(ast, schemaName) {
    traverse.default(ast, {
      VariableDeclarator: (path) => {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          const name = path.node.id.name;
          this.typeDefinitions[name] = path.node.init || path.node;
        }
      },
      TSTypeAliasDeclaration: (path) => {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          const name = path.node.id.name;
          this.typeDefinitions[name] = path.node.typeAnnotation;
        }
      },
      TSInterfaceDeclaration: (path) => {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          const name = path.node.id.name;
          this.typeDefinitions[name] = path.node;
        }
      },
      TSEnumDeclaration: (path) => {
        if (t.isIdentifier(path.node.id, { name: schemaName })) {
          const name = path.node.id.name;
          this.typeDefinitions[name] = path.node;
        }
      },
    });
  }

  private resolveType(typeName: string) {
    if (this.processingTypes.has(typeName)) {
      // Return reference to type to avoid infinite recursion
      return { $ref: `#/components/schemas/${typeName}` };
    }

    // Add type to precessing types
    this.processingTypes.add(typeName);

    try {
      const typeNode = this.typeDefinitions[typeName.toString()];
      if (!typeNode) return {};

      if (t.isTSEnumDeclaration(typeNode)) {
        const enumValues = this.processEnum(typeNode);
        return enumValues;
      }

      if (t.isTSTypeLiteral(typeNode) || t.isTSInterfaceBody(typeNode)) {
        const properties = {};

        if ("members" in typeNode) {
          (typeNode.members || []).forEach((member) => {
            if (t.isTSPropertySignature(member) && t.isIdentifier(member.key)) {
              const propName = member.key.name;
              const options = this.getPropertyOptions(member);

              const property = {
                ...this.resolveTSNodeType(
                  member.typeAnnotation?.typeAnnotation
                ),
                ...options,
              };

              properties[propName] = property;
            }
          });
        }

        return { type: "object", properties };
      }

      if (t.isTSArrayType(typeNode)) {
        return {
          type: "array",
          items: this.resolveTSNodeType(typeNode.elementType),
        };
      }

      return {};
    } finally {
      // Remove type from processed set after we finish
      this.processingTypes.delete(typeName);
    }
  }

  private isDateString(node) {
    if (t.isStringLiteral(node)) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/;
      return dateRegex.test(node.value);
    }
    return false;
  }

  private isDateObject(node) {
    return (
      t.isNewExpression(node) && t.isIdentifier(node.callee, { name: "Date" })
    );
  }

  private isDateNode(node) {
    return this.isDateString(node) || this.isDateObject(node);
  }

  resolveTSNodeType(node) {
    if (!node) return { type: "object" }; // Default type for undefined/null

    if (t.isTSStringKeyword(node)) return { type: "string" };
    if (t.isTSNumberKeyword(node)) return { type: "number" };
    if (t.isTSBooleanKeyword(node)) return { type: "boolean" };
    if (t.isTSAnyKeyword(node) || t.isTSUnknownKeyword(node))
      return { type: "object" };
    if (
      t.isTSVoidKeyword(node) ||
      t.isTSNullKeyword(node) ||
      t.isTSUndefinedKeyword(node)
    )
      return { type: "null" };
    if (this.isDateNode(node)) return { type: "string", format: "date-time" };

    // Handle literal types like "admin" | "member" | "guest"
    if (t.isTSLiteralType(node)) {
      if (t.isStringLiteral(node.literal)) {
        return {
          type: "string",
          enum: [node.literal.value],
        };
      } else if (t.isNumericLiteral(node.literal)) {
        return {
          type: "number",
          enum: [node.literal.value],
        };
      } else if (t.isBooleanLiteral(node.literal)) {
        return {
          type: "boolean",
          enum: [node.literal.value],
        };
      }
    }

    if (t.isTSTypeReference(node) && t.isIdentifier(node.typeName)) {
      const typeName = node.typeName.name;

      // Special handling for built-in types
      if (typeName === "Date") {
        return { type: "string", format: "date-time" };
      }

      if (typeName === "Array" || typeName === "ReadonlyArray") {
        if (node.typeParameters && node.typeParameters.params.length > 0) {
          return {
            type: "array",
            items: this.resolveTSNodeType(node.typeParameters.params[0]),
          };
        }
        return { type: "array", items: { type: "object" } };
      }

      if (typeName === "Record") {
        if (node.typeParameters && node.typeParameters.params.length > 1) {
          const keyType = this.resolveTSNodeType(node.typeParameters.params[0]);
          const valueType = this.resolveTSNodeType(
            node.typeParameters.params[1]
          );

          return {
            type: "object",
            additionalProperties: valueType,
          };
        }
        return { type: "object", additionalProperties: true };
      }

      if (
        typeName === "Partial" ||
        typeName === "Required" ||
        typeName === "Readonly"
      ) {
        if (node.typeParameters && node.typeParameters.params.length > 0) {
          return this.resolveTSNodeType(node.typeParameters.params[0]);
        }
      }

      if (typeName === "Pick" || typeName === "Omit") {
        if (node.typeParameters && node.typeParameters.params.length > 0) {
          return this.resolveTSNodeType(node.typeParameters.params[0]);
        }
      }

      // Check if it is a type that we are already processing
      if (this.processingTypes.has(typeName)) {
        return { $ref: `#/components/schemas/${typeName}` };
      }

      // Find type definition
      this.findSchemaDefinition(typeName, this.contentType);

      return this.resolveType(node.typeName.name);
    }

    if (t.isTSArrayType(node)) {
      return {
        type: "array",
        items: this.resolveTSNodeType(node.elementType),
      };
    }

    if (t.isTSTypeLiteral(node)) {
      const properties = {};
      node.members.forEach((member) => {
        if (t.isTSPropertySignature(member) && t.isIdentifier(member.key)) {
          const propName = member.key.name;
          properties[propName] = this.resolveTSNodeType(
            member.typeAnnotation?.typeAnnotation
          );
        }
      });
      return { type: "object", properties };
    }

    if (t.isTSUnionType(node)) {
      // Handle union types with literal types, like "admin" | "member" | "guest"
      const literals = node.types.filter((type) => t.isTSLiteralType(type));

      // Check if all union elements are literals
      if (literals.length === node.types.length) {
        // All union members are literals, convert to enum
        const enumValues = literals
          .map((type) => {
            if (t.isTSLiteralType(type) && t.isStringLiteral(type.literal)) {
              return type.literal.value;
            } else if (
              t.isTSLiteralType(type) &&
              t.isNumericLiteral(type.literal)
            ) {
              return type.literal.value;
            } else if (
              t.isTSLiteralType(type) &&
              t.isBooleanLiteral(type.literal)
            ) {
              return type.literal.value;
            }
            return null;
          })
          .filter((value) => value !== null);

        if (enumValues.length > 0) {
          // Check if all enum values are of the same type
          const firstType = typeof enumValues[0];
          const sameType = enumValues.every((val) => typeof val === firstType);

          if (sameType) {
            return {
              type: firstType,
              enum: enumValues,
            };
          }
        }
      }

      // Handling null | undefined in type union
      const nullableTypes = node.types.filter(
        (type) =>
          t.isTSNullKeyword(type) ||
          t.isTSUndefinedKeyword(type) ||
          t.isTSVoidKeyword(type)
      );

      const nonNullableTypes = node.types.filter(
        (type) =>
          !t.isTSNullKeyword(type) &&
          !t.isTSUndefinedKeyword(type) &&
          !t.isTSVoidKeyword(type)
      );

      // If a type can be null/undefined, we mark it as nullable
      if (nullableTypes.length > 0 && nonNullableTypes.length === 1) {
        const mainType = this.resolveTSNodeType(nonNullableTypes[0]);
        return {
          ...mainType,
          nullable: true,
        };
      }

      // Standard union type support via oneOf
      return {
        oneOf: node.types
          .filter(
            (type) =>
              !t.isTSNullKeyword(type) &&
              !t.isTSUndefinedKeyword(type) &&
              !t.isTSVoidKeyword(type)
          )
          .map((subNode) => this.resolveTSNodeType(subNode)),
      };
    }

    if (t.isTSIntersectionType(node)) {
      // For intersection types, we combine properties
      const allProperties = {};
      const requiredProperties = [];

      node.types.forEach((typeNode) => {
        const resolvedType = this.resolveTSNodeType(typeNode);
        if (resolvedType.type === "object" && resolvedType.properties) {
          Object.entries(resolvedType.properties).forEach(([key, value]) => {
            allProperties[key] = value;
            if (value.required) {
              requiredProperties.push(key);
            }
          });
        }
      });

      return {
        type: "object",
        properties: allProperties,
        required:
          requiredProperties.length > 0 ? requiredProperties : undefined,
      };
    }

    // Case where a type is a reference to another defined type
    if (t.isTSTypeReference(node) && t.isIdentifier(node.typeName)) {
      return { $ref: `#/components/schemas/${node.typeName.name}` };
    }

    console.warn("Unrecognized TypeScript type node:", node);
    return { type: "object" }; // By default we return an object
  }

  private processSchemaFile(filePath: string, schemaName: string) {
    // Check if the file has already been processed
    if (this.processSchemaTracker[`${filePath}-${schemaName}`]) return;

    try {
      // Recognizes different elements of TS like variable, type, interface, enum
      const content = fs.readFileSync(filePath, "utf-8");
      const ast = parse(content, {
        sourceType: "module",
        plugins: ["typescript", "decorators-legacy"],
      });

      this.collectTypeDefinitions(ast, schemaName);

      // Reset the set of processed types before each schema processing
      this.processingTypes.clear();

      const definition = this.resolveType(schemaName);
      this.openapiDefinitions[schemaName] = definition;

      this.processSchemaTracker[`${filePath}-${schemaName}`] = true;
      return definition;
    } catch (error) {
      console.error(
        `Error processing schema file ${filePath} for schema ${schemaName}:`,
        error
      );
      return { type: "object" }; // By default we return an empty object on error
    }
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
        // @ts-ignore
        const name = member.id?.name;
        // @ts-ignore
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

  private getPropertyOptions(node) {
    const isOptional = !!node.optional; // check if property is optional

    let description = null;
    // get comments for field
    if (node.trailingComments && node.trailingComments.length) {
      description = node.trailingComments[0].value.trim(); // get first comment
    }

    const options: Property = {};

    if (description) {
      options.description = description;
    }

    if (this.contentType === "params") {
      options.required = !isOptional;
    } else if (this.contentType === "body") {
      options.nullable = isOptional;
    }

    return options;
  }

  /**
   * Generate example values based on parameter type and name
   */
  public getExampleForParam(paramName: string, type: string = "string"): any {
    // Common ID-like parameters
    if (
      paramName === "id" ||
      paramName.endsWith("Id") ||
      paramName.endsWith("_id")
    ) {
      return type === "string" ? "123abc" : 123;
    }

    // For specific common parameter names
    switch (paramName.toLowerCase()) {
      case "slug":
        return "example-slug";
      case "uuid":
        return "123e4567-e89b-12d3-a456-426614174000";
      case "username":
        return "johndoe";
      case "email":
        return "user@example.com";
      case "name":
        return "example-name";
      case "date":
        return "2023-01-01";
      case "page":
        return 1;
      default:
        // Default examples by type
        if (type === "string") return "example";
        if (type === "number") return 1;
        if (type === "boolean") return true;
        return "example";
    }
  }

  /**
   * Create a default schema for path parameters when no schema is defined
   */
  public createDefaultPathParamsSchema(paramNames: string[]): any[] {
    return paramNames.map((paramName) => {
      // Guess the parameter type based on the name
      let type: string = "string";
      if (
        paramName === "id" ||
        paramName.endsWith("Id") ||
        paramName === "page" ||
        paramName === "limit" ||
        paramName === "size" ||
        paramName === "count"
      ) {
        type = "number";
      }

      const example = this.getExampleForParam(paramName, type);

      return {
        name: paramName,
        in: "path",
        required: true,
        schema: {
          type: type,
        },
        example: example,
        description: `Path parameter: ${paramName}`,
      };
    });
  }

  public createRequestParamsSchema(params: Params, isPathParam = false) {
    const queryParams = [];

    if (params.properties) {
      for (let [name, value] of Object.entries(params.properties)) {
        const param: Property = {
          in: isPathParam ? "path" : "query",
          name,
          schema: {
            type: value.type,
          },
          required: isPathParam ? true : value.required, // Path parameters are always required
        };

        if (value.enum) {
          param.schema.enum = value.enum;
        }

        if (value.description) {
          param.description = value.description;
          param.schema.description = value.description;
        }

        // Add examples for path parameters
        if (isPathParam) {
          const example = this.getExampleForParam(name, value.type);
          param.example = example;
        }

        queryParams.push(param);
      }
    }
    return queryParams;
  }

  public createRequestBodySchema(body: Record<string, any>) {
    return {
      content: {
        "application/json": {
          schema: body,
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
            schema: responses,
          },
        },
      },
    };
  }

  public getSchemaContent({
    paramsType,
    pathParamsType,
    bodyType,
    responseType,
  }) {
    let params = this.openapiDefinitions[paramsType];
    let pathParams = this.openapiDefinitions[pathParamsType];
    let body = this.openapiDefinitions[bodyType];
    let responses = this.openapiDefinitions[responseType];

    if (paramsType && !params) {
      this.findSchemaDefinition(paramsType, "params");
      params = this.openapiDefinitions[paramsType];
    }

    if (pathParamsType && !pathParams) {
      this.findSchemaDefinition(pathParamsType, "pathParams");
      pathParams = this.openapiDefinitions[pathParamsType];
    }

    if (bodyType && !body) {
      this.findSchemaDefinition(bodyType, "body");
      body = this.openapiDefinitions[bodyType];
    }

    if (responseType && !responses) {
      this.findSchemaDefinition(responseType, "response");
      responses = this.openapiDefinitions[responseType];
    }

    return {
      params,
      pathParams,
      body,
      responses,
    };
  }
}
