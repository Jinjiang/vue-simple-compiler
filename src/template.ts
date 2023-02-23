import { compileTemplate, SFCDescriptor } from "vue/compiler-sfc";
import { COMP_ID, TransformResult } from "./transform";
import { Context } from "./types";

export const resolveTemplate = (descriptor: SFCDescriptor, context: Context): TransformResult => {
  if (descriptor.template && !descriptor.scriptSetup) {
    if (descriptor.template.lang && descriptor.template.lang !== "html") {
      throw new Error(`Unsupported template lang: ${descriptor.template.lang}`)
    }
    if (descriptor.template.src) {
      throw new Error(`Unsupported external template: ${descriptor.template.src}.`)
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
      code: templateCode,
      sourceMap: templateResult.map,
    }
  }

  return { code: "" };
}
