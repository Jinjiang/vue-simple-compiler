export type FileResolver = (filename: string) => string;

export type CompilerOptions = {
  root?: string;
  filename?: string;
  resolver?: FileResolver;
  autoImportCss?: boolean;
  autoResolveImports?: boolean;
  isProd?: boolean;
  hmr?: boolean;
};

// - plain css -> filename.vue.css
// - scoped css -> filename.vue.css
// - modules -> filename.vue.${index}.module.css
export const getCssPath = (srcPath: string, index?: number): string =>
  `${srcPath}${typeof index === "number" ? `.${index}.module` : ""}.css`;

// - style[src=foo.css] -> foo.css
// - style[src=foo.scss] -> foo.scss
// - style[src=foo.css][scoped] -> foo.css?scoped=true&id=xxx
// - style[src=foo.css][module] -> foo.css?module=true
// - style[src=foo.scss][module] -> foo.scss?module=true
export const getExternalCssPath = (srcPath: string, options: { scoped?: boolean; id?: string; module?: boolean }): string => {
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

export const getDestPath = (srcPath: string): string =>
  srcPath.endsWith(".vue")
    ? `${srcPath}.js`
    : srcPath.replace(/\.(j|t)sx?$/, ".js");

export const genCssImport = (cssPath: string, styleVar?: string): string =>
  styleVar
    ? `import ${styleVar} from '${cssPath}';`
    : `import '${cssPath}';`;

export const checkExtensionName = (filename: string, ext: string[]): boolean =>
  ext.some((e) => filename.endsWith('.' + e));
