#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;
layout (location = 2) in uint normalByte;
layout (location = 4) in uvec4 lightByte;

out vec2 texCoord;
out vec4 vertexCol;

out vec3 fragPosition; //for fog
out vec3 worldNormal;
  
uniform mat4 transform;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

uniform vec4 ambientColor;

const vec3 normals[8] = vec3[8](
    vec3(0,1,0),
    vec3(0,-1,0),
    vec3(1,0,0),
    vec3(-1,0,0),
    vec3(0,0,1),
    vec3(0,0,-1),
    vec3(0,1,0),
    vec3(0,1,0)
);

const float directionalColors[6] = float[6](
    1,0.7,0.8,0.8,0.9,0.9
);
void main()
{
    fragPosition = vec3(vec4(aPos, 1.0)*model);
    gl_Position =  vec4(aPos, 1.0) * model * view * projection;
    texCoord = vec2(aTexCoord.x, aTexCoord.y);
    worldNormal = normalize((vec4(normals[clamp(int(normalByte), 0, 7)], 0.0) * model).xyz);
    //vertexCol = vec4(mix(ambientColor.xyz * float(lightByte.x) *0.0625,vec3(1,1,1) , float(lightByte.w) *0.0625)* directionalColors[normalByte],1);

    vertexCol = vec4(clamp( vec3( 
        float(lightByte.x) *0.0666,
        float(lightByte.y) *0.0666,
        float(lightByte.z) *0.0666
        ) + ambientColor.xyz * float(lightByte.w) *0.0666 ,vec3(0,0,0),vec3(1,1,1))*directionalColors[normalByte],1);
    //vertexCol = vec4(1,lightByte*0.03,1,1);
}
