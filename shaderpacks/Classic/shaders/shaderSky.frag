#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;

in vec2 texCoord;
in vec4 vertexCol;
in vec3 fragPosition;

uniform vec3 viewPos;
uniform float ae_enabled;
uniform float ae_fogStrength;
uniform vec3 ae_sunDirection;
uniform float ae_warmth;
uniform float ae_cloudTime;
uniform float ae_underwater;
uniform float ae_biomeSnow;

float auroraHash(vec2 p) {
    return fract(sin(dot(p,vec2(41.73,289.11)))*43758.5453);
}
float pixelAuroraCurtain(float azimuth, float elevation, float phase, float offset) {
    const float PI=3.14159265;
    float column=floor((azimuth+PI)*32.0)/32.0-PI;
    float row=floor(max(elevation,0.0)*60.0)/60.0;
    float ridge=0.70+sin(column*2.15+phase+offset)*0.135
        +sin(column*4.8-phase*0.42+offset*1.6)*0.05;
    float crown=1.0-smoothstep(0.04,0.09,abs(row-ridge));
    float veil=smoothstep(ridge-0.38,ridge-0.15,row)
        *(1.0-smoothstep(ridge-0.11,ridge+0.02,row))*0.42;
    float cell=auroraHash(vec2(floor((azimuth+PI)*32.0),floor(row*60.0)+offset*7.0));
    return max(crown,veil)*mix(0.72,1.0,step(0.30,cell));
}
vec3 pixelAurora(vec3 ray) {
    if(ae_biomeSnow<0.01 || ae_underwater>0.5 || ray.y<=0.035)return vec3(0.0);
    const float PI=3.14159265;
    float night=1.0-smoothstep(-0.08,0.12,ae_sunDirection.y);
    float visibility=night*ae_biomeSnow
        *smoothstep(0.035,0.16,ray.y)*(1.0-smoothstep(0.91,0.995,ray.y));
    float azimuth=atan(ray.z,ray.x);
    float elevation=asin(clamp(ray.y,-1.0,1.0));
    float phase=ae_cloudTime*0.065;
    float first=pixelAuroraCurtain(azimuth,elevation,phase,0.0);
    float second=pixelAuroraCurtain(azimuth+0.82,elevation-0.09,-phase*0.70,2.6)*0.68;
    float curtain=max(first,second);
    float palette=0.5+0.5*sin(floor((azimuth+PI)*16.0)/16.0*3.0+phase);
    vec3 colour=mix(vec3(0.30,0.92,0.74),vec3(0.78,0.28,0.90),
        smoothstep(0.36,0.78,palette));
    return colour*curtain*visibility*0.58;
}

void main()
{
    ae_objectMask=vec4(0,0,0,1);
    gl_FragDepth = 1.0;
   
    //vec4 texelColor = texture(texture0, texCoord) * vertexCol;


    vec3 viewDirection = normalize(fragPosition - viewPos);
    vec3 sunDirection = normalize(ae_sunDirection);
    float cosineTheta = clamp(dot(viewDirection, sunDirection), -1.0, 1.0);
    float rayleighPhase = 0.75 * (1.0 + cosineTheta * cosineTheta);
    float g = 0.76;
    float miePhase = (1.0 - g * g) /
        max(pow(1.0 + g * g - 2.0 * g * cosineTheta, 1.5), 0.025);
    float horizon = pow(1.0 - clamp(abs(viewDirection.y), 0.0, 1.0), 2.2);
    vec3 rayleigh = vec3(0.10, 0.24, 0.58) * rayleighPhase * (0.08 + horizon * 0.24);
    vec3 mie = vec3(1.0, 0.57, 0.24) * miePhase * 0.018 * (0.35 + horizon * 0.65);
    vec3 scattered = vertexCol.rgb + (rayleigh + mie) * ae_fogStrength;
    scattered += pixelAurora(viewDirection);
    scattered *= vec3(1.0 + ae_warmth * 0.03, 1.0, 1.0 - ae_warmth * 0.025);
    scattered = scattered / (1.0 + max(scattered - vec3(0.86), vec3(0.0)) * 0.8);
    outputColor = vec4(mix(vertexCol.rgb, scattered, clamp(ae_enabled, 0.0, 1.0) * 0.38), vertexCol.a);

    
}
