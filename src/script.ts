import type {
  SFCDescriptor,
  SFCScriptBlock,
  CompilerOptions as SFCCompilerOptions,
} from 'vue/compiler-sfc';

import { compileScript, rewriteDefault } from 'vue/compiler-sfc';

import type { TransformResult, Context } from './types';

import { COMP_ID } from './constants';
import { chainSourceMap } from './map';
import { checkExtensionName } from './options';
import { transformTS } from './transform';

export const resolveScript = (
  descriptor: SFCDescriptor,
  context: Context
): {
  result?: TransformResult;
  errors?: Error[];
} => {
  const scriptLang =
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang) ||
    'js';

  if (descriptor.script || descriptor.scriptSetup) {
    if (scriptLang !== 'js' && scriptLang !== 'ts') {
      return {
        errors: [new Error(`Unsupported script lang: ${scriptLang}`)],
      };
    }
    if (descriptor.scriptSetup?.src) {
      return {
        errors: [
          new Error(
            `Unsupported external script setup: ${descriptor.scriptSetup.src}`
          ),
        ],
      };
    }
    if (descriptor.script?.src) {
      if (!checkExtensionName(descriptor.script.src, [scriptLang])) {
        return {
          errors: [
            new Error(
              `The extension name doesn't match the script language "${scriptLang}": ${descriptor.script.src}.`
            ),
          ],
        };
      }
      context.externalJsList.push({
        filename: descriptor.script.src,
        query: {},
      });
      return {
        result: {
          code: `import ${COMP_ID} from ${JSON.stringify(
            descriptor.script.src
          )}`,
        },
      };
    }
    const expressionPlugins: SFCCompilerOptions['expressionPlugins'] = context
      .features.hasTS
      ? ['typescript']
      : undefined;
    let scriptBlock: SFCScriptBlock;
    try {
      scriptBlock = compileScript(descriptor, {
        id: context.id,
        inlineTemplate: true,
        templateOptions: {
          compilerOptions: {
            expressionPlugins,
          },
        },
        isProd: context.isProd,
      });
    } catch (error) {
      return { errors: [error as Error] };
    }
    // basic source map
    context.bindingMetadata = scriptBlock.bindings;
    if (context.features.hasTS) {
      try {
        const transformed = transformTS(scriptBlock.content);
        const sourceMap = chainSourceMap(
          scriptBlock.map,
          transformed.sourceMap
        );
        return {
          result: {
            code: rewriteDefault(transformed.code, COMP_ID, expressionPlugins),
            sourceMap,
          },
        };
      } catch (error) {
        return { errors: [error as Error] };
      }
    } else {
      // No source map update technically.
      return {
        result: {
          code: rewriteDefault(scriptBlock.content, COMP_ID, expressionPlugins),
          sourceMap: scriptBlock.map,
        },
      };
    }
  } else {
    return { result: { code: `const ${COMP_ID} = {}` } };
  }
};
