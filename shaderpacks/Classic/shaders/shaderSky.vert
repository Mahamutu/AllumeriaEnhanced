#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;

out vec2 texCoord;
out vec4 vertexCol;

out vec3 fragPosition; //for fog
  
uniform mat4 transform;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

uniform vec4 baseColor;
uniform vec4 skyColor;
uniform vec4 horizonColor;

void main()
{
    fragPosition = vec3(vec4(aPos, 1.0)*model);
    gl_Position =  vec4(aPos, 1.0) * model * view * projection;
    texCoord = vec2(aTexCoord.x, aTexCoord.y);
    vertexCol = horizonColor*texCoord.y+skyColor*texCoord.x;
}