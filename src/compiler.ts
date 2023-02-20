import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
  rewriteDefault,
  babelParse,
  MagicString,
  BindingMetadata,
  CompilerOptions as SFCCompilerOptions,
} from "vue/compiler-sfc";
import * as typescript from "sucrase";
import * as sass from "sass-embedded";
// @ts-ignore
import hashId from "hash-sum";

const ID = "__demo__";
const FILENAME = "anonymous.vue";

const COMP_ID = `__sfc__`;

const transformTS = (src: string): string => {
  return typescript.transform(src, {
    transforms: ["typescript"],
  }).code;
};

export type FileResolver = (filename: string) => string;

export type CompilerOptions = {
  filename?: string;
  resolver?: FileResolver;
  autoImportCss?: boolean;
  autoResolveImports?: boolean;
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
 * @returns the resolved code
 */
const resolveImports = (
  code: string,
  cssImportList: string[],
  options?: CompilerOptions
): string => {
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

  return s.toString();
};

export type CompileResultFile = {
  filename: string;
  content: string;
};

export type CompileResultExternalFile = {
  filename: string;
  query: Record<string, string>;
};

export type CompileResult = {
  js: CompileResultFile;
  css: CompileResultFile[];
  externalJs: CompileResultExternalFile[];
  externalCss: CompileResultExternalFile[];
};

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
  const filename = options?.filename ?? FILENAME;
  const destFilename = getDestPath(filename);
  const id = options?.filename ? hashId(options?.filename) : ID;

  // get the code structure
  const { descriptor } = parse(source);
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
      throw new Error(`Unsupported script lang: ${scriptLang}`);
    } else if (descriptor.scriptSetup?.src) {
      throw new Error(`Unsupported external script setup: ${descriptor.scriptSetup.src}.`);
    } else if (descriptor.script?.src) {
      if (!checkExtensionName(descriptor.script.src, [scriptLang])) {
        throw new Error(`The extension name doesn't match the script language "${scriptLang}": ${descriptor.script.src}.`);
      }
      externalJsList.push({
        filename: descriptor.script.src,
        query: {},
      });
      jsCode = `import ${COMP_ID} from ${JSON.stringify(descriptor.script.src)}`;
    } else {
      const expressionPlugins: SFCCompilerOptions["expressionPlugins"] =
        features.hasTS ? ["typescript"] : undefined;
      const scriptResult = compileScript(descriptor, {
        id,
        inlineTemplate: true,
        templateOptions: {
          compilerOptions: {
            expressionPlugins,
          },
        },
      });
      const jsContent = features.hasTS
        ? transformTS(scriptResult.content)
        : scriptResult.content;
      jsCode = rewriteDefault(jsContent, COMP_ID, expressionPlugins);
      jsBindings = scriptResult.bindings;
    }
  } else {
    jsCode = `const ${COMP_ID} = {}`;
  }

  // handle <template>
  let templateCode = "";
  if (descriptor.template && !descriptor.scriptSetup) {
    if (descriptor.template.lang && descriptor.template.lang !== "html") {
      throw new Error(`Unsupported template lang: ${descriptor.template.lang}`);
    }
    if (descriptor.template.src) {
      throw new Error(`Unsupported external template: ${descriptor.template.src}.`);
    }
    const templateResult = compileTemplate({
      id: `data-v-${id}`,
      filename,
      source: descriptor.template.content,
      scoped: features.hasScoped,
      compilerOptions: {
        bindingMetadata: jsBindings,
      },
    });
    templateCode = `${templateResult.code.replace(
      /\nexport (function|const) (render|ssrRender)/,
      `$1 render`
    )}\n${COMP_ID}.render = render`;
  }

  // handle <style>
  const cssImportList: string[] = [];
  const cssFileList: CompileResultFile[] = [];
  const mainCssCodeList: string[] = [];
  descriptor.styles.forEach((style, index) => {
    if (style.lang && style.lang !== "scss" && style.lang !== "sass") {
      throw new Error(`Unsupported style lang: ${style.lang}.`);
    } else if (style.src) {
      if (
        (!style.lang || style.lang === 'css') &&
        !checkExtensionName(style.src, ["css"])
      ) {
        throw new Error(`The extension name doesn't match the style language "css": ${style.src}.`);
      }
      if (
        (style.lang === 'sass' || style.lang === 'scss') &&
        !checkExtensionName(style.src, ["scss", "sass"])
      ) {
        throw new Error(`The extension name doesn't match the style language "scss/sass": ${style.src}.`);
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

    const cssCode =
      style.src
        ? ''
        : style.lang === "scss" || style.lang === "sass"
          ? sass.compileString(style.content).css
          : style.content;
    const destCssCode =
      style.src
        ? ''
        : compileStyle({
            id,
            filename,
            source: cssCode,
            scoped: style.scoped,
          }).code;

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

      if (!style.src) {
        cssFileList.push({
          filename: getCssPath(filename, index),
          content: destCssCode,
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
  });
  if (mainCssCodeList.length > 0) {
    const destCssFilename = getCssPath(filename);
    cssImportList.unshift(genCssImport(`./${destCssFilename}`));
    cssFileList.unshift({
      filename: destCssFilename,
      content: mainCssCodeList.join("\n"),
    });
  }

  // resolve imports
  const resolvedJsCode = resolveImports(jsCode, cssImportList, options);

  // assemble the final code
  const code = `
${resolvedJsCode}
${templateCode}
${addedCodeList.join("\n")}
${addedProps.map(([key, value]) => `${COMP_ID}.${key} = ${value}`).join("\n")}
export default ${COMP_ID}
  `.trim();

  const result: CompileResult = {
    js: {
      filename: destFilename,
      content: code,
    },
    css: cssFileList,
    externalJs: externalJsList,
    externalCss: externalCssList,
  };

  return result;
};
