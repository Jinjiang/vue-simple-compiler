import { compileStyle, SFCDescriptor } from "vue/compiler-sfc";
import { bundleSourceMap, RawSourceMap } from "./map";
import { checkExtensionName, genCssImport, getCssPath, getExternalCssPath } from "./options";
import { TransformResult } from "./transform";
import { CompileResultExternalFile, CompileResultFile, Context } from "./types";

export const resolveStyles = (descriptor: SFCDescriptor, context: Context): { files: CompileResultFile[]; importList: string[] } => {
  const errors: Error[] = [];
  const cssImportList: string[] = [];
  const cssFileList: CompileResultFile[] = [];
  const mainCssBlockList: TransformResult[] = [];
  descriptor.styles.every((style, index) => {
    if (style.lang && style.lang !== "css" && style.lang !== "scss" && style.lang !== "sass") {
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
        externalCss.query.id = context.id.toString();
      }
      context.externalCssList.push(externalCss);
    }

    let preprocessLang: 'scss' | 'sass' | undefined;
    if (style.lang === 'scss' || style.lang === 'sass') {
      preprocessLang = style.lang;
    }

    let destCssCode = ''
    let styleMap: RawSourceMap | undefined;
    if (!style.src) {
      // TODO: env: add isProd
      const compiledStyle = compileStyle({
        id: context.id,
        filename: context.filename,
        source: style.content,
        scoped: style.scoped,
        inMap: style.map,
        preprocessLang,
      });
      if (compiledStyle.errors.length) {
        errors.push(...compiledStyle.errors);
        return false;
      }
      destCssCode = compiledStyle.code;
      styleMap = compiledStyle.map;
    }

    if (style.module) {
      // e.g. `style0`
      const styleVar = `style${index}`;
      const destCssFilePath =
        style.src
          // e.g. `./foo.css?module=true`
          ? getExternalCssPath(style.src, { module: true })
          // e.g. `./filename.vue.0.module.css`
          : `./${getCssPath(context.filename, index)}`;

      if (context.options?.autoImportCss) {
        // e.g. `import style0 from './foo.css?module=true';`
        // e.g. `import style0 from './filename.vue.0.module.css';`
        cssImportList.push(genCssImport(destCssFilePath, styleVar));
      } else {
        // only for simple testing purposes
        // e.g. `const style0 = new Proxy({}, { get: (_, key) => key })`
        context.addedCodeList.push(`const ${styleVar} = new Proxy({}, { get: (_, key) => key })`);
      }

      const name = typeof style.module === "string" ? style.module : "$style";
      // e.g. `cssModules["style0"] = style0;`
      context.addedCodeList.push(`cssModules["${name}"] = ${styleVar}`);
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
          filename: getCssPath(context.filename, index),
          code: destCssCode,
          sourceMap: styleMap,
        });
      }
    } else {
      if (style.src) {
        if (context.options?.autoImportCss) {
          // e.g. `./foo.css?id=123`
          // e.g. `./foo.css?scoped=true&id=123`
          const cssPath = getExternalCssPath(style.src, { scoped: style.scoped, id: context.id });
          // e.g. `import './foo.css?id=123';`
          // e.g. `import './foo.css?scoped=true&id=123';`
          cssImportList.push(genCssImport(cssPath));
        }
      } else {
        mainCssBlockList.push({
          code: destCssCode,
          sourceMap: styleMap
        });
      }
    }

    return true;
  });
  if (errors.length) {
    throw errors;
  }

  if (mainCssBlockList.length > 0) {
    const destCssFilename = getCssPath(context.filename);
    cssImportList.unshift(genCssImport(`./${destCssFilename}`));
    const mainCssTransformedResult = bundleSourceMap(mainCssBlockList)
    cssFileList.unshift({
      filename: destCssFilename,
      ...mainCssTransformedResult,
    });
  }

  return {
    importList: cssImportList,
    files: cssFileList
  }
}
