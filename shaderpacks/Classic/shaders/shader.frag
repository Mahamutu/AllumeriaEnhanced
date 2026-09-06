#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;
in vec2 texCoord;
in vec4 vertexCol;
in vec4 vanillaVertexCol;
in vec3 paintCol;
in vec3 fragPosition;
in vec3 worldNormal;
in float skyVisibility;
in vec4 lightSpacePosition;
in vec3 directSunlight;
in float vegetationFactor;

uniform sampler2D texture0;
uniform sampler2D texture1;
uniform vec4 fogColor;
uniform vec4 fogMidColor;
uniform float fogStart;
uniform float fogEnd;
uniform vec3 viewPos;
uniform float ae_enabled;
uniform float ae_saturation;
uniform float ae_contrast;
uniform float ae_warmth;
uniform float ae_fogStrength;
uniform sampler2D ae_shadowMap;
uniform float ae_shadowMapEnabled;
uniform float ae_shadowStrength;
uniform float ae_shadowSoftness;
uniform float ae_shadowBias;
uniform vec3 ae_sunDirection;
uniform float ae_reflections;
uniform float ae_reflectionStrength;

float stableShadowCompare(vec2 uv, float receiver, float width) {
    ivec2 size=textureSize(ae_shadowMap,0);
    vec2 p=uv*vec2(size)-0.5;
    ivec2 cell=ivec2(floor(p));vec2 f=fract(p);
    ivec2 hi=size-ivec2(1);
    float a=smoothstep(-width,width,texelFetch(ae_shadowMap,clamp(cell,ivec2(0),hi),0).r-receiver);
    float b=smoothstep(-width,width,texelFetch(ae_shadowMap,clamp(cell+ivec2(1,0),ivec2(0),hi),0).r-receiver);
    float c=smoothstep(-width,width,texelFetch(ae_shadowMap,clamp(cell+ivec2(0,1),ivec2(0),hi),0).r-receiver);
    float d=smoothstep(-width,width,texelFetch(ae_shadowMap,clamp(cell+ivec2(1,1),ivec2(0),hi),0).r-receiver);
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float sampleShadow(vec4 lightPosition, vec3 normal)
{
    vec3 projected = lightPosition.xyz / max(lightPosition.w, 0.00001);
    projected = projected * 0.5 + 0.5;
    if (projected.z <= 0.0 || projected.z >= 1.0 || any(lessThan(projected.xy, vec2(0.0))) || any(greaterThan(projected.xy, vec2(1.0))))
        return 1.0;

    float slope = 1.0 - max(dot(normalize(normal), normalize(ae_sunDirection)), 0.0);
    float receiverSlope = clamp(max(abs(dFdx(projected.z)), abs(dFdy(projected.z))) * 0.25, 0.0, 0.00018);
    float bias = ae_shadowBias * (0.30 + slope * 0.70) + receiverSlope;
    vec2 texel = 1.0 / vec2(textureSize(ae_shadowMap, 0));
    float softness = max(ae_shadowSoftness, 0.05);
    float lit = 0.0;
    float totalWeight = 0.0;
    float radius = mix(0.8, 1.5, clamp(softness * 0.5, 0.0, 1.0));
    float depthTransition = max(0.000025, softness * 0.00005);
    for (int x = -1; x <= 1; ++x)
        for (int y = -1; y <= 1; ++y)
        {
            float weight = (x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0);
            float filtered = stableShadowCompare(projected.xy + vec2(x,y)*texel*radius, projected.z-bias, depthTransition);
            lit += filtered * weight;
            totalWeight += weight;
        }
    float edgeDistance = min(min(projected.x, 1.0 - projected.x), min(projected.y, 1.0 - projected.y));
    float edgeFade = smoothstep(0.015, 0.075, edgeDistance);
    return mix(1.0, lit / totalWeight, edgeFade);
}

vec3 environmentReflection(vec3 normal, vec3 viewDirection)
{
    vec3 reflected = reflect(-viewDirection, normal);
    float skyAmount = smoothstep(-0.15, 0.75, reflected.y);
    return mix(fogColor.rgb, fogMidColor.rgb, skyAmount);
}

vec3 gradeColor(vec3 color)
{
    float skyLuma = dot(fogMidColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float exposure = mix(1.08, 0.92, smoothstep(0.12, 0.82, skyLuma));
    color *= exposure;
    color = color * (2.51 * color + 0.03) / max(color * (2.43 * color + 0.59) + 0.14, vec3(0.001));
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float chroma = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
    float adaptiveSaturation = ae_saturation + (1.0 - smoothstep(0.08, 0.50, chroma)) * 0.035;
    color = mix(vec3(luma), color, adaptiveSaturation);
    color = (color - 0.5) * ae_contrast + 0.5;
    color *= vec3(1.0 + ae_warmth * 0.06, 1.0 + ae_warmth * 0.015, 1.0 - ae_warmth * 0.045);
    return clamp(color, 0.0, 1.0);
}

vec3 atmosphericScattering(vec3 viewRay, float distanceToCamera)
{
    vec3 sunDirection = normalize(ae_sunDirection);
    float mu = clamp(dot(viewRay, sunDirection), -1.0, 1.0);
    float rayleighPhase = 0.75 * (1.0 + mu * mu);
    float g = 0.76;
    float miePhase = (1.0 - g * g) / max(pow(1.0 + g * g - 2.0 * g * mu, 1.5), 0.025);
    float horizon = pow(1.0 - clamp(abs(viewRay.y), 0.0, 1.0), 2.2);
    float opticalDepth = 1.0 - exp(-distanceToCamera / max(fogEnd * 0.62, 1.0));
    vec3 baseAtmosphere = mix(fogColor.rgb, fogMidColor.rgb, clamp(abs(viewRay.y) * 1.6, 0.0, 1.0));
    vec3 rayleigh = vec3(0.08, 0.22, 0.54) * rayleighPhase * horizon * 0.20;
    vec3 mie = vec3(1.0, 0.55, 0.22) * miePhase * 0.014 * (0.3 + horizon * 0.7);
    return clamp(baseAtmosphere + (rayleigh + mie) * opticalDepth * ae_fogStrength, 0.0, 1.0);
}

uniform samplerCube ae_localShadow;
uniform float ae_localActive;
uniform float ae_localRange;
uniform vec3 ae_localPosition;
uniform vec3 ae_localShadowPosition;
uniform vec3 ae_localColor;
vec3 cubeTexelDirection(vec3 v) {
    vec3 a=abs(v); vec2 st; int face;
    if(a.x>=a.y && a.x>=a.z){face=v.x>0.0?0:1;st=vec2(v.x>0.0?-v.z:v.z,-v.y)/a.x;}
    else if(a.y>=a.z){face=v.y>0.0?2:3;st=vec2(v.x,v.y>0.0?v.z:-v.z)/a.y;}
    else{face=v.z>0.0?4:5;st=vec2(v.z>0.0?v.x:-v.x,-v.y)/a.z;}
    float size=float(textureSize(ae_localShadow,0).x);
    st=(clamp(floor((st*0.5+0.5)*size),vec2(0),vec2(size-1.0))+0.5)/size*2.0-1.0;
    if(face==0)return normalize(vec3(1,-st.y,-st.x));
    if(face==1)return normalize(vec3(-1,-st.y,st.x));
    if(face==2)return normalize(vec3(st.x,1,st.y));
    if(face==3)return normalize(vec3(st.x,-1,-st.y));
    if(face==4)return normalize(vec3(st.x,-st.y,1));
    return normalize(vec3(-st.x,-st.y,-1));
}
vec3 localDirectLight(vec3 position, vec3 normal) {
    if(ae_localActive<0.5) return vec3(0.0);
    vec3 delta=position-ae_localShadowPosition;
    float d=length(delta);
    if(d>=ae_localRange || d<0.001) return vec3(0.0);
    vec3 direction=delta/d;
    vec3 tangent=normalize(cross(direction,abs(direction.y)<0.95?vec3(0,1,0):vec3(1,0,0)));
    vec3 bitangent=cross(direction,tangent);
    float facing=max(dot(normalize(normal),-delta/max(d,0.001)),0.0);
    vec3 planeCross=cross(dFdx(position),dFdy(position));
    vec3 planeNormal=length(planeCross)>0.000001?normalize(planeCross):normalize(normal);
    float planeNumerator=dot(planeNormal,delta);
    // Account for the nearest cubemap texel footprint at grazing angles.
    float cubeSize=float(textureSize(ae_localShadow,0).x);
    float footprintBias=min(0.06,d*(2.0/cubeSize)*(1.0-facing)/max(facing,0.2));
    float bias=0.008+footprintBias;
    float visibility=0.0;
    float width=0.006+d*0.0015;
    for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
        vec3 sampleDirection=normalize(direction+(tangent*float(x)+bitangent*float(y))*(2.0/cubeSize));
        sampleDirection=cubeTexelDirection(sampleDirection);
        float planeDenominator=dot(planeNormal,sampleDirection);
        float receiverDistance=d;
        if(abs(planeDenominator)>0.08)
            receiverDistance=clamp(planeNumerator/planeDenominator,d-0.15,d+0.15);
        float stored=texture(ae_localShadow,sampleDirection).r*ae_localRange;
        float weight=(x==0?2.0:1.0)*(y==0?2.0:1.0);
        visibility+=smoothstep(-width,width,stored-(receiverDistance-bias))*weight;
    }
    visibility/=16.0;
    float attenuation=min(5.5/max(d*d,0.20),1.0)*(1.0-smoothstep(ae_localRange*0.7,ae_localRange,d));
    return ae_localColor*attenuation*(0.25+0.75*facing)*visibility;
}
void main()
{
    ae_objectMask=vec4(0,0,0,1);
    vec4 albedo = texture(texture0, texCoord);
    if (albedo.a < 0.5)
        discard;

    vec3 emission = texture(texture1, texCoord).rgb * paintCol;
    vec3 vanilla = max((albedo * vanillaVertexCol).rgb, emission);
    vec3 enhancedLit = (albedo * vertexCol).rgb;
    float mapLight = sampleShadow(lightSpacePosition, worldNormal);
    float outdoorShadow = smoothstep(0.72, 0.98, skyVisibility);
    float shadowAmount = (1.0 - mapLight) * clamp(ae_shadowStrength * 0.72, 0.0, 0.88) * ae_shadowMapEnabled * outdoorShadow;
    enhancedLit = max(enhancedLit - albedo.rgb * directSunlight * shadowAmount, vec3(0.0));
    vec3 geometric=cross(dFdx(fragPosition),dFdy(fragPosition));
    geometric=length(geometric)>0.000001?normalize(geometric):normalize(worldNormal);
    if(dot(geometric,ae_localPosition-fragPosition)<0.0)geometric=-geometric;
    vec3 receiverNormal=normalize(mix(worldNormal,geometric,vegetationFactor));
    enhancedLit += albedo.rgb * paintCol * localDirectLight(fragPosition,receiverNormal);
    vec3 enhanced = max(enhancedLit, emission);
    vec3 viewDirection = normalize(viewPos - fragPosition);
    vec3 normal = normalize(worldNormal);
    float leafTransmission = vegetationFactor
        * pow(max(dot(-normal, normalize(ae_sunDirection)), 0.0), 1.5)
        * smoothstep(0.72, 0.98, skyVisibility);
    enhanced += albedo.rgb * vec3(1.0, 0.72, 0.34) * leafTransmission * 0.10;
    float luma = dot(albedo.rgb, vec3(0.2126, 0.7152, 0.0722));
    float chroma = max(albedo.r, max(albedo.g, albedo.b)) - min(albedo.r, min(albedo.g, albedo.b));
    float smoothMaterial = smoothstep(0.82, 0.97, luma) * (1.0 - smoothstep(0.05, 0.16, chroma));
    smoothMaterial *= smoothstep(0.25, 0.85, normal.y);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
    float sunGlint = pow(max(dot(reflect(-normalize(ae_sunDirection), normal), viewDirection), 0.0), 72.0);
    vec3 reflectedLight = environmentReflection(normal, viewDirection) * (0.008 + fresnel * 0.055) + vec3(sunGlint * 0.10);
    enhanced += reflectedLight * smoothMaterial * ae_reflectionStrength * ae_reflections;
    float distanceToCamera = length(viewPos - fragPosition);
    float fogRange = max(fogEnd - fogStart, 0.001);
    float visibility = clamp((fogEnd - distanceToCamera) / fogRange, 0.0, 1.0);
    visibility = visibility * visibility * (3.0 - 2.0 * visibility);
    vec3 viewRay = normalize(fragPosition - viewPos);
    float horizonBand = smoothstep(0.55, 0.96, 1.0 - abs(viewRay.y));
    float distanceBand = smoothstep(fogStart * 0.72, fogEnd, distanceToCamera);
    float horizonHaze = horizonBand * distanceBand * ae_fogStrength;
    float exponentialFog = 1.0 - exp(-pow(distanceToCamera / max(fogEnd, 1.0), 1.45) * 1.65 * ae_fogStrength);
    float fogAmount = max((1.0 - visibility) * ae_fogStrength, exponentialFog * 0.68);
    float enhancedVisibility = 1.0 - clamp(fogAmount + horizonHaze * 0.12, 0.0, 0.96);
    vec3 atmosphere = atmosphericScattering(viewRay, distanceToCamera);
    vec3 enhancedFogged = mix(atmosphere, gradeColor(enhanced), enhancedVisibility);
    vec3 vanillaFogged = mix(mix(fogColor.rgb, fogMidColor.rgb, visibility), vanilla, visibility);
    outputColor = vec4(mix(vanillaFogged, enhancedFogged, clamp(ae_enabled, 0.0, 1.0) * 0.38), albedo.a);
}
