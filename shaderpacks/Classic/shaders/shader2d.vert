#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;
layout (location = 3) in vec4 aColor;

out vec2 texCoord;
out vec4 fragColor;
  
uniform mat4 projection;
uniform mat4 transform;
void main()
{
    gl_Position =vec4(aPos, 1.0) * transform * projection;
    texCoord = vec2(aTexCoord.x, aTexCoord.y);
    fragColor = aColor;
}