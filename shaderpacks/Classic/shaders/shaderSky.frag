#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;

in vec2 texCoord;
in vec4 vertexCol;
in vec3 fragPosition;

uniform vec3 viewPos;
uniform float ae_enabled;
uniform float ae_fogStrength;
uniform vec3 ae_sunDirection;
uniform float ae_warmth;

void main()
{
    ae_objectMask=vec4(0,0,0,1);
    gl_FragDepth = 1.0;
   
    //vec4 texelColor = texture(texture0, texCoord) * vertexCol;


    vec3 viewDirection = normalize(fragPosition - viewPos);
    vec3 sunDirection = normalize(ae_sunDirection);
    float cosineTheta = clamp(dot(viewDirection, sunDirection), -1.0, 1.0);
    float rayleighPhase = 0.75 * (1.0 + cosineTheta * cosineTheta);
    float g = 0.76;
    float miePhase = (1.0 - g * g) /
        max(pow(1.0 + g * g - 2.0 * g * cosineTheta, 1.5), 0.025);
    float horizon = pow(1.0 - clamp(abs(viewDirection.y), 0.0, 1.0), 2.2);
    vec3 rayleigh = vec3(0.10, 0.24, 0.58) * rayleighPhase * (0.08 + horizon * 0.24);
    vec3 mie = vec3(1.0, 0.57, 0.24) * miePhase * 0.018 * (0.35 + horizon * 0.65);
    vec3 scattered = vertexCol.rgb + (rayleigh + mie) * ae_fogStrength;
    scattered *= vec3(1.0 + ae_warmth * 0.03, 1.0, 1.0 - ae_warmth * 0.025);
    scattered = scattered / (1.0 + max(scattered - vec3(0.86), vec3(0.0)) * 0.8);
    outputColor = vec4(mix(vertexCol.rgb, scattered, clamp(ae_enabled, 0.0, 1.0) * 0.38), vertexCol.a);

    
}
