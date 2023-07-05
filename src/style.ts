import type { SFCDescriptor } from 'vue/compiler-sfc';

import type {
  CompileResultExternalFile,
  CompileResultFile,
  Context,
} from './types';

import {
  checkExtensionName,
  genCssImport,
  getCssPath,
  getExternalCssPath,
} from './options';

export const resolveStyles = (
  descriptor: SFCDescriptor,
  context: Context
): { files?: CompileResultFile[]; importList?: string[]; errors?: Error[] } => {
  const errors: Error[] = [];
  const cssImportList: string[] = [];
  const cssFileList: CompileResultFile[] = [];
  descriptor.styles.every((style, index) => {
    // validate lang
    if (
      style.lang &&
      style.lang !== 'css' &&
      style.lang !== 'scss' &&
      style.lang !== 'sass' &&
      style.lang !== 'less'
    ) {
      errors.push(new Error(`Unsupported style lang: ${style.lang}.`));
      return false;
    }

    // validate ext
    // collect external css files
    if (style.src) {
      if (
        (!style.lang || style.lang === 'css') &&
        !checkExtensionName(style.src, ['css'])
      ) {
        errors.push(
          new Error(
            `The extension name doesn't match the style language "css": ${style.src}.`
          )
        );
        return false;
      }
      if (
        (style.lang === 'sass' || style.lang === 'scss') &&
        !checkExtensionName(style.src, ['scss', 'sass'])
      ) {
        errors.push(
          new Error(
            `The extension name doesn't match the style language "scss/sass": ${style.src}.`
          )
        );
        return false;
      }
      if (style.lang === 'less' && !checkExtensionName(style.src, ['less'])) {
        errors.push(
          new Error(
            `The extension name doesn't match the style language "less": ${style.src}.`
          )
        );
        return false;
      }
      const externalCss: CompileResultExternalFile = {
        filename: style.src,
        query: {},
      };
      if (style.module) {
        externalCss.query.module = style.module.toString();
      }
      if (style.scoped) {
        externalCss.query.scoped = style.scoped.toString();
        externalCss.query.id = context.id.toString();
      }
      context.externalCssList.push(externalCss);
    }

    // e.g. `css`
    const lang = style.lang || 'css';
    // e.g. `style0` (only for css modules)
    const styleVar = style.module ? `style${index}` : '';
    // e.g. `./filename.vue__0.css` (only for non-src styles)
    const cssFilePath = getCssPath(context.filename, index, lang);

    // check css files
    if (!style.src) {
      cssFileList.push({
        filename: cssFilePath,
        code: style.content,
        sourceMap: style.map,
      });
    }

    // add js code for css modules
    if (style.module) {
      // e.g. `$style`
      const moduleName = typeof style.module === 'string' ? style.module : '$style';
      if (!context.options?.autoImportCss) {
        // work around for testing purposes
        // e.g. `const style0 = new Proxy({}, { get: (_, key) => key })`
        context.addedCodeList.push(`const ${styleVar} = new Proxy({}, { get: (_, key) => key })`);
      }
      // e.g. `cssModules["$style"] = style0`
      context.addedCodeList.push(`cssModules["${moduleName}"] = ${styleVar}`);
    }

    // check css imports
    // - scoped x module x src
    // - auto import css
    if (context.options?.autoImportCss) {
      const baseCssPath = style.src || `./${cssFilePath}`;
      const destCssFilePath = getExternalCssPath(
        baseCssPath,
        {
          module: !!style.module,
          scoped: style.scoped,
          id: context.id
        }
      );
      const cssImport = genCssImport(destCssFilePath, styleVar);
      cssImportList.push(cssImport);
    }

    return true;
  });

  if (errors.length) {
    return { errors };
  }

  return {
    importList: cssImportList,
    files: cssFileList,
  };
};
