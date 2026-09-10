// Stub for image-processor-napi (Anthropic internal native addon)
export function getNativeModule() {
  return {
    hasClipboardImage: () => false,
    readClipboardImage: () => null,
  }
}
export const sharp = null
export default null
