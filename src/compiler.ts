import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
  rewriteDefault,
  babelParse,
  MagicString,
} from "vue/compiler-sfc";
// @ts-ignore
import hashId from "hash-sum";

const ID = "__demo__";
const FILENAME = "anonymous.vue";

const COMP_ID = `__sfc__`;

export type FileResolver = (filename: string) => string;

export type CompilerOptions = {
  filename?: string;
  resolver?: FileResolver;
  autoImportCss?: boolean;
};

type SFCFeatures = {
  hasStyle?: boolean;
  hasScoped?: boolean;
  hasCSSModules?: boolean;
  hasScriptSetup?: boolean;
  hasTemplate?: boolean;
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
  const resolver = options?.resolver ?? ((x) => x);
  const s = new MagicString(code);
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

  cssImportList.forEach((cssImport) => {
    s.prepend(cssImport);
  });

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
  const addedProps: Array<[key: string, value: string]> = [];
  const addedCode: string[] = [];
  addedProps.push(["__file", JSON.stringify(filename)]);
  if (features.hasScoped) {
    addedProps.push(["__scopeId", JSON.stringify(`data-v-${id}`)]);
  }
  if (features.hasCSSModules) {
    addedProps.push(["__cssModules", `cssModules`]);
  }

  // handle <script>
  const scriptResult = compileScript(descriptor, { id });
  const jsCode = rewriteDefault(scriptResult.content, COMP_ID);

  // handle <template>
  const templateResult = compileTemplate({
    id: `data-v-${id}`,
    filename,
    source: descriptor.template!.content,
    scoped: features.hasScoped,
    compilerOptions: {
      bindingMetadata: scriptResult.bindings,
    },
  });
  const templateCode = `${templateResult.code.replace(
    /\nexport (function|const) (render|ssrRender)/,
    `$1 render`
  )}\n${COMP_ID}.render = render`;

  // handle <style>
  const cssImportList: string[] = [];
  const cssFileList: CompileResultFile[] = [];
  const mainCssCodeList: string[] = [];
  descriptor.styles.forEach((style, index) => {
    if (style.src) {
      console.log("Sorry, we don't support <style src> yet.");
    } else if (style.lang) {
      console.log("Sorry, we don't support <style lang> yet.");
    } else if (style.module) {
      const styleVar = `style${index}`;
      const destFilename = getCssPath(filename, index);
      cssImportList.push(genCssImport(destFilename, styleVar));

      const name = typeof style.module === "string" ? style.module : "$style";
      addedCode.push(`cssModules["${name}"] = ${styleVar}`);

      const styleResult = compileStyle({
        id,
        filename,
        source: style.content,
        scoped: style.scoped,
      });
      cssFileList.push({
        filename: destFilename,
        content: styleResult.code,
      });
    } else {
      const styleResult = compileStyle({
        id,
        filename,
        source: style.content,
        scoped: style.scoped,
      });
      mainCssCodeList.push(styleResult.code);
    }
  });
  if (mainCssCodeList.length > 0) {
    const destFilename = getCssPath(filename)
    cssImportList.unshift(genCssImport(destFilename))
    cssFileList.unshift({
      filename: destFilename,
      content: mainCssCodeList.join("\n"),
    });
  }

  // resolve imports
  const resolvedJsCode = resolveImports(jsCode, cssImportList, options);

  // assemble the final code
  const code = `
${resolvedJsCode}
${templateCode}
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
