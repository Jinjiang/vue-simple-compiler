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

// TODO:
// 0. setup
// 1. scoped CSS
// 2. ts
// 3. Sass
// 4. source map

export type FileResolver = (filename: string) => string;

export type CompilerOptions = {
  filename?: string;
  resolver?: FileResolver;
};

const getCssPath = (srcPath: string): string => `${srcPath}.css`;

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
const resolveImports = (code: string, options?: CompilerOptions, hasCss?: boolean): string => {
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

  if (hasCss) {
    s.prepend(`import '${getCssPath(options?.filename ?? FILENAME)}';`);
  }

  return s.toString();
};

export const compile = (
  source: string,
  options?: CompilerOptions
): [string, string, string] => {
  const filename = options?.filename ?? FILENAME;
  const destFilename = getDestPath(filename);
  const id = options?.filename ? hashId(options?.filename) : ID;

  const { descriptor } = parse(source);

  const scriptResult = compileScript(descriptor, { id });
  const templateResult = compileTemplate({
    id,
    filename,
    source: descriptor.template!.content,
    compilerOptions: {
      bindingMetadata: scriptResult.bindings,
    },
  });
  const styleResult = descriptor.styles.map((style) => {
    return compileStyle({
      id,
      filename,
      source: style.content,
    });
  });

  const jsCode = rewriteDefault(scriptResult.content, COMP_ID);
  const templateCode = `${templateResult.code.replace(
    /\nexport (function|const) (render|ssrRender)/,
    `$1 render`
  )}\n${COMP_ID}.render = render`;
  const cssCode = styleResult.map((x) => x.code).join('\n');
  const resolvedJsCode = resolveImports(jsCode, options, cssCode.trim().length > 0);

  const code = `
${resolvedJsCode}
${templateCode}
${COMP_ID}.__file = ${JSON.stringify(filename)}
export default ${COMP_ID}
  `.trim();

  return [code, cssCode, destFilename];
};
