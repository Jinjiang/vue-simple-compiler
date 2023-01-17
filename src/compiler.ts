import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
  rewriteDefault,
  babelParse,
  MagicString,
} from 'vue/compiler-sfc';
// @ts-ignore
import hashId from 'hash-sum';

const ID = '__demo__';
const FILENAME = 'anonymous.vue';

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

const getCssPath = (srcPath: string, isSsoped?: boolean): string => `${srcPath}${isSsoped ? '.scoped' : ''}.css`;

const getDestPath = (srcPath: string): string =>
  srcPath.endsWith('.vue') ? `${srcPath}.js` : srcPath.replace(/\.(j|t)sx?$/, '.js');

/**
 * Resolve all the import statements in the generated code.
 * 1. `*.js` `*.jsx` `*.ts` `*.tsx` -> `*.js`
 * 2. `*.vue` -> `*.vue.js`
 * 3. add `import '${filename}.css'` (like `anonymous.vue.css`) if `hasCSS`.
 *
 * @param code the generated code from vue/compiler-sfc
 * @param options the compiler options
 * @param hasCss whether the component has css code
 * @returns the resolved code
 */
const resolveImports = (code: string, options?: CompilerOptions, cssState?: {
  hasCss: boolean;
  hasScopedCss: boolean;
}): string => {
  const resolver = options?.resolver ?? ((x) => x);
  const s = new MagicString(code);
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

  if (options?.autoImportCss && cssState?.hasCss) {
    s.prepend(`import './${getCssPath(options?.filename ?? FILENAME)}';`);
  }
  if (options?.autoImportCss && cssState?.hasScopedCss) {
    s.prepend(`import './${getCssPath(options?.filename ?? FILENAME, true)}';`);
  }

  return s.toString();
};

export type CompileResultFile = {
  filename: string;
  content: string;
}

export type CompileResult = {
  js: CompileResultFile;
  css?: CompileResultFile;
  scopedCss?: CompileResultFile;
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
  addedProps.push(['__file', JSON.stringify(filename)])
  if (features.hasScoped) {
    addedProps.push(['__scopeId', JSON.stringify(`data-v-${id}`)])
  }
  // TODO: css modules
  if (features.hasCSSModules) {
    addedProps.push(['__cssModules', `cssModules`])
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
  const cssCodeList: string[] = []
  const scopedCssCodeList: string[] = []
  descriptor.styles.forEach((style) => {
    const styleResult = compileStyle({
      id,
      filename,
      source: style.content,
      scoped: style.scoped,
    });
    if (style.scoped) {
      scopedCssCodeList.push(styleResult.code)
    } else {
      cssCodeList.push(styleResult.code)
    }
  });
  const cssCode = cssCodeList.join('\n')
  const scopedCssCode = scopedCssCodeList.join('\n')

  // resolve imports
  const resolvedJsCode = resolveImports(jsCode, options, {
    hasCss: cssCode.trim().length > 0,
    hasScopedCss: scopedCssCode.trim().length > 0,
  });

  // assemble the final code
  const code = `
${resolvedJsCode}
${templateCode}
${addedProps.map(([key, value]) => `${COMP_ID}.${key} = ${value}`).join('\n')}
export default ${COMP_ID}
  `.trim();

  const result: CompileResult = {
    js: {
      filename: destFilename,
      content: code,
    }
  }
  if (cssCode.trim().length > 0) {
    result.css = {
      filename: getCssPath(filename),
      content: cssCode,
    }
  }
  if (scopedCssCode.trim().length > 0) {
    result.scopedCss = {
      filename: getCssPath(filename, true),
      content: scopedCssCode,
    }
  }

  return result
};
