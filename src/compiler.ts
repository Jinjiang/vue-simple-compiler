import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
  rewriteDefault,
  babelParse,
  BindingMetadata,
  CompilerOptions as SFCCompilerOptions,
SFCScriptBlock,
SFCBlock,
} from "vue/compiler-sfc";
import * as typescript from "sucrase";
import * as sass from "sass";
// @ts-ignore
import hashId from "hash-sum";
// The version of source-map is v0.6.x since:
// 1. source-map v0.7.x doesn't support sync APIs.
// 2. vue/compiler-sfc also uses source-map v0.6.x.
import { SourceMapConsumer, SourceMapGenerator, RawSourceMap } from "source-map";
import MagicString, { Bundle } from "magic-string";

const ID = "__demo__";
const FILENAME = "anonymous.vue";

const COMP_ID = `__sfc__`;

type TransformResult = {
  code: string;
  // The "version" inside is string type rather than number type
  // since it's based on source-map v0.6.x.
  sourceMap?: RawSourceMap;
}

// https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/compileTemplate.ts
const mergeSourceMap = (oldMap: RawSourceMap | undefined, newMap: RawSourceMap | undefined): RawSourceMap | undefined => {
  if (!oldMap) return newMap
  if (!newMap) return oldMap

  const oldMapConsumer = new SourceMapConsumer(oldMap)
  const newMapConsumer = new SourceMapConsumer(newMap)
  const mergedMapGenerator = new SourceMapGenerator()

  newMapConsumer.eachMapping(m => {
    if (m.originalLine == null) {
      return
    }

    const origPosInOldMap = oldMapConsumer.originalPositionFor({
      line: m.originalLine,
      column: m.originalColumn
    })

    if (origPosInOldMap.source == null) {
      return
    }

    mergedMapGenerator.addMapping({
      generated: {
        line: m.generatedLine,
        column: m.generatedColumn
      },
      original: {
        line: origPosInOldMap.line ?? 0, // map line
        // use current column, since the oldMap produced by @vue/compiler-sfc
        // does not
        column: m.originalColumn
      },
      source: origPosInOldMap.source,
      name: origPosInOldMap.name ?? ''
    })
  })

  // source-map's type definition is incomplete
  const generator = mergedMapGenerator as any
  ;(oldMapConsumer as any).sources.forEach((sourceFile: string) => {
    generator._sources.add(sourceFile)
    const sourceContent = oldMapConsumer.sourceContentFor(sourceFile)
    if (sourceContent != null) {
      mergedMapGenerator.setSourceContent(sourceFile, sourceContent)
    }
  })

  generator._sourceRoot = oldMap.sourceRoot
  generator._file = oldMap.file
  return generator.toJSON()
}

const bundleSourceMap = (list: TransformResult[]): TransformResult => {
  const bundle = new Bundle();
  list.forEach((item) => {
    // TODO: bundle source map
  });
  return {
    code: bundle.toString(),
    sourceMap: bundle.generateMap({ hires: true }) as unknown as RawSourceMap,
  };
};

const transformTS = (src: string) => {
  return typescript.transform(src, {
    transforms: ["typescript"],
  }) as TransformResult;
};

export type FileResolver = (filename: string) => string;

export type CompilerOptions = {
  filename?: string;
  resolver?: FileResolver;
  autoImportCss?: boolean;
  autoResolveImports?: boolean;
  isProd?: boolean;
};

type SFCFeatures = {
  hasStyle?: boolean;
  hasScoped?: boolean;
  hasCSSModules?: boolean;
  hasScriptSetup?: boolean;
  hasTemplate?: boolean;
  hasTS?: boolean;
};

// - plain css -> filename.vue.css
// - scoped css -> filename.vue.css
// - modules -> filename.vue.${index}.module.css
const getCssPath = (srcPath: string, index?: number): string =>
  `${srcPath}${typeof index === "number" ? `.${index}.module` : ""}.css`;

// - style[src=foo.css] -> foo.css
// - style[src=foo.scss] -> foo.scss
// - style[src=foo.css][scoped] -> foo.css?scoped=true&id=xxx
// - style[src=foo.css][module] -> foo.css?module=true
// - style[src=foo.scss][module] -> foo.scss?module=true
const getExternalCssPath = (srcPath: string, options: { scoped?: boolean; id?: string; module?: boolean }): string => {
  if (!srcPath.endsWith(".css") && !srcPath.endsWith(".scss")) {
    throw new Error(`Unsupported CSS file: ${srcPath}`);
  }
  if (options.scoped && !options.id) {
    throw new Error(`Missing id for scoped CSS: ${srcPath}`);
  }
  if (options.scoped && options.module) {
    throw new Error(`Scoped CSS cannot be used with CSS modules: ${srcPath}`);
  }
  const query: string[] = [];
  if (options.scoped && options.id) {
    query.push(`scoped=true`);
    query.push(`id=${options.id}`);
  } else if (options.module) {
    query.push(`module=true`);
  }
  return query.length ? `${srcPath}?${query.join("&")}` : srcPath;
}

const getDestPath = (srcPath: string): string =>
  srcPath.endsWith(".vue")
    ? `${srcPath}.js`
    : srcPath.replace(/\.(j|t)sx?$/, ".js");

const genCssImport = (cssPath: string, styleVar?: string): string =>
  styleVar
    ? `import ${styleVar} from '${cssPath}';`
    : `import '${cssPath}';`;

const checkExtensionName = (filename: string, ext: string[]): boolean =>
  ext.some((e) => filename.endsWith('.' + e));

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
const resolveImports = (
  code: string,
  cssImportList: string[],
  options?: CompilerOptions
): TransformResult => {
  const s = new MagicString(code);

  if (options?.autoResolveImports) {
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
  }

  if (options?.autoImportCss) {
    cssImportList.forEach((cssImport) => {
      s.prepend(cssImport);
    });
  }

  return {
    code: s.toString(),
    sourceMap: s.generateMap({ hires: true }) as unknown as RawSourceMap
  };
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

const debugBlock = ({ content, map }: SFCBlock) => {
  const info = new SourceMapConsumer(map!)
  console.log('-----------------')
  console.log(content)
  console.log('-----------------')
  console.log((info as any).sourcesContent[0])
  console.log('-----------------')
  console.log((info as any)._mappings)
  console.log('-----------------')
}

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
          // TODO: map: x (transformed.sourceMap + scriptBlock.position)
          // map = mergeSourceMap(map, transformed.sourceMap, scriptBlock.loc);
          jsCode = rewriteDefault(transformed.code, COMP_ID, expressionPlugins);
        } catch (error) {
          return getErrorResult([error as Error], destFilename);
        }
      } else {
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
    // templateResult.map: template source -> render function
    // TODO: map: x (templateResult.map + templateBlock.position)
    // map = mergeSourceMap(map, templateResult.map, descriptor.template.loc);
    templateCode = `${templateResult.code.replace(
      /\nexport (function|const) (render|ssrRender)/,
      `\n$1 render`
    )}\n${COMP_ID}.render = render`;
  }

  // handle <style>
  const cssImportList: string[] = [];
  const cssFileList: CompileResultFile[] = [];
  const mainCssCodeList: string[] = [];
  descriptor.styles.every((style, index) => {
    if (style.lang && style.lang !== "scss" && style.lang !== "sass") {
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

    let transformedCss: TransformResult;
    if (style.src) {
      transformedCss = { code: '' };
    } else if (style.lang === "scss" || style.lang === "sass") {
      try {
        const result = sass.compileString(style.content);
        transformedCss = {
          code: result.css,
          sourceMap: result.sourceMap,
        };
      } catch (error) {
        errors.push(error as Error);
        return false;
      }
    } else {
      transformedCss = { code: style.content };
    }

    let destCssCode = ''
    let styleMap: RawSourceMap | undefined;
    if (!style.src) {
      // TODO: env: add isProd
      const compiledStyle = compileStyle({
        id,
        filename,
        source: transformedCss.code,
        scoped: style.scoped,
        inMap: transformedCss.sourceMap,
      });
      // TODO: map: sass source map
      if (compiledStyle.errors.length) {
        errors.push(...compiledStyle.errors);
        return false;
      }
      destCssCode = compiledStyle.code;
      // styleMap = mergeSourceMap(map, compiledStyle.map);
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
        mainCssCodeList.push(destCssCode);
      }
    }

    return true;
  });
  if (errors.length) {
    return getErrorResult(errors, destFilename);
  }

  if (mainCssCodeList.length > 0) {
    const destCssFilename = getCssPath(filename);
    cssImportList.unshift(genCssImport(`./${destCssFilename}`));
    cssFileList.unshift({
      filename: destCssFilename,
      code: mainCssCodeList.join("\n"),
      // TODO: map: add for each main css code
    });
  }

  // resolve imports
  const resolvedJsCode = resolveImports(jsCode, cssImportList, options);
  
  // assemble the final code
  // TODO: map: + imports.lines
  // TODO: map: merge template
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
    resolvedJsCode,
    { code: templateCode, sourceMap: map },
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
