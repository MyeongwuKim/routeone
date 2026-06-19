import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: ["../api/src/schema.ts", "../api/src/modules/**/*.resolver.ts"],
  documents: "src/graphql/**/*.graphql",
  generates: {
    "src/generated/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: true,
        },
        enumsAsTypes: true,
        scalars: {
          DateTime: "string",
        },
        useTypeImports: true,
      },
    },
  },
};

export default config;
