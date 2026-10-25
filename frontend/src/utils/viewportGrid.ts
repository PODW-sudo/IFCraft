import * as THREE from 'three';

export interface ViewportGridOptions {
  size?: number;
  radius?: number;
  isLight?: boolean;
  baseColorHex?: number;
  accentColorHex?: number;
}

/**
 * Creates an industry-grade procedural anti-aliased ground grid with radial falloff.
 * Eliminates moire artifacts, provides 1m minor and 5m major structural subdivisions,
 * and eliminates geometry clipping via depthWrite: false.
 */
export function createGroundGrid(options: ViewportGridOptions = {}): {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  updateTheme: (isLight: boolean, baseColorHex?: number) => void;
  setElevation: (y: number) => void;
  dispose: () => void;
} {
  const size = options.size ?? 240;
  const radius = options.radius ?? 90;
  const isLight = options.isLight ?? false;

  const uniforms = {
    uRadius: { value: radius },
    uGridColorMinor: { value: new THREE.Color(isLight ? 0x94a3b8 : 0x334155) },
    uGridColorMajor: { value: new THREE.Color(isLight ? 0x475569 : 0x64748b) },
    uAxisColorX: { value: new THREE.Color(0xef4444) },
    uAxisColorZ: { value: new THREE.Color(0x3b82f6) },
    uOpacity: { value: isLight ? 0.5 : 0.65 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uRadius;
      uniform vec3 uGridColorMinor;
      uniform vec3 uGridColorMajor;
      uniform vec3 uAxisColorX;
      uniform vec3 uAxisColorZ;
      uniform float uOpacity;
      varying vec3 vWorldPosition;

      void main() {
        vec2 coord = vWorldPosition.xz;
        float dist = length(coord);
        if (dist > uRadius) {
          discard;
        }

        // Smooth cosine-like radial falloff to eliminate horizon moire
        float falloff = 1.0 - smoothstep(uRadius * 0.32, uRadius, dist);
        falloff = pow(falloff, 1.7);

        // Derivative-based anti-aliased lines for 1m minor grid
        vec2 grid1 = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
        float line1 = 1.0 - min(min(grid1.x, grid1.y), 1.0);

        // 5m major structural grid
        vec2 grid5 = abs(fract((coord / 5.0) - 0.5) - 0.5) / fwidth(coord / 5.0);
        float line5 = 1.0 - min(min(grid5.x, grid5.y), 1.0);

        // Coordinate axes lines (X=0 and Z=0)
        float axisX = 1.0 - min(abs(coord.x) / fwidth(coord.x), 1.0);
        float axisZ = 1.0 - min(abs(coord.y) / fwidth(coord.y), 1.0);

        float finalAlpha = 0.0;
        vec3 finalColor = uGridColorMinor;

        if (axisX > 0.1) {
          finalColor = mix(finalColor, uAxisColorZ, clamp(axisX, 0.0, 1.0));
          finalAlpha = max(finalAlpha, axisX * 0.85);
        }
        if (axisZ > 0.1) {
          finalColor = mix(finalColor, uAxisColorX, clamp(axisZ, 0.0, 1.0));
          finalAlpha = max(finalAlpha, axisZ * 0.85);
        }
        if (line5 > 0.05) {
          finalColor = mix(finalColor, uGridColorMajor, clamp(line5 * 0.8, 0.0, 1.0));
          finalAlpha = max(finalAlpha, line5 * 0.7);
        }
        if (line1 > 0.05) {
          finalAlpha = max(finalAlpha, line1 * 0.22);
        }

        if (finalAlpha <= 0.005) {
          discard;
        }

        gl_FragColor = vec4(finalColor, finalAlpha * falloff * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide
  });

  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'bim-ground-grid';
  mesh.position.y = -0.01;
  mesh.renderOrder = -1; // Render before main meshes to ensure transparent sorting

  const updateTheme = (isLightTheme: boolean, baseColorHex?: number) => {
    material.uniforms.uOpacity.value = isLightTheme ? 0.5 : 0.65;
    if (baseColorHex !== undefined) {
      material.uniforms.uGridColorMinor.value.setHex(baseColorHex);
      material.uniforms.uGridColorMajor.value.setHex(isLightTheme ? 0x334155 : 0x64748b);
    } else {
      material.uniforms.uGridColorMinor.value.setHex(isLightTheme ? 0x94a3b8 : 0x334155);
      material.uniforms.uGridColorMajor.value.setHex(isLightTheme ? 0x475569 : 0x64748b);
    }
    material.needsUpdate = true;
  };

  const setElevation = (y: number) => {
    mesh.position.y = y;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    material,
    updateTheme,
    setElevation,
    dispose
  };
}
