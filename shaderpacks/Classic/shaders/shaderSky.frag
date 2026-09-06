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

float pixelAuroraLine(float azimuth, float elevation, float phase,
                      float centre, float heightOffset, float phaseOffset) {
    const float PI=3.14159265;
    float column=floor((azimuth+PI)*44.0)/44.0-PI;
    float row=floor(max(elevation,0.0)*70.0)/70.0;
    float local=atan(sin(column-centre),cos(column-centre));
    float window=1.0-smoothstep(0.70,1.16,abs(local));
    float ridge=0.68+heightOffset
        +sin(local*2.7+phase+phaseOffset)*0.075
        +sin(local*5.1-phase*0.40+phaseOffset*1.6)*0.025;
    float line=1.0-smoothstep(0.014,0.038,abs(row-ridge));
    float segment=0.85+0.15*sin(floor((local+1.25)*17.0)*0.93
        +phase*1.6+phaseOffset);
    return line*window*segment;
}
vec3 pixelAurora(vec3 ray) {
    if(ae_biomeSnow<0.01 || ae_underwater>0.5 || ray.y<=0.035)return vec3(0.0);
    const float PI=3.14159265;
    float night=1.0-smoothstep(-0.08,0.12,ae_sunDirection.y);
    float visibility=night*ae_biomeSnow
        *smoothstep(0.035,0.16,ray.y)*(1.0-smoothstep(0.84,0.97,ray.y));
    float azimuth=atan(ray.z,ray.x);
    float elevation=asin(clamp(ray.y,-1.0,1.0));
    float phase=ae_cloudTime*0.048;
    float centreA=-0.55+sin(phase*0.23)*0.10;
    float centreB=2.30+sin(phase*0.17+1.8)*0.08;
    float mint=max(
        pixelAuroraLine(azimuth,elevation,phase,centreA,-0.10,0.0),
        pixelAuroraLine(azimuth,elevation,-phase*0.83,centreA,0.07,2.1));
    float violet=max(
        pixelAuroraLine(azimuth,elevation,phase*0.74,centreA,-0.015,4.0),
        pixelAuroraLine(azimuth,elevation,-phase*0.66,centreB,-0.055,1.3)*0.52);
    mint=max(mint,pixelAuroraLine(azimuth,elevation,phase*0.58,
        centreB,0.035,3.2)*0.45);
    float crossing=min(mint,violet);
    vec3 colour=vec3(0.33,0.88,0.74)*mint
        +vec3(0.58,0.29,0.72)*violet*0.54
        +vec3(0.29,0.67,0.72)*crossing*0.10;
    return colour*visibility*0.38;
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
