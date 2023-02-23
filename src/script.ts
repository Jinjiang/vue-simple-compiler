import { compileScript, rewriteDefault, SFCDescriptor, SFCScriptBlock, CompilerOptions as SFCCompilerOptions, } from "vue/compiler-sfc";
import { chainSourceMap } from "./map";
import { checkExtensionName } from "./options";
import { COMP_ID, TransformResult, transformTS } from "./transform";
import { Context } from "./types";

export const resolveScript = (descriptor: SFCDescriptor, context: Context): TransformResult => {
  const scriptLang =
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang) || 'js';

  if (descriptor.script || descriptor.scriptSetup) {
    if (scriptLang !== "js" && scriptLang !== "ts") {
      throw new Error(`Unsupported script lang: ${scriptLang}`)
    } else if (descriptor.scriptSetup?.src) {
      throw new Error(`Unsupported external script setup: ${descriptor.scriptSetup.src}`)
    } else if (descriptor.script?.src) {
      if (!checkExtensionName(descriptor.script.src, [scriptLang])) {
        throw new Error(`The extension name doesn't match the script language "${scriptLang}": ${descriptor.script.src}.`)
      }
      context.externalJsList.push({
        filename: descriptor.script.src,
        query: {},
      });
      return { code: `import ${COMP_ID} from ${JSON.stringify(descriptor.script.src)}`};
    } else {
      const expressionPlugins: SFCCompilerOptions["expressionPlugins"] =
        context.features.hasTS ? ["typescript"] : undefined;
      let scriptBlock: SFCScriptBlock;
      try {
        // TODO: env: add isProd
        scriptBlock = compileScript(descriptor, {
          id: context.id,
          inlineTemplate: true,
          templateOptions: {
            compilerOptions: {
              expressionPlugins,
            },
          },
        });
      } catch (error) {
        throw error as Error
      }
      // basic source map
      context.bindingMetadata = scriptBlock.bindings;
      if (context.features.hasTS) {
        try {
          const transformed = transformTS(scriptBlock.content);
          const sourceMap = chainSourceMap(scriptBlock.map, transformed.sourceMap);
          return { code: rewriteDefault(transformed.code, COMP_ID, expressionPlugins), sourceMap };
        } catch (error) {
          throw error as Error
        }
      } else {
        // No source map update technically.
        return { code: rewriteDefault(scriptBlock.content, COMP_ID, expressionPlugins), sourceMap: scriptBlock.map };
      }
    }
  } else {
    return { code: `const ${COMP_ID} = {}` };
  }
};

