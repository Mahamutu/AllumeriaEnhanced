#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;

in vec2 texCoord;
in vec4 fragColor;

uniform sampler2D texture0;

void main()
{
    ae_objectMask=vec4(0,0,0,1);
        vec4 texColor = texture(texture0, texCoord);
    if(texColor.a < 0.01)
        discard;
    outputColor= texColor * fragColor;
}
