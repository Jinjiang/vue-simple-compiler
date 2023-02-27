import type { SFCDescriptor } from "vue/compiler-sfc";
import type { Context, TransformResult } from "./types";

import { compileTemplate } from "vue/compiler-sfc";

import { COMP_ID } from "./constants";

export const resolveTemplate = (
  descriptor: SFCDescriptor,
  context: Context,
): {
  result?: TransformResult;
  errors?: Error[];
} => {
  if (descriptor.template && !descriptor.scriptSetup) {
    if (descriptor.template.lang && descriptor.template.lang !== "html") {
      return {
        errors: [
          new Error(`Unsupported template lang: ${descriptor.template.lang}`),
        ],
      };
    }
    if (descriptor.template.src) {
      return {
        errors: [
          new Error(
            `Unsupported external template: ${descriptor.template.src}.`
          ),
        ],
      };
    }
    // TODO: env: add isProd
    const templateResult = compileTemplate({
      id: `data-v-${context.id}`,
      filename: context.filename,
      source: descriptor.template.content,
      scoped: context.features.hasScoped,
      compilerOptions: {
        bindingMetadata: context.bindingMetadata,
      },
      inMap: descriptor.template.map,
    });
    if (templateResult.errors.length) {
      throw templateResult.errors;
    }

    // No source map update technically.
    const templateCode = `${templateResult.code.replace(
      /\nexport (function|const) (render|ssrRender)/,
      `\n$1 render`
    )}\n${COMP_ID}.render = render`;

    return {
      result: {
        code: templateCode,
        sourceMap: templateResult.map,
      },
    };
  }

  return { result: { code: "" } };
};
