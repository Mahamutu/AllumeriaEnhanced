#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;
layout (location = 2) in uint normalByte;
layout (location = 3) in uvec4 lightByte;

out vec2 texCoord;
out vec4 vertexCol;

out vec3 fragPosition; //for fog
  
uniform mat4 transform;
uniform mat4 model;
uniform vec3 ae_handOrigin;
uniform float ae_firstPerson;
flat out float ae_isHand;
uniform mat4 view;
uniform mat4 projection;

uniform vec4 ambientColor;
uniform vec3 billboardPos;
uniform vec3 camUp;
uniform vec3 camRight;

uniform vec4 lightColor;

uniform vec2 uv;


void main()
{
    vec3 objectOrigin=(vec4(0,0,0,1)*model).xyz;
    float objectScale=length((vec4(1,0,0,0)*model).xyz);
    ae_isHand=ae_firstPerson>0.5 && distance(objectOrigin,ae_handOrigin)<0.3
        && (abs(objectScale-0.4)<0.015 || abs(objectScale-0.2)<0.015)?1.0:0.0;

    vec3 worldPos = billboardPos + camRight * aPos.x * 1 +  camUp * aPos.y * 1;
    gl_Position =  vec4(worldPos, 1.0) * view * projection;


    // Billboard vertices are already assembled in world space above.  Using the
    // local quad here made distance fog jump as the camera moved.
    fragPosition = worldPos;

    texCoord = vec2(uv.x + aTexCoord.x,  aTexCoord.y - uv.y);
    //vertexCol = vec4(mix(ambientColor.xyz * float(lightByte.x) *0.0625,vec3(1,1,1) , float(lightByte.w) *0.0625)* directionalColors[normalByte],1);
    //
    vertexCol = vec4(clamp( vec3( 
        float(lightColor.x) *0.0666,
        float(lightColor.y) *0.0666,
        float(lightColor.z) *0.0666
        ) + ambientColor.xyz * float(lightColor.w) *0.0666 ,vec3(0,0,0),vec3(1,1,1)),1);
    //vertexCol = vec4(1,lightByte*0.03,1,1);
}
