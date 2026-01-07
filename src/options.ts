import type { CompilerOptions as TsCompilerOptions } from 'typescript';
import type { SFCScriptCompileOptions, SFCTemplateCompileOptions } from 'vue/compiler-sfc';

import typescript from 'typescript';

import type { TsTransform } from './types.js';

export type FileResolver = (filename: string) => string;

export type CompilerOptions = {
  root?: string;
  filename?: string;
  resolver?: FileResolver;
  autoImportCss?: boolean;
  autoResolveImports?: boolean;
  isProd?: boolean;
  hmr?: boolean;
  tsCompilerOptions?: TsCompilerOptions;
  tsRuntime?: typeof typescript;
  tsTransform?: TsTransform;
  sfcScriptCompilerOptions?: Partial<SFCScriptCompileOptions>;
  sfcTemplateCompilerOptions?: Partial<SFCTemplateCompileOptions>;
  fs?: {
    fileExists(file: string): boolean;
    readFile(file: string): string | undefined;
    realpath?(file: string): string;
  };
};

// e.g. filename.vue__0.css
export const getCssPath = (srcPath: string, index: number, lang: string): string =>
  `${srcPath}__${index}.${lang}`;

// - style[src=foo.css] -> foo.css
// - style[src=foo.scss] -> foo.scss
// - style[src=foo.css][scoped] -> foo.css?scoped=true&id=xxx&lang.css
// - style[src=foo.css][module] -> foo.css?module=true&lang.module.css
// - style[src=foo.scss][module] -> foo.scss?module=true&lang.module.scss
export const getExternalCssPath = (
  srcPath: string,
  options: { scoped?: boolean; id?: string; module?: boolean }
): string => {
  // e.g. foo.css
  const filename = srcPath.split('/').pop() || '';
  // e.g. css
  const ext = filename.split('.').pop() || '';

  // validations
  if (['css', 'scss', 'sass', 'less'].includes(ext) === false) {
    throw new Error(`Unsupported CSS file: ${srcPath}`);
  }
  if (options.scoped && !options.id) {
    throw new Error(`Missing id for scoped CSS: ${srcPath}`);
  }
  if (options.scoped && options.module) {
    throw new Error(`Scoped CSS cannot be used with CSS modules: ${srcPath}`);
  }

  // normalizations
  if (options.scoped && options.id) {
    // to follow the current rules in @vitejs/plugin-vue and vue-loader
    // e.g. foo.css?vue&type=style&scoped=true&id=xxx&src=xxx&lang.css
    return `${srcPath}?vue&type=style&scoped=true&id=${options.id}&src=${options.id}&lang.${ext}`;
  }
  if (options.module) {
    // e.g. foo.css?module=true&lang.module.css
    return `${srcPath}?module=true&lang.module.${ext}`;
  }
  // e.g. foo.css
  return srcPath;
};

export const getDestPath = (srcPath: string): string =>
  srcPath.endsWith('.vue')
    ? `${srcPath}.js`
    : srcPath.replace(/\.(j|t)sx?$/, '.js');

export const genCssImport = (cssPath: string, styleVar?: string): string =>
  styleVar ? `import ${styleVar} from '${cssPath}';` : `import '${cssPath}';`;

export const checkExtensionName = (filename: string, ext: string[]): boolean =>
  ext.some((e) => filename.endsWith(`.${e}`));
