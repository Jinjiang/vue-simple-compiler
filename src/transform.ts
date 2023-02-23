import * as typescript from "sucrase";
import { SourceMapConsumer } from "source-map";
import { babelParse, MagicString, SFCBlock } from "vue/compiler-sfc";
import { CompilerOptions, getDestPath } from "./options";
import { FileInfo } from "./map";

export const ID = "__demo__";
export const FILENAME = "anonymous.vue";

export const COMP_ID = `__sfc__`;

export const debugBlock = ({ content, map }: SFCBlock) => {
  const info = new SourceMapConsumer(map!)
  console.log('-----------------')
  console.log(content)
  console.log('-----------------')
  console.log((info as any).sourcesContent[0])
  console.log('-----------------')
  console.log((info as any)._mappings)
  console.log('-----------------')
}

export type TransformResult = FileInfo

export const transformTS = (src: string) => {
  return typescript.transform(src, {
    transforms: ["typescript"],
  }) as TransformResult;
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
