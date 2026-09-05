#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;
in vec2 texCoord;
flat in float ae_isHand;
in vec4 vertexCol;
in vec3 fragPosition;

uniform sampler2D texture0;
uniform vec4 fogColor;
uniform vec4 fogMidColor;
uniform float fogStart;
uniform float fogEnd;
uniform vec3 viewPos;
uniform float ae_enabled;
uniform float ae_saturation;
uniform float ae_contrast;
uniform float ae_warmth;
uniform float ae_fogStrength;

vec3 gradeColor(vec3 color)
{
    float skyLuma = dot(fogMidColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    color *= mix(1.08, 0.92, smoothstep(0.12, 0.82, skyLuma));
    color = color * (2.51 * color + 0.03) / max(color * (2.43 * color + 0.59) + 0.14, vec3(0.001));
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float chroma = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
    color = mix(vec3(luma), color, ae_saturation + (1.0 - smoothstep(0.08, 0.50, chroma)) * 0.035);
    color = (color - 0.5) * ae_contrast + 0.5;
    color *= vec3(1.0 + ae_warmth * 0.06, 1.0 + ae_warmth * 0.015, 1.0 - ae_warmth * 0.045);
    return clamp(color, 0.0, 1.0);
}

void main()
{
    ae_objectMask=vec4(ae_isHand,0,0,1);
    vec4 texel = texture(texture0, texCoord) * vertexCol;
    if (texel.a < 0.5)
        discard;
    float d = length(viewPos - fragPosition);
    float visibility = clamp((fogEnd - d) / max(fogEnd - fogStart, 0.001), 0.0, 1.0);
    visibility = visibility * visibility * (3.0 - 2.0 * visibility);
    vec3 atmosphere = mix(fogColor.rgb, fogMidColor.rgb, visibility);
    vec3 viewRay = normalize(fragPosition - viewPos);
    float horizonHaze = smoothstep(0.55, 0.96, 1.0 - abs(viewRay.y))
        * smoothstep(fogStart * 0.72, fogEnd, d) * ae_fogStrength;
    float enhancedVisibility = mix(1.0, visibility, ae_fogStrength) * (1.0 - horizonHaze * 0.16);
    vec3 enhanced = mix(atmosphere, gradeColor(texel.rgb), enhancedVisibility);
    outputColor = vec4(mix(texel.rgb, enhanced, clamp(ae_enabled, 0.0, 1.0) * 0.38), texel.a);
}
