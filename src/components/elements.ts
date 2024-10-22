export const elementsDeps = ["@stoplight/element"];

export function ElementsUI(outputFile: string) {
  return `
"use client";

import { API } from "@stoplight/elements";
import "@stoplight/elements/styles.min.css";

export default function ApiDocsPage() {
  return (
    <section style={{ height: "100vh" }}>
      <API apiDescriptionUrl="${outputFile}" />
    </section>
  );
}
`;
}
