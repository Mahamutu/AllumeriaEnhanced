#version 330 core

layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;
layout (location = 2) in uint normalByte;
layout (location = 4) in uvec4 lightByte;
layout (location = 6) in uint paintByte;

out vec2 texCoord;
out vec4 vertexCol;
out vec4 vanillaVertexCol;
out vec3 paintCol;
out vec3 fragPosition;
out vec3 worldNormal;
out float skyVisibility;
out vec4 lightSpacePosition;
out vec3 directSunlight;
out float vegetationFactor;

uniform mat4 transform;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform vec4 ambientColor;
uniform float uTime;
uniform int leafSway;
uniform int pointLightCount;
uniform vec4 lightColours[8];
uniform vec3 lightPositions[8];
uniform vec3 paintColours[128];
uniform float ae_enabled;
uniform float ae_shadowStrength;
uniform float ae_indirectLight;
uniform mat4 ae_lightViewProjection;
uniform vec3 ae_sunDirection;
uniform vec3 ae_handLightPosition;
uniform vec3 ae_handLightColor;
uniform float ae_localActive;
uniform vec3 ae_localPosition;

const vec3 normals[8] = vec3[8](
    vec3(0, 1, 0), vec3(0, -1, 0), vec3(1, 0, 0), vec3(-1, 0, 0),
    vec3(0, 0, 1), vec3(0, 0, -1), vec3(0, 1, 0), vec3(0, 1, 0)
);
const float directionalColors[8] = float[8](1.0, 0.7, 0.8, 0.8, 0.9, 0.9, 1.0, 1.0);
const float lightMultiplier = 0.0666;

void main()
{
    vec4 worldPos = vec4(aPos, 1.0) * model;
    if (leafSway == 1) {
        if (normalByte == uint(6)) {
            worldPos += vec4(
                sin(uTime * 1000.0 + worldPos.x * 23.2 + worldPos.z * 7.2 + worldPos.y * 27.38)
                    * (sin(uTime * 2343.0 + worldPos.x * 64.345 + worldPos.z * 192.45 + worldPos.y * 53.38) - 1.0) * 0.05,
                sin(uTime * 1000.0 + worldPos.y * 23.2 + worldPos.z * 0.2 + worldPos.x * 27.38) * 0.05,
                0.0, 0.0);
        } else if (normalByte == uint(7)) {
            worldPos += vec4(0.0,
                sin((uTime * 10000.0) + worldPos.x * 23.2 + worldPos.z * 7.2 + worldPos.y * 27.38)
                    * (sin((uTime * 10000.0) + worldPos.x * 64.345 + worldPos.z * 192.45 + worldPos.y * 53.38) - 1.0) * 0.05,
                0.0, 0.0);
        }
    }

    int normalIndex = clamp(int(normalByte), 0, 7);
    vegetationFactor = normalByte == uint(6) || normalByte == uint(7) ? 1.0 : 0.0;
    vec3 localNormal = normals[normalIndex];
    worldNormal = normalize((vec4(localNormal, 0.0) * model).xyz);
    fragPosition = worldPos.xyz;
    lightSpacePosition = worldPos * ae_lightViewProjection;
    gl_Position = worldPos * view * projection;
    texCoord = aTexCoord;

    vec3 pointLight = vec3(0.0);
    for (int i = 0; i < min(pointLightCount,8); ++i) {
        if(ae_localActive>0.5 && distance(lightPositions[i],ae_localPosition)<1.0) continue;
        float d = max(distance(lightPositions[i], fragPosition), 0.35);
        pointLight += clamp(4.0 / (d * d), 0.0, 1.0) * lightColours[i].rgb;
    }
    float handDistance = max(distance(ae_handLightPosition, fragPosition), 0.45);
    vec3 handLight = clamp(5.5 / (handDistance * handDistance), 0.0, 1.0) * ae_handLightColor;
    if(ae_localActive<0.5) pointLight = max(pointLight, handLight);
    pointLight = clamp(pointLight, 0.0, 1.0);

    paintCol = paintColours[paintByte];
    vec3 blockLight = vec3(lightByte.xyz) * lightMultiplier + pointLight;
    vec3 skyLight = ambientColor.rgb * float(lightByte.w) * lightMultiplier;
    vec3 vanillaLight = clamp(max(blockLight, skyLight), 0.0, 1.0) * directionalColors[normalIndex];
    vanillaVertexCol = vec4(vanillaLight * paintCol, 1.0);

    skyVisibility = clamp(float(lightByte.w) / 15.0, 0.0, 1.0);
    vec3 sunDir = normalize(ae_sunDirection);
    float sunExposure = smoothstep(0.72, 0.98, skyVisibility);
    float direct = max(dot(worldNormal, sunDir), 0.0) * sunExposure;
    float hemisphere = mix(0.64, 1.0, clamp(worldNormal.y * 0.5 + 0.5, 0.0, 1.0));
    float occlusion = mix(0.78, 1.0, skyVisibility);
    vec3 indirect = ambientColor.rgb * mix(0.22, 0.82, skyVisibility) * hemisphere * ae_indirectLight;
    vec3 sunlight = ambientColor.rgb * direct * (0.35 + 0.38 * ae_shadowStrength);
    vec3 ambientOnly = max(blockLight, indirect * occlusion);
    vec3 enhancedLight = clamp(max(blockLight, (indirect + sunlight) * occlusion), 0.0, 1.15);
    directSunlight = max(enhancedLight - ambientOnly, vec3(0.0)) * paintCol;
    vertexCol = vec4(enhancedLight * paintCol, 1.0);
}
