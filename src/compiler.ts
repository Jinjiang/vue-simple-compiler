import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
  rewriteDefault,
  BindingMetadata,
  CompilerOptions as SFCCompilerOptions,
  SFCScriptBlock,
} from "vue/compiler-sfc";
// @ts-ignore
import hashId from "hash-sum";

import { checkExtensionName, CompilerOptions, genCssImport, getCssPath, getDestPath, getExternalCssPath } from "./options";
import { COMP_ID, FILENAME, ID, resolveImports, TransformResult, transformTS } from "./transform";
import { chainSourceMap, bundleSourceMap, RawSourceMap } from "./map";

type SFCFeatures = {
  hasStyle?: boolean;
  hasScoped?: boolean;
  hasCSSModules?: boolean;
  hasScriptSetup?: boolean;
  hasTemplate?: boolean;
  hasTS?: boolean;
};

export type CompileResultFile = {
  filename: string;
} & TransformResult;

export type CompileResultExternalFile = {
  filename: string;
  query: Record<string, string>;
};

export type CompileResult = {
  js: CompileResultFile;
  css: CompileResultFile[];
  externalJs: CompileResultExternalFile[];
  externalCss: CompileResultExternalFile[];
  errors: Error[];
};

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
  const errors: Error[] = [];
  let map: RawSourceMap | undefined;
  let templateMap: RawSourceMap | undefined;

  const filename = options?.filename ?? FILENAME;
  const destFilename = getDestPath(filename);
  const id = options?.filename ? hashId(filename + source) : ID;

  // get the code structure
  // - descriptor.template { map, type, attrs, content, loc, ast }
  // - descriptor.script { map, type, attrs, content, loc, setup }
  // - descriptor.scriptSetup  { type, attrs, content, loc, setup }
  // - descriptor.style[] { map, type, attrs, content, loc }
  // - descriptor { filename, source, cssVars, slotted, customBlocks, shouldForceReload }
  const { descriptor, errors: mainCompilerErrors } = parse(source, { filename });
  if (errors.length) {
    return getErrorResult(mainCompilerErrors, destFilename);
  }
  const features: SFCFeatures = {};
  const addedProps: Array<[key: string, value: string]> = [];
  const addedCodeList: string[] = [];
  const externalJsList: CompileResultExternalFile[] = [];
  const externalCssList: CompileResultExternalFile[] = [];

  // get the features
  const scriptLang =
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang) || 'js';
  features.hasTS = scriptLang === "ts";
  descriptor.styles.some((style) => {
    if (style.scoped) {
      features.hasScoped = true;
    }
    if (style.module) {
      features.hasCSSModules = true;
    }
    features.hasStyle = true;
    return features.hasScoped && features.hasCSSModules && features.hasStyle;
  });
  addedProps.push(["__file", JSON.stringify(filename)]);
  if (features.hasScoped) {
    addedProps.push(["__scopeId", JSON.stringify(`data-v-${id}`)]);
  }
  if (features.hasCSSModules) {
    addedProps.push(["__cssModules", `cssModules`]);
    addedCodeList.push("const cssModules= {}");
  }

  // handle <script>
  let jsCode = "";
  let jsBindings: BindingMetadata | undefined;
  if (descriptor.script || descriptor.scriptSetup) {
    if (scriptLang !== "js" && scriptLang !== "ts") {
      return getErrorResult([new Error(`Unsupported script lang: ${scriptLang}`)], destFilename);
    } else if (descriptor.scriptSetup?.src) {
      return getErrorResult([new Error(`Unsupported external script setup: ${descriptor.scriptSetup.src}`)], destFilename);
    } else if (descriptor.script?.src) {
      if (!checkExtensionName(descriptor.script.src, [scriptLang])) {
        return getErrorResult([new Error(`The extension name doesn't match the script language "${scriptLang}": ${descriptor.script.src}.`)], destFilename);
      }
      externalJsList.push({
        filename: descriptor.script.src,
        query: {},
      });
      jsCode = `import ${COMP_ID} from ${JSON.stringify(descriptor.script.src)}`;
    } else {
      const expressionPlugins: SFCCompilerOptions["expressionPlugins"] =
        features.hasTS ? ["typescript"] : undefined;
      let scriptBlock: SFCScriptBlock;
      try {
        // TODO: env: add isProd
        scriptBlock = compileScript(descriptor, {
          id,
          inlineTemplate: true,
          templateOptions: {
            compilerOptions: {
              expressionPlugins,
            },
          },
        });
        // debugBlock(scriptBlock)
      } catch (error) {
        return getErrorResult([error as Error], destFilename);
      }
      // basic source map
      map = scriptBlock.map;
      if (features.hasTS) {
        try {
          const transformed = transformTS(scriptBlock.content);
          map = chainSourceMap(map, transformed.sourceMap);
          jsCode = rewriteDefault(transformed.code, COMP_ID, expressionPlugins);
        } catch (error) {
          return getErrorResult([error as Error], destFilename);
        }
      } else {
        // No source map update technically.
        jsCode = rewriteDefault(scriptBlock.content, COMP_ID, expressionPlugins);
      }
      jsBindings = scriptBlock.bindings;
    }
  } else {
    jsCode = `const ${COMP_ID} = {}`;
  }

  // handle <template>
  let templateCode = "";
  if (descriptor.template && !descriptor.scriptSetup) {
    if (descriptor.template.lang && descriptor.template.lang !== "html") {
      return getErrorResult([new Error(`Unsupported template lang: ${descriptor.template.lang}`)], destFilename);
    }
    if (descriptor.template.src) {
      return getErrorResult([new Error(`Unsupported external template: ${descriptor.template.src}.`)], destFilename);
    }
    // TODO: env: add isProd
    const templateResult = compileTemplate({
      id: `data-v-${id}`,
      filename,
      source: descriptor.template.content,
      scoped: features.hasScoped,
      compilerOptions: {
        bindingMetadata: jsBindings,
      },
    });
    if (templateResult.errors.length) {
      return getErrorResult(templateResult.errors, destFilename);
    }
    // No source map update technically.
    templateCode = `${templateResult.code.replace(
      /\nexport (function|const) (render|ssrRender)/,
      `\n$1 render`
    )}\n${COMP_ID}.render = render`;
    templateMap = templateResult.map;
  }

  // handle <style>
  const cssImportList: string[] = [];
  const cssFileList: CompileResultFile[] = [];
  const mainCssBlockList: TransformResult[] = [];
  descriptor.styles.every((style, index) => {
    if (style.lang && style.lang !== "css" && style.lang !== "scss" && style.lang !== "sass") {
      errors.push(new Error(`Unsupported style lang: ${style.lang}.`));
      return false;
    } else if (style.src) {
      if (
        (!style.lang || style.lang === 'css') &&
        !checkExtensionName(style.src, ["css"])
      ) {
        errors.push(new Error(`The extension name doesn't match the style language "css": ${style.src}.`));
        return false;
      }
      if (
        (style.lang === 'sass' || style.lang === 'scss') &&
        !checkExtensionName(style.src, ["scss", "sass"])
      ) {
        errors.push(new Error(`The extension name doesn't match the style language "scss/sass": ${style.src}.`));
        return false;
      }
      const externalCss: CompileResultExternalFile = {
        filename: style.src,
        query: {},
      }
      if (style.module) {
        externalCss.query.module = style.module.toString();
      }
      if (style.scoped) {
        externalCss.query.scoped = style.scoped.toString();
        externalCss.query.id = id.toString();
      }
      externalCssList.push(externalCss);
    }

    let preprocessLang: 'scss' | 'sass' | undefined;
    if (style.lang === 'scss' || style.lang === 'sass') {
      preprocessLang = style.lang;
    }

    let destCssCode = ''
    let styleMap: RawSourceMap | undefined;
    if (!style.src) {
      // TODO: env: add isProd
      const compiledStyle = compileStyle({
        id,
        filename,
        source: style.content,
        scoped: style.scoped,
        inMap: style.map,
        preprocessLang,
      });
      if (compiledStyle.errors.length) {
        errors.push(...compiledStyle.errors);
        return false;
      }
      destCssCode = compiledStyle.code;
      styleMap = compiledStyle.map;
    }

    if (style.module) {
      // e.g. `style0`
      const styleVar = `style${index}`;
      const destCssFilePath =
        style.src
          // e.g. `./foo.css?module=true`
          ? getExternalCssPath(style.src, { module: true })
          // e.g. `./filename.vue.0.module.css`
          : `./${getCssPath(filename, index)}`;

      if (options?.autoImportCss) {
        // e.g. `import style0 from './foo.css?module=true';`
        // e.g. `import style0 from './filename.vue.0.module.css';`
        cssImportList.push(genCssImport(destCssFilePath, styleVar));
      } else {
        // only for simple testing purposes
        // e.g. `const style0 = new Proxy({}, { get: (_, key) => key })`
        addedCodeList.push(`const ${styleVar} = new Proxy({}, { get: (_, key) => key })`);
      }

      const name = typeof style.module === "string" ? style.module : "$style";
      // e.g. `cssModules["style0"] = style0;`
      addedCodeList.push(`cssModules["${name}"] = ${styleVar}`);
      // TODO: hmr: add cssModules(name, styleVar, request) in dev mode
      // /* hot reload */
      // if (module.hot) {
      //   module.hot.accept(${request}, () => {
      //     cssModules["${name}"] = ${styleVar}
      //     __VUE_HMR_RUNTIME__.rerender("${id}")
      //   })
      // }

      if (!style.src) {
        cssFileList.push({
          filename: getCssPath(filename, index),
          code: destCssCode,
          sourceMap: styleMap,
        });
      }
    } else {
      if (style.src) {
        if (options?.autoImportCss) {
          // e.g. `./foo.css?id=123`
          // e.g. `./foo.css?scoped=true&id=123`
          const cssPath = getExternalCssPath(style.src, { scoped: style.scoped, id });
          // e.g. `import './foo.css?id=123';`
          // e.g. `import './foo.css?scoped=true&id=123';`
          cssImportList.push(genCssImport(cssPath));
        }
      } else {
        mainCssBlockList.push({
          code: destCssCode,
          sourceMap: styleMap
        });
      }
    }

    return true;
  });
  if (errors.length) {
    return getErrorResult(errors, destFilename);
  }

  if (mainCssBlockList.length > 0) {
    const destCssFilename = getCssPath(filename);
    cssImportList.unshift(genCssImport(`./${destCssFilename}`));
    const mainCssTransformedResult = bundleSourceMap(mainCssBlockList)
    cssFileList.unshift({
      filename: destCssFilename,
      ...mainCssTransformedResult,
    });
  }

  // auto-resolve imports
  if (options?.autoResolveImports) {
    // No source map update technically.
    jsCode = resolveImports(jsCode, options);
  }
  
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
    { code: cssImportList.join('\n') },
    { code: jsCode, sourceMap: map },
    { code: templateCode, sourceMap: templateMap },
    { code: addedCodeList.join("\n") },
    { code: addedProps.map(([key, value]) => `${COMP_ID}.${key} = ${value}`).join("\n") },
    { code: `export default ${COMP_ID}` },
  ])

  const result: CompileResult = {
    js: {
      filename: destFilename,
      code: finalTransformedResult.code,
      sourceMap: finalTransformedResult.sourceMap,
    },
    css: cssFileList,
    externalJs: externalJsList,
    externalCss: externalCssList,
    errors,
  };

  return result;
};
