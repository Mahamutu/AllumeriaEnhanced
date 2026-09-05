#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;

in vec2 texCoord;
in vec4 fragColor;

uniform vec2 screenRes;
uniform sampler2D texture0;

const float[16] bayerMatrix4x4 = float[16](

    0.0,  0.5,  0.125, 0.625,
    0.75, 0.25,  0.875, 0.375,
    0.1875,  0.6875, 0.0625, 0.5625,
    0.9375, 0.4375,  0.8125, 0.3125
);

vec4 dither(vec2 uv, vec4 color) {
  float threshold = bayerMatrix4x4[(int(uv.x * screenRes.x) % 4)*4 + (int(uv.y * screenRes.y) % 4)];

  color.r = floor(color.r *10 + (threshold - 0.5))*0.1;
  color.g = floor(color.g *10 + (threshold - 0.5))*0.1;
  color.b = floor(color.b *10 + (threshold - 0.5))*0.1;

  return color;
}

void main()
{
    ae_objectMask=vec4(0,0,0,1);
    vec4 texColor = texture(texture0, texCoord);
    if(texColor.a < 0.1)
        discard;
    //outputColor = texColor *fragColor;
    outputColor = dither(texCoord,texColor *fragColor);
}

