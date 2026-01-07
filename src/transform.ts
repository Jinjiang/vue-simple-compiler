import type { CompilerOptions as TsCompilerOptions } from 'typescript';
import typescript from 'typescript';
import { babelParse, MagicString } from 'vue/compiler-sfc';

import type { CompilerOptions, TransformResult } from './types.js';

import { FILENAME } from './constants.js';
import { getDestPath } from './options.js';

export type TsTransform = (src: string, options?: TsCompilerOptions, runtime?: typeof typescript) => TransformResult;

const defaultTsCompilerOptions: TsCompilerOptions = {
  module: typescript.ModuleKind.ESNext,
  target: typescript.ScriptTarget.ESNext,
  jsx: typescript.JsxEmit.Preserve,
};

export const tsTransform: TsTransform = (src, options, runtime) => {
  const result = (runtime || typescript).transpileModule(
    src, { compilerOptions: options || defaultTsCompilerOptions });
  return {
    code: result.outputText,
  };
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

  const resolver = options?.resolver ?? ((x: string) => x);
  const ast = babelParse(code, {
    sourceFilename: options?.filename ?? FILENAME,
    sourceType: 'module',
  }).program.body;

  ast.forEach((node) => {
    if (node.type === 'ImportDeclaration') {
      const srcPath = resolver(node.source.value);
      if (srcPath) {
        const destPath = getDestPath(srcPath);
        if (
          typeof node.source.start === 'number' &&
          typeof node.source.end === 'number'
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
