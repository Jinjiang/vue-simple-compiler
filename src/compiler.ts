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

// TODO:
// 0. setup
// 1. scoped CSS
// 2. ts
// 3. Sass
// 4. source map

type FileResolver = (filename: string) => string;

type CompilerOptions = {
  filename?: string;
  resolver?: FileResolver;
};

const getDestPath = (srcPath: string): string =>
  srcPath.endsWith(".vue") ? srcPath + ".js" : srcPath.replace(/\.ts/, ".js");

const resolveImports = (code: string, options?: CompilerOptions): string => {
  const resolver = options?.resolver ?? ((x) => x);
  const s = new MagicString(code);
  const ast = babelParse(code, {
    sourceFilename: options?.filename ?? FILENAME,
    sourceType: "module",
  }).program.body;

  for (const node of ast) {
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
  const templateCode =
    templateResult.code.replace(
      /\nexport (function|const) (render|ssrRender)/,
      `$1 render`
    ) + `\n${COMP_ID}.render = render`;
  const cssCode = styleResult.map((x) => x.code).join("\n");
  const resolvedJsCode = resolveImports(jsCode, options);

  const code = `
${resolvedJsCode}
${templateCode}
${COMP_ID}.__file = ${JSON.stringify(filename)}
export default ${COMP_ID}
  `.trim();

  return [code, cssCode, destFilename];
};
