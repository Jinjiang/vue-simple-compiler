import type { RawSourceMap } from 'source-map';
import { parse } from 'vue/compiler-sfc';

import type { CompilerOptions, CompileResult, Context } from './types';
import { COMP_ID } from './constants';
import { resolveImports } from './transform';
import { bundleSourceMap } from './map';
import { createContext, resolveFeatures } from './context';
import { resolveScript } from './script';
import { resolveTemplate } from './template';
import { resolveStyles } from './style';

const getErrorResult = (
  errors: (string | Error)[],
  filename: string
): CompileResult => ({
  js: { filename, code: '' },
  css: [],
  externalJs: [],
  externalCss: [],
  errors: errors.map((error) =>
    typeof error === 'string' ? new Error(error) : error
  ),
});

/**
 * NOTICE: this API is experimental and may change without notice.
 * Compile a vue file into JavaScript and CSS.
 *
 * @param source the source code of the vue file
 * @param options the compilation options
 */
export const compile = (
  source: string,
  options?: CompilerOptions
): CompileResult => {
  const context: Context = createContext(source, options);

  // get the code structure
  const { descriptor, errors: mainCompilerErrors } = parse(source, {
    filename: context.filename,
  });
  if (mainCompilerErrors.length) {
    return getErrorResult(mainCompilerErrors, context.destFilename);
  }

  // get the features
  resolveFeatures(descriptor, context);

  const { result: scriptResult, errors: scriptErrors } = resolveScript(
    descriptor,
    context
  );
  const { result: templateResult, errors: templateErrors } = resolveTemplate(
    descriptor,
    context
  );
  const {
    files: cssFiles,
    importList: cssImportList,
    errors: styleErrors,
  } = resolveStyles(descriptor, context);

  const errors = [
    ...mainCompilerErrors,
    ...(scriptErrors ?? []),
    ...(templateErrors ?? []),
    ...(styleErrors ?? []),
  ];
  if (
    errors.length ||
    !scriptResult ||
    !templateResult ||
    !cssFiles ||
    !cssImportList
  ) {
    return getErrorResult(errors, context.destFilename);
  }

  // No source map update technically.
  const jsCode = context.options?.autoResolveImports
    ? resolveImports(scriptResult.code, context.options)
    : scriptResult.code;

  const initialSourceMap: RawSourceMap = {
    version: '3',
    file: context.destFilename,
    sources: [context.filename],
    names: [],
    mappings: '',
    sourcesContent: [source],
  };

  // assemble the final code
  const finalTransformedResult = bundleSourceMap([
    { code: cssImportList.join('\n'), sourceMap: initialSourceMap },
    { code: jsCode, sourceMap: scriptResult.sourceMap },
    { code: templateResult.code, sourceMap: templateResult.sourceMap },
    { code: context.addedCodeList.join('\n') },
    {
      code: context.addedProps
        .map(([key, value]) => `${COMP_ID}.${key} = ${value}`)
        .join('\n'),
    },
    { code: `export default ${COMP_ID}` },
  ]);

  return {
    js: {
      filename: context.destFilename,
      code: finalTransformedResult.code,
      sourceMap: finalTransformedResult.sourceMap,
    },
    css: cssFiles,
    externalJs: context.externalJsList,
    externalCss: context.externalCssList,
    errors: [],
  };
};
