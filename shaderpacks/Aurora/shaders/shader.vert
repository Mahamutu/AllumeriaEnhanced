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
uniform vec3 ae_moonDirection;
uniform float ae_moonStrength;
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

uniform vec3 viewPos;
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
    float ndl=dot(worldNormal,sunDir);
    float direct=mix(max(ndl,0.0),max((ndl+0.22)/1.22,0.0)*0.82,vegetationFactor)*sunExposure;
    float hemisphere = mix(0.64, 1.0, clamp(worldNormal.y * 0.5 + 0.5, 0.0, 1.0));
    float occlusion = mix(0.78, 1.0, skyVisibility);
    vec3 indirect = ambientColor.rgb * mix(0.22, 0.82, skyVisibility) * hemisphere * ae_indirectLight;
    vec3 sunlight = ambientColor.rgb * direct * (0.35 + 0.38 * ae_shadowStrength);
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
    float nightLeaf=vegetationFactor*(1.0-smoothstep(-0.05,0.12,ae_sunDirection.y));
    sunlight*=1.0-nightLeaf*0.28;
    indirect+=vec3(0.009,0.011,0.014)*nightLeaf*ae_moonStrength
        *smoothstep(0.08,0.55,skyVisibility)*(1.0-max(worldNormal.y,0.0)*0.6);
    vec3 ambientOnly = max(blockLight, indirect * occlusion);
    vec3 enhancedLight = clamp(max(blockLight, (indirect + sunlight) * occlusion), 0.0, 1.15);
    directSunlight = max(enhancedLight - ambientOnly, vec3(0.0)) * paintCol;

    vertexCol = vec4(enhancedLight * paintCol, 1.0);
}
