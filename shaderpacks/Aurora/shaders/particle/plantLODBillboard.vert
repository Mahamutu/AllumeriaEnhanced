#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec4 aBillboardPos;
layout (location = 2) in vec2 aTexCoord;
layout (location = 3) in vec4 aTexOffsets;
layout (location = 4) in ivec4 aColours;


out vec2 texCoord;
out vec4 vertexCol;

out vec3 fragPosition; //for fog
  
uniform mat4 transform;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

uniform vec4 ambientColor;
uniform float ae_moonStrength;
uniform float ae_enabled;
uniform vec3 camUp;
uniform vec3 camRight;

uniform vec4 lightColor;



void main()
{

    vec3 worldPos = aBillboardPos.xyz + camRight * aPos.x * aBillboardPos.w +  camUp * aPos.y *  aBillboardPos.w;
    gl_Position =  vec4(worldPos, 1.0) * view * projection;


    fragPosition = worldPos;

    texCoord = vec2(aTexCoord.x * aTexOffsets.z + aTexOffsets.x, aTexCoord.y * aTexOffsets.w + aTexOffsets.y);
    //vertexCol = vec4(mix(ambientColor.xyz * float(lightByte.x) *0.0625,vec3(1,1,1) , float(lightByte.w) *0.0625)* directionalColors[normalByte],1);

//    vertexCol = vec4(clamp( vec3( 
//        float(lightColor.x) *0.0666,
//        float(lightColor.y) *0.0666,
//        float(lightColor.z) *0.0666
//        ) + ambientColor.xyz * float(lightColor.w) *0.0666 ,vec3(0,0,0),vec3(1,1,1)),1);

        
     vertexCol = vec4(clamp( vec3( 
        float(aColours.x) *0.0666,
        float(aColours.y) *0.0666,
        float(aColours.z) *0.0666
        ) + ambientColor.xyz * float(aColours.w) *0.0666 ,vec3(0,0,0),vec3(1,1,1)),1);
    vertexCol.rgb=mix(vertexCol.rgb,vec3(dot(vertexCol.rgb,vec3(0.2126,0.7152,0.0722))),ae_moonStrength*ae_enabled*0.45);
    vertexCol.rgb+=vec3(0.052,0.06,0.074)*ae_moonStrength*ae_enabled
        *clamp(float(aColours.w)/15.0,0.0,1.0)*0.65;
}
