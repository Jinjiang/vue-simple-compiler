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
import * as typescript from 'sucrase'
import * as sass from 'sass-embedded';
// @ts-ignore
import hashId from "hash-sum";

const ID = "__demo__";
const FILENAME = "anonymous.vue";

const COMP_ID = `__sfc__`;

const transformTS = (src: string): string => {
  return typescript.transform(src, {
    transforms: ['typescript']
  }).code
}

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
// TODO:
// - style[src=foo.css] -> foo.css
// - style[src=foo.sass] -> foo.sass.css
// - style[src=foo.css][scoped] -> foo.scoped.css
// - style[src=foo.css][module] -> foo.module.css
// - style[src=foo.sass][module] -> foo.sass.module.css
const getCssPath = (srcPath: string, index?: number): string =>
  `${srcPath}${typeof index === 'number' ? `.${index}.module` : ""}.css`;

const getDestPath = (srcPath: string): string =>
  srcPath.endsWith(".vue")
    ? `${srcPath}.js`
    : srcPath.replace(/\.(j|t)sx?$/, ".js");

const genCssImport = (cssPath: string, styleVar?: string): string =>
  styleVar
    ? `import ${styleVar} from './${cssPath}';`
    : `import './${cssPath}';`;

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

export type CompileResult = {
  js: CompileResultFile;
  css: CompileResultFile[];
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
  const addedCode: string[] = [];

  // get the features
  const scriptLang =
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang)
  features.hasTS = scriptLang === 'ts'
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
    addedCode.push("const cssModules= {}");
  }

  // handle <script>
  let jsCode = ''
  let jsBindings: BindingMetadata | undefined;
  if (descriptor.script || descriptor.scriptSetup) {
    if (scriptLang && scriptLang !== 'js' && scriptLang !== 'ts') {
      // TODO: support <script lang>
      throw new Error(`Unsupported script lang: ${scriptLang}`);
    } else {
      const expressionPlugins: SFCCompilerOptions['expressionPlugins'] = features.hasTS
        ? ['typescript']
        : undefined
      const scriptResult = compileScript( descriptor, {
        id,
        inlineTemplate: true,
        templateOptions: {
          compilerOptions: {
            expressionPlugins,
          }
        }
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
  let templateCode = ''
  if (descriptor.template && !descriptor.scriptSetup) {
    const templateResult = compileTemplate({
      id: `data-v-${id}`,
      filename,
      source: descriptor.template!.content,
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
    const cssCode =
      (style.lang === 'scss' || style.lang === 'sass')
        ? sass.compileString(style.content).css
        : style.content;
    if (style.src) {
      // TODO: support <style src>
      throw new Error(`Unsupported imported style: ${style.src}.`);
    } else if (style.lang && style.lang !== 'scss' && style.lang !== 'sass') {
      throw new Error(`Unsupported style lang: ${style.lang}.`);
    } else if (style.module) {
      const styleVar = `style${index}`;
      const destCssFilename = getCssPath(filename, index);
      // TODO: generate JSON file or object for CSS modules
      if (options?.autoImportCss) {
        cssImportList.push(genCssImport(destCssFilename, styleVar));
      } else {
        addedCode.push(`const ${styleVar} = {}`)
      }

      const name = typeof style.module === "string" ? style.module : "$style";
      addedCode.push(`cssModules["${name}"] = ${styleVar}`);

      const styleResult = compileStyle({
        id,
        filename,
        source: cssCode,
        scoped: style.scoped,
      });
      cssFileList.push({
        filename: destCssFilename,
        content: styleResult.code,
      });
    } else {
      const styleResult = compileStyle({
        id,
        filename,
        source: cssCode,
        scoped: style.scoped,
      });
      mainCssCodeList.push(styleResult.code);
    }
  });
  if (mainCssCodeList.length > 0) {
    const destCssFilename = getCssPath(filename)
    cssImportList.unshift(genCssImport(destCssFilename))
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
${addedCode.join("\n")}
${addedProps.map(([key, value]) => `${COMP_ID}.${key} = ${value}`).join("\n")}
export default ${COMP_ID}
  `.trim();

  const result: CompileResult = {
    js: {
      filename: destFilename,
      content: code,
    },
    css: cssFileList
  };

  return result;
};
