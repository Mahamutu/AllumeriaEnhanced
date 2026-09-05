#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;
layout (location = 2) in uint normalByte;

out vec2 texCoord;
out vec4 vertexCol;

out vec3 fragPosition; //for fog
  
uniform mat4 transform;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform float uTime;
uniform float alpha;
uniform float flashIntensity;

void main()
{
   
    fragPosition = vec3(vec4(aPos, 1.0)*model);
    gl_Position =  vec4(aPos, 1.0) * model * view * projection;
    texCoord = vec2(aTexCoord.x, aTexCoord.y);
    vertexCol = vec4(1,1,1,alpha) * alpha * (sin(uTime*5000+aPos.x*200+aPos.z*500)*flashIntensity*0.4 + 1 - flashIntensity*0.2); //uncomment this for star twinkle
}