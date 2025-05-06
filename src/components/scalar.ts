export const scalarDeps = ["@scalar/api-reference-react", "ajv"];

export function ScalarUI(outputFile: string) {
  return `
"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";

import "@scalar/api-reference-react/style.css";

export default function ApiDocsPage() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "/${outputFile}",
      }}
    />
  );
}
`;
}
