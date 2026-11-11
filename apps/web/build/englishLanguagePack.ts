/** 영어 문구를 앱 코드와 별개인 해시 기반 파일로 발행하고 HTML에 주소를 기록한다. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { Plugin } from "vite";

const sourceFile = new URL("../src/lib/ui-text/en.ts", import.meta.url);

function buildPack() {
  const { outputText } = ts.transpileModule(readFileSync(sourceFile, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const hash = createHash("sha256").update(outputText).digest("hex");
  return { outputText, path: `language-packs/en-${hash}.mjs` };
}

export function englishLanguagePack(publicBaseUrl: string): Plugin {
  const builtPack = buildPack();
  const base = publicBaseUrl.replace(/\/+$/, "");

  return {
    name: "masil-english-language-pack",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: builtPack.path, source: builtPack.outputText });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/language-packs/")) return next();
        const pack = buildPack();
        if (req.url !== `/${pack.path}`) return next();
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.end(pack.outputText);
      });
    },
    transformIndexHtml(_html, context) {
      const pack = context.server ? buildPack() : builtPack;
      return [{
        tag: "meta",
        attrs: {
          name: "masil-english-pack",
          content: `${context.server ? "" : base}/${pack.path}`,
        },
        injectTo: "head",
      }];
    },
  };
}
