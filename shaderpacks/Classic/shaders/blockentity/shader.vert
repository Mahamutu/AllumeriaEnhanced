#version 330 core

layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;
layout (location = 2) in uint normalByte;

out vec2 texCoord;
out vec4 vertexCol;
out vec4 vanillaVertexCol;
out vec3 fragPosition;
out vec3 worldNormal;
out vec4 lightSpacePosition;
out float skyVisibility;
out vec3 directSunlight;

uniform mat4 transform;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform vec4 ambientColor;
uniform vec4 light;
uniform float ae_shadowStrength;
uniform float ae_indirectLight;
uniform mat4 ae_lightViewProjection;
uniform vec3 ae_sunDirection;

const vec3 normals[8] = vec3[8](
    vec3(0, 1, 0), vec3(0, -1, 0), vec3(1, 0, 0), vec3(-1, 0, 0),
    vec3(0, 0, 1), vec3(0, 0, -1), vec3(0, 1, 0), vec3(0, 1, 0)
);
const float directionalColors[8] = float[8](1.0, 0.7, 0.8, 0.8, 0.9, 0.9, 1.0, 1.0);

void main()
{
    int ni = clamp(int(normalByte), 0, 7);
    vec4 worldPos = vec4(aPos, 1.0) * model;
    vec3 normal = normalize((vec4(normals[ni], 0.0) * model).xyz);
    worldNormal = normal;
    fragPosition = worldPos.xyz;
    lightSpacePosition = worldPos * ae_lightViewProjection;
    gl_Position = worldPos * view * projection;
    texCoord = aTexCoord;

    vec3 blockLight = light.rgb * 0.0666;
    vec3 skyLight = ambientColor.rgb * light.w * 0.0666;
    vanillaVertexCol = vec4(clamp(max(blockLight, skyLight), 0.0, 1.0) * directionalColors[ni], 1.0);
    float sky = clamp(light.w / 15.0, 0.0, 1.0);
    skyVisibility = sky;
    float sunExposure = smoothstep(0.72, 0.98, sky);
    float direct = max(dot(normal, normalize(ae_sunDirection)), 0.0) * sunExposure;
    float hemisphere = mix(0.64, 1.0, clamp(normal.y * 0.5 + 0.5, 0.0, 1.0));
    float occlusion = mix(0.80, 1.0, sky);
    vec3 indirect = ambientColor.rgb * mix(0.24, 0.82, sky) * hemisphere * ae_indirectLight;
    vec3 sunlight = ambientColor.rgb * direct * (0.34 + 0.36 * ae_shadowStrength);
    vec3 ambientOnly = max(blockLight, indirect * occlusion);
    vec3 enhanced = clamp(max(blockLight, (indirect + sunlight) * occlusion), 0.0, 1.15);
    directSunlight = max(enhanced - ambientOnly, vec3(0.0));
    vertexCol = vec4(enhanced, 1.0);
}
