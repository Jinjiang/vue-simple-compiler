import type { CompilerOptions, CompileResult, Context } from "./types";

import { parse } from "vue/compiler-sfc";
// @ts-ignore
import hashId from "hash-sum";

import { getDestPath } from "./options";
import { COMP_ID, FILENAME, ID, resolveImports } from "./transform";
import { bundleSourceMap } from "./map";
import { resolveFeatures } from "./features";
import { resolveScript } from "./script";
import { resolveTemplate } from "./template";
import { resolveStyles } from "./style";

const getErrorResult = (errors: (string | Error)[], filename?: string): CompileResult => ({
  js: { filename: filename ?? FILENAME, code: "" },
  css: [],
  externalJs: [],
  externalCss: [],
  errors: errors.map(
    error => typeof error === 'string' ? new Error(error) : error
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
  const context: Context = {
    filename: options?.filename ?? FILENAME,
    id: options?.filename ? hashId(options.filename + source) : ID,
    destFilename: getDestPath(options?.filename ?? FILENAME),
    options: options ?? {},
    features: {},
    addedProps: [],
    addedCodeList: [],
    externalJsList: [],
    externalCssList: [],
    bindingMetadata: undefined,
  }

  // get the code structure
  // - descriptor.template { map, type, attrs, content, loc, ast }
  // - descriptor.script { map, type, attrs, content, loc, setup }
  // - descriptor.scriptSetup  { type, attrs, content, loc, setup }
  // - descriptor.style[] { map, type, attrs, content, loc }
  // - descriptor { filename, source, cssVars, slotted, customBlocks, shouldForceReload }
  const { descriptor, errors: mainCompilerErrors } = parse(source, { filename: context.filename });
  if (mainCompilerErrors.length) {
    return getErrorResult(mainCompilerErrors, context.destFilename);
  }

  // get the features
  resolveFeatures(descriptor, context);
  
  try {
    const scriptResult = resolveScript(descriptor, context);
    const templateResult = resolveTemplate(descriptor, context);
    const cssResult = resolveStyles(descriptor, context);

    // No source map update technically.
    const jsCode = context.options?.autoResolveImports
      ? resolveImports(scriptResult.code, context.options)
      : scriptResult.code;

    // assemble the final code
    // TODO: add __file in dev mode
    // TODO: add hotReload(id, request) in dev mode
    // /* hot reload */
    // if (module.hot) {
    //   __exports__.__hmrId = "${id}"
    //   const api = __VUE_HMR_RUNTIME__
    //   module.hot.accept()
    //   if (!api.createRecord('${id}', __exports__)) {
    //     api.reload('${id}', __exports__)
    //   }
    //   if (request) {
    //     module.hot.accept(${request}, () => {
    //       api.rerender('${id}', render)
    //     })
    //   }
    // }

    const finalTransformedResult = bundleSourceMap([
      { code: cssResult.importList.join('\n') },
      { code: jsCode, sourceMap: scriptResult.sourceMap },
      { code: templateResult.code, sourceMap: templateResult.sourceMap },
      { code: context.addedCodeList.join("\n") },
      { code: context.addedProps.map(([key, value]) => `${COMP_ID}.${key} = ${value}`).join("\n") },
      { code: `export default ${COMP_ID}` },
    ])

    return {
      js: {
        filename: context.destFilename,
        code: finalTransformedResult.code,
        sourceMap: finalTransformedResult.sourceMap,
      },
      css: cssResult.files,
      externalJs: context.externalJsList,
      externalCss: context.externalCssList,
      errors: [],
    };
  } catch (error) {
    // TODO: better error handling
    const errors = Array.isArray(error) ? error : [error];
    throw getErrorResult(errors, context.destFilename);
  }
};
