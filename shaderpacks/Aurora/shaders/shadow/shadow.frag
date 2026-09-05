#version 330 core
in vec2 texCoord;
in vec3 shadowWorldPosition;
uniform sampler2D texture0;
uniform int ae_skipSourceBlock;
uniform int ae_pointPass;
uniform vec3 ae_pointPosition;
uniform float ae_pointFar;
void main(){
    if(texture(texture0,texCoord).a < 0.5) discard;
    // A point placed inside an emissive plant must not be blocked by its own cards.
    // Held lights do not exclude any source block.
    if(ae_pointPass==1 && ae_skipSourceBlock==1 &&
       all(equal(floor(shadowWorldPosition),floor(ae_pointPosition)))) discard;
    gl_FragDepth = ae_pointPass == 1
        ? length(shadowWorldPosition-ae_pointPosition)/ae_pointFar : gl_FragCoord.z;
}
