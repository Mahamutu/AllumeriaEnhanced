#version 330 core
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aTexCoord;
layout(location=2) in uint normalByte;
uniform mat4 model;
uniform mat4 ae_lightViewProjection;
uniform float uTime;
uniform int leafSway;
out vec2 texCoord;
out vec3 shadowWorldPosition;
void main(){
    vec4 worldPos = vec4(aPos, 1.0) * model;
    if (leafSway == 1) {
        if (normalByte == uint(6)) {
            worldPos += vec4(
                sin(uTime * 1000.0 + worldPos.x * 23.2 + worldPos.z * 7.2 + worldPos.y * 27.38)
                    * (sin(uTime * 2343.0 + worldPos.x * 64.345 + worldPos.z * 192.45 + worldPos.y * 53.38) - 1.0) * 0.05,
                sin(uTime * 1000.0 + worldPos.y * 23.2 + worldPos.z * 0.2 + worldPos.x * 27.38) * 0.05,
                0.0, 0.0);
        } else if (normalByte == uint(7)) {
            worldPos += vec4(0.0,
                sin((uTime * 10000.0) + worldPos.x * 23.2 + worldPos.z * 7.2 + worldPos.y * 27.38)
                    * (sin((uTime * 10000.0) + worldPos.x * 64.345 + worldPos.z * 192.45 + worldPos.y * 53.38) - 1.0) * 0.05,
                0.0, 0.0);
        }
    }

texCoord=aTexCoord;
shadowWorldPosition=worldPos.xyz;
gl_Position=worldPos*ae_lightViewProjection;
}
