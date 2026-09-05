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

uniform float uTime;

uniform vec3 viewPos;


void main()
{
    fragPosition = vec3(vec4(aPos, 1.0)*model);
    gl_Position =  vec4(aPos + vec3(0,sin(uTime*0.2+aPos.x*0.0134+aPos.z*0.01)*10,0), 1.0) * model * view * projection;
    texCoord = vec2(aTexCoord.x+viewPos.x*0.0009765625+uTime*0.6, aTexCoord.y+viewPos.z*0.0009765625);
    vertexCol = vec4(1,1,1,1);
}