#version 330 core

layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;
layout (location = 2) in uint normalByte;
layout (location = 5) in uint boneByte;

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
uniform vec3 ae_handOrigin;
uniform float ae_firstPerson;
flat out float ae_isHand;
uniform mat4 view;
uniform mat4 projection;
uniform vec4 ambientColor;
uniform vec4 light;
uniform int boneCount;
uniform mat4 boneMatrices[20];
uniform float ae_shadowStrength;
uniform float ae_indirectLight;
uniform mat4 ae_lightViewProjection;
uniform vec3 ae_sunDirection;
uniform vec3 ae_moonDirection;
uniform float ae_moonStrength;

const vec3 normals[8] = vec3[8](
    vec3(0, 1, 0), vec3(0, -1, 0), vec3(1, 0, 0), vec3(-1, 0, 0),
    vec3(0, 0, 1), vec3(0, 0, -1), vec3(0, 1, 0), vec3(0, 1, 0)
);
const float directionalColors[8] = float[8](1.0, 0.7, 0.8, 0.8, 0.9, 0.9, 1.0, 1.0);

uniform vec3 viewPos;
void main()
{
    vec3 objectOrigin=(vec4(0,0,0,1)*model).xyz;
    float objectScale=length((vec4(1,0,0,0)*model).xyz);
    ae_isHand=ae_firstPerson>0.5 && distance(objectOrigin,ae_handOrigin)<0.3
        && (abs(objectScale-0.4)<0.015 || abs(objectScale-0.2)<0.015)?1.0:0.0;
    int ni = clamp(int(normalByte), 0, 7);
    int bi = clamp(int(boneByte), 0, 19);
    vec4 worldPos = vec4(aPos, 1.0) * boneMatrices[bi] * model;
    vec3 normal = normalize((vec4(normals[ni], 0.0) * boneMatrices[bi] * model).xyz);
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
    vec3 sunDir = normalize(ae_sunDirection);
    float sunExposure = smoothstep(0.72, 0.98, sky);
    float direct = max(dot(normal, sunDir), 0.0) * sunExposure;
    float hemisphere = mix(0.64, 1.0, clamp(normal.y * 0.5 + 0.5, 0.0, 1.0));
    float occlusion = mix(0.80, 1.0, sky);
    vec3 indirect = ambientColor.rgb * mix(0.24, 0.82, sky) * hemisphere * ae_indirectLight;
    vec3 sunlight = ambientColor.rgb * direct * (0.34 + 0.36 * ae_shadowStrength);
    sunlight *= smoothstep(0.0,0.15,ae_sunDirection.y);
    indirect *= mix(0.55,1.0,smoothstep(0.05,0.55,skyVisibility));
    // Reduce excessively saturated red baked light (lava and similar emitters).
    float redDominance=smoothstep(0.12,0.55,blockLight.r-max(blockLight.g,blockLight.b));
    vec3 warmEmission=vec3(blockLight.r*0.78,max(blockLight.g,blockLight.r*0.34),max(blockLight.b,blockLight.r*0.07));
    blockLight=mix(blockLight,warmEmission,redDominance*0.65);
    float distantLight=smoothstep(30.0,130.0,length(fragPosition-viewPos));
    blockLight=pow(max(blockLight,vec3(0)),vec3(1.0+distantLight*0.30));
    // Neutral moon bounce preserves foliage detail without lighting enclosed caves.
    indirect = mix(indirect, vec3(dot(indirect,vec3(0.2126,0.7152,0.0722))), ae_moonStrength*0.55);
    indirect += vec3(0.021,0.025,0.031)*ae_moonStrength*skyVisibility;
    sunlight += vec3(0.064,0.072,0.085)*ae_moonStrength*sunExposure*max(dot(worldNormal,ae_moonDirection),0.0);
    vec3 ambientOnly = max(blockLight, indirect * occlusion);
    vec3 enhancedLight = clamp(max(blockLight, (indirect + sunlight) * occlusion), 0.0, 1.15);
    directSunlight = max(enhancedLight - ambientOnly, vec3(0.0));

    vertexCol = vec4(enhancedLight, 1.0);
}
