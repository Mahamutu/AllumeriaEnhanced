#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;

in vec2 texCoord;
in vec4 vertexCol;
in vec3 fragPosition;


uniform sampler2D texture0;

uniform vec3 viewPos;
uniform float flashIntensity;

void main()
{
    ae_objectMask=vec4(0,0,0,1);
   gl_FragDepth = 1.0;

    vec4 texelColor = texture(texture0, texCoord) * vertexCol;

    if (flashIntensity < 0.5 && texCoord.x <= 0.3751 && texCoord.y <= 0.1251)
    {
       bool isSun = texCoord.x <= 0.1251;
       vec2 localUV = vec2(fract(texCoord.x * 8.0), fract(texCoord.y * 8.0));
       localUV = (floor(localUV * 40.0) + 0.5) / 40.0;
       vec2 centered = localUV - vec2(0.5);
       float radius = length(centered);
       float core = 1.0-smoothstep(0.090,0.120,radius);
       float halo = (1.0-smoothstep(0.110,0.235,radius)) * (1.0-core);
       float moonDisk = core; // Single clean disk; no overlapping circular cutout.
       vec3 celestialColor = isSun
          ? mix(vec3(1.0, 0.66, 0.25), vec3(1.0, 0.96, 0.72), core)
          : mix(vec3(0.54, 0.70, 0.92), vec3(0.82, 0.90, 1.0), moonDisk);
       float disk = isSun ? core : moonDisk;
       float alpha = max(disk, halo * (isSun ? 0.20 : 0.08)) * vertexCol.a;
       if (alpha < 0.01)
          discard;
       outputColor = vec4(celestialColor * (0.72 + disk * 0.28) * alpha, alpha);
       return;
    }

    if(texelColor.a < 0.01)
       discard;
   outputColor = texelColor;

    
}
