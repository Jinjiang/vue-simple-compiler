import type { CompilerOptions, TransformResult } from "./types";

import * as typescript from "sucrase";
import { babelParse, MagicString } from "vue/compiler-sfc";

import { FILENAME } from "./constants";
import { getDestPath } from "./options";

export const transformTS = (src: string) => {
  return typescript.transform(src, {
    transforms: ["typescript"],
  }) as unknown as TransformResult;
};

/**
 * Resolve all the import statements in the generated code.
 * 1. `*.js` `*.jsx` `*.ts` `*.tsx` -> `*.js`
 * 2. `*.vue` -> `*.vue.js`
 * 3. prepend all the CSS imports
 *
 * @param code the generated code from vue/compiler-sfc
 * @param cssImportList an array of css import strings to prepend
 * @param options the compiler options
 * @returns the resolved code, including content and source map
 */
export const resolveImports = (
  code: string,
  options?: CompilerOptions
): string => {
  const s = new MagicString(code);

  const resolver = options?.resolver ?? ((x) => x);
  const ast = babelParse(code, {
    sourceFilename: options?.filename ?? FILENAME,
    sourceType: "module",
  }).program.body;

  ast.forEach((node) => {
    if (node.type === "ImportDeclaration") {
      const srcPath = resolver(node.source.value);
      if (srcPath) {
        const destPath = getDestPath(srcPath);
        if (
          typeof node.source.start === "number" &&
          typeof node.source.end === "number"
        ) {
          s.overwrite(
            node.source.start,
            node.source.end,
            JSON.stringify(destPath)
          );
        }
      }
    }
  });

  return s.toString();
};
