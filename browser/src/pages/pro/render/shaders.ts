/**
 * 天体渲染底座：大气辉光 shader 源码（单点定义，全场景共享）
 *
 * 球体表面直接使用 MeshBasicMaterial 贴图全亮渲染（昼夜效果已下线，
 * 见方向决策讨论 2026-08-17：效果不佳取消）；大气 shader 为背面壳
 * fresnel 辉光（additive，BackSide），常规 shader 技巧。
 */

/** 大气辉光着色器：背面壳 fresnel（additive） */
export const ATMO_VERTEX = /* glsl */ `
  varying vec3 vViewNormal;
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const ATMO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vViewNormal;
  void main() {
    float rim = pow(clamp(0.62 - dot(normalize(vViewNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0);
    gl_FragColor = vec4(uColor * rim, 1.0);
  }
`
