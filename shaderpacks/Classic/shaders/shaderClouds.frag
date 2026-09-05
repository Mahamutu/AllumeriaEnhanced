#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;
in vec2 texCoord;
in vec4 vertexCol;
in vec3 fragPosition;

uniform sampler2D texture0;
uniform float fogStart;
uniform float fogEnd;
uniform vec4 cloudColor;
uniform vec3 viewPos;
uniform float density;
uniform float intensity;
uniform float ae_enabled;
uniform float ae_cloudSoftness;
uniform vec3 ae_sunDirection;

void main()
{
    ae_objectMask=vec4(0,0,0,1);
    float cloud = texture(texture0, texCoord).r;
    float hardMask = cloud >= density ? 1.0 : 0.0;
    float edgeWidth = max(mix(0.012, 0.045, ae_cloudSoftness), fwidth(cloud) * 1.25);
    float softMask = smoothstep(density - edgeWidth, density + edgeWidth, cloud);
    float core = smoothstep(density + edgeWidth * 0.35, density + edgeWidth * 2.4, cloud);
    float mask = mix(hardMask, softMask, clamp(ae_enabled, 0.0, 1.0));
    if (mask < 0.01)
        discard;

    float d = length(viewPos - fragPosition);
    float visibility = clamp((fogEnd - d) / max(fogEnd - fogStart, 0.001), 0.0, 1.0);
    visibility = visibility * visibility * (3.0 - 2.0 * visibility);
    float vanillaAlpha = visibility * cloud / max(density * 2.0, 0.001) * intensity;
    float textureDensity = clamp(cloud / max(density * 1.55, 0.001), 0.0, 1.0);
    vec2 gradient = vec2(dFdx(cloud), dFdy(cloud));
    float silverLining = (1.0 - core) * smoothstep(0.002, 0.025, length(gradient));
    float sunHeight = clamp(ae_sunDirection.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 underside = cloudColor.rgb * mix(0.68, 0.84, sunHeight);
    vec3 enhancedColor = mix(cloudColor.rgb * 0.84, cloudColor.rgb * 0.96, textureDensity);
    enhancedColor += vec3(1.0, 0.72, 0.42) * silverLining * (0.035 + 0.055 * sunHeight);
    float enhancedAlpha = vanillaAlpha * softMask * 0.94;
    vec4 enhanced = vec4(enhancedColor, clamp(enhancedAlpha, 0.0, 0.92));
    outputColor = mix(vec4(cloudColor.rgb, clamp(vanillaAlpha, 0.0, 1.0)), enhanced, ae_enabled);
}
