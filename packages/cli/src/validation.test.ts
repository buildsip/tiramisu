import { expect, it } from "bun:test";
import { parseValue } from "./parse-value";
import { insertSchema } from "./mcp/insert-memory";
import { updateSchema } from "./mcp/update-memory";
import { validateFrontmatter } from "./validate-frontmatter";

it.each([undefined, null, "", " \n\t", 42, {}, []].map((description) => ({ description })))(
  "rejects a missing or invalid description on insert and in stored metadata: $description",
  ({ description }) => {
    const frontmatter = { title: "Title", description, scope: ["."] };
    for (const parse of [
      () =>
        parseValue({
          schema: insertSchema,
          value: { body: "Content", frontmatter },
          label: "insert input",
        }),
      () =>
        validateFrontmatter({
          value: { ...frontmatter, id: "id", created: "2025-04-01" },
          config: {},
          path: "/repo/memory.md",
        }),
    ]) {
      expect(parse).toThrow("Provide a nonblank string briefly describing the memory's content.");
      expect(parse).toThrow("→ at frontmatter.description");
    }
  },
);

it.each([null, "", " \n\t", 42, {}, []].map((description) => ({ description })))(
  "rejects an invalid description patch: $description",
  ({ description }) => {
    expect(() =>
      parseValue({
        schema: updateSchema,
        value: { frontmatter: { description } },
        label: "update input",
      }),
    ).toThrow("→ at frontmatter.description");
  },
);

it("accepts descriptions without a length limit and excludes them from custom metadata", () => {
  const description = "A detailed memory description. ".repeat(1000);
  const frontmatter = { title: "Title", description, scope: ["."] };
  expect(insertSchema.parse({ body: "Content", frontmatter }).frontmatter.description).toBe(
    description,
  );
  expect(updateSchema.parse({ frontmatter: { description } }).frontmatter?.description).toBe(
    description,
  );
  expect(
    validateFrontmatter({
      value: { ...frontmatter, id: "id", created: "2025-04-01" },
      config: { frontmatter: { custom: { additionalProperties: false } } },
      path: "/repo/memory.md",
    }).description,
  ).toBe(description);
});

it.each([
  {
    field: "frontmatter.title",
    input: { title: " " },
    expected: "Expected a nonempty string for the memory title",
  },
  {
    field: "frontmatter.id",
    input: { id: null },
    expected: "Omit id",
  },
  {
    field: "frontmatter.created",
    input: { created: "2020-01-01" },
    expected: "Omit created",
  },
  {
    field: "frontmatter.scope",
    input: { scope: "apps/web" },
    expected: "Expected a nonempty array of repository-relative",
  },
  {
    field: "frontmatter.scope",
    input: { scope: [] },
    expected: "Expected a nonempty array of repository-relative",
  },
  {
    field: "frontmatter.scope[1]",
    input: { scope: ["apps/web", 42] },
    expected: "Expected a repository-relative file or directory path",
  },
  {
    field: "frontmatter.scope[1]",
    input: { scope: ["apps/web", "../outside"] },
    expected: "absolute paths, exclusions, and .. are not allowed",
  },
  {
    field: "frontmatter.scope[1]",
    input: { scope: ["apps/web", "apps/*"] },
    expected: "Globs are not supported",
  },
  {
    field: "frontmatter.doNotEdit",
    input: { doNotEdit: "true" },
    expected: "Expected a boolean: true or false",
  },
  {
    field: "frontmatter.doNotDelete",
    input: { doNotDelete: null },
    expected: "Expected a boolean: true or false",
  },
])("gives a self-contained correction for $field: $input", ({ field, input, expected }) => {
  expect(() =>
    parseValue({
      schema: insertSchema,
      label: "insert input",
      value: {
        body: "Markdown",
        frontmatter: {
          description: "A memory description.",
          title: "Title",
          scope: ["."],
          ...input,
        },
      },
    }),
  ).toThrow(
    new RegExp(
      `${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\n]*\n  → at ${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\n|$)`,
    ),
  );
});

it("reports all missing fields together with their expected contents", () => {
  expect(() =>
    parseValue({ schema: insertSchema, label: "insert input", value: { frontmatter: {} } }),
  ).toThrow(
    /Expected a nonempty string[^\n]*\n  → at body\n[\s\S]*Expected a nonempty string[^\n]*\n  → at frontmatter.title\n[\s\S]*Expected a nonempty array[^\n]*\n  → at frontmatter.scope/,
  );
});

it("names unknown top-level keys and explains where memory fields belong", () => {
  expect(() =>
    parseValue({
      schema: insertSchema,
      label: "insert input",
      value: {
        body: "Markdown",
        frontmatter: { description: "A memory description.", title: "Title", scope: ["."] },
        typo: true,
        custom: {},
      },
    }),
  ).toThrow(
    /Remove this unknown field.*Only body and frontmatter[^\n]*\n  → at typo\n[\s\S]*Remove this unknown field[^\n]*\n  → at custom/,
  );
});

it("reports the invalid entry in a stored scope array", () => {
  expect(() =>
    validateFrontmatter({
      value: {
        id: "id",
        description: "A memory description.",
        title: "Title",
        created: "2025-04-01",
        scope: ["apps/web", 1],
      },
      config: {},
      path: "/repo/memory.md",
    }),
  ).toThrow(
    /Expected a repository-relative file or directory path[^\n]*\n  → at frontmatter.scope\[1\]/,
  );
});

it.each(["apps/web", "*", []].map((scope) => ({ scope })))(
  "rejects stored scope outside the array contract: $scope",
  ({ scope }) => {
    expect(() =>
      validateFrontmatter({
        value: {
          id: "id",
          description: "A memory description.",
          title: "Title",
          created: "2025-04-01",
          scope,
        },
        config: {},
        path: "/repo/memory.md",
      }),
    ).toThrow("frontmatter.scope");
  },
);

it("requires stored id and created while allowing scope to be omitted", () => {
  const value = {
    id: "id",
    description: "A memory description.",
    title: "Title",
    created: "2025-04-01",
  };
  expect(validateFrontmatter({ value, config: {}, path: "/repo/memory.md" })).toEqual(value);
  expect(
    validateFrontmatter({
      value: {
        id: "id",
        description: "A memory description.",
        title: "Title",
        created: new Date(Date.UTC(2025, 3, 1)),
      },
      config: {},
      path: "/repo/memory.md",
    }),
  ).toEqual(value);
  expect(() =>
    validateFrontmatter({
      value: { title: "Title", description: "A memory description." },
      config: {},
      path: "/repo/memory.md",
    }),
  ).toThrow("frontmatter.id");
  expect(() =>
    validateFrontmatter({
      value: { id: "id", title: "Title", description: "A memory description." },
      config: {},
      path: "/repo/memory.md",
    }),
  ).toThrow("frontmatter.created");
  expect(() =>
    validateFrontmatter({
      value: {
        id: "id",
        description: "A memory description.",
        title: "Title",
        created: "2026-02-31",
      },
      config: {},
      path: "/repo/memory.md",
    }),
  ).toThrow("YYYY-MM-DD");
});

it("keeps Ajv custom schema validation and reports required fields, array indices, and enum choices", () => {
  expect(() =>
    validateFrontmatter({
      value: {
        id: "id",
        description: "A memory description.",
        title: "Title",
        created: "2025-04-01",
        status: "unknown",
        anchors: [42],
      },
      path: "/repo/memory.md",
      config: {
        frontmatter: {
          custom: {
            properties: {
              ticket: { type: "string", pattern: "^ENG-" },
              status: { enum: ["draft", "ready"] },
              anchors: { type: "array", items: { type: "string" } },
            },
            required: ["ticket"],
          },
        },
      },
    }),
  ).toThrow(
    /frontmatter.ticket: Expected this required field.*ENG-.*frontmatter.status: Expected one of \["draft","ready"\].*frontmatter.anchors\[0\]: must be string/,
  );
});

it("preserves Markdown whitespace and custom fields when parsing JSON input", () => {
  const value = {
    body: "  indented code\n\n",
    frontmatter: {
      description: "A memory description.",
      title: "Title",
      scope: ["."],
      ticket: "ENG-1",
      details: { anchors: ["a"] },
    },
  };
  expect(parseValue({ schema: insertSchema, label: "insert input", value })).toEqual(value);
});

it.each([
  { value: { path: "memory.md" }, field: "path", error: "Pass the memory path via --path" },
  { value: { body: "" }, field: "body", error: "Expected a nonempty string" },
  {
    value: { frontmatter: { title: " " } },
    field: "frontmatter.title",
    error: "Expected a nonempty string",
  },
  {
    value: { frontmatter: { scope: [] } },
    field: "frontmatter.scope",
    error: "Expected a nonempty array",
  },
  {
    value: { frontmatter: { id: "existing-id" } },
    field: "frontmatter.id",
    error: "Omit id",
  },
  {
    value: { frontmatter: { created: "2020-01-01" } },
    field: "frontmatter.created",
    error: "Omit created",
  },
  {
    value: { frontmatter: { title: null } },
    field: "frontmatter.title",
    error: "Expected a nonempty string",
  },
  {
    value: { id: "existing-id" },
    field: "id",
    error: "Remove this unknown field",
  },
  {
    value: { frontmatter: null },
    field: "frontmatter",
    error: "Expected an object",
  },
])("rejects invalid partial updates with a correction: $value", ({ value, field, error }) => {
  const parse = () => parseValue({ schema: updateSchema, value, label: "update input" });
  expect(parse).toThrow(error);
  expect(parse).toThrow(`→ at ${field}`);
});

it.each(["provided-id", null])("rejects caller-supplied IDs on insert: %s", (id) => {
  expect(() =>
    parseValue({
      schema: insertSchema,
      label: "insert input",
      value: {
        body: "body",
        frontmatter: { description: "A memory description.", title: "Title", scope: ["."], id },
      },
    }),
  ).toThrow(/Omit id[^\n]*\n  → at frontmatter.id/);
});

it.each(["2020-01-01", null])("rejects caller-supplied created dates on insert: %s", (created) => {
  expect(() =>
    parseValue({
      schema: insertSchema,
      label: "insert input",
      value: {
        body: "body",
        frontmatter: {
          description: "A memory description.",
          title: "Title",
          scope: ["."],
          created,
        },
      },
    }),
  ).toThrow(/Omit created[^\n]*\n  → at frontmatter.created/);
});

it("accepts an empty patch for a folder-name repair", () => {
  expect(parseValue({ schema: updateSchema, value: {}, label: "update input" })).toEqual({});
});
