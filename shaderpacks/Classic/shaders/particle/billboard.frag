#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;
in vec2 texCoord;
in vec4 vertexCol;
in vec3 fragPosition;

uniform sampler2D texture0;
uniform vec4 fogColor;
uniform vec4 fogMidColor;
uniform float fogStart;
uniform float fogEnd;
uniform vec3 viewPos;
uniform float ae_enabled;
uniform float ae_fogStrength;

void main()
{
    ae_objectMask=vec4(0,0,0,1);
    vec4 texel = texture(texture0, texCoord) * vertexCol;
    if (texel.a < 0.5)
        discard;
    float d = length(viewPos - fragPosition);
    float visibility = clamp((fogEnd - d) / max(fogEnd - fogStart, 0.001), 0.0, 1.0);
    visibility = visibility * visibility * (3.0 - 2.0 * visibility);
    vec3 atmosphere = mix(fogColor.rgb, fogMidColor.rgb, visibility);
    vec3 vanilla = mix(atmosphere, texel.rgb, visibility);
    vec3 viewRay = normalize(fragPosition - viewPos);
    float horizonHaze = smoothstep(0.55, 0.96, 1.0 - abs(viewRay.y))
        * smoothstep(fogStart * 0.72, fogEnd, d) * ae_fogStrength;
    float enhancedVisibility = mix(1.0, visibility, ae_fogStrength) * (1.0 - horizonHaze * 0.16);
    vec3 enhanced = mix(atmosphere, texel.rgb, enhancedVisibility);
    outputColor = vec4(mix(vanilla, enhanced, clamp(ae_enabled, 0.0, 1.0) * 0.38), texel.a);
}
