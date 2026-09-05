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
uniform float ae_biomeFog;
uniform float ae_biomeWarmth;
uniform sampler2D ae_shadowMap;
uniform float ae_shadowMapEnabled;
uniform float ae_shadowStrength;
uniform float ae_shadowSoftness;
uniform float ae_shadowBias;
uniform vec3 ae_sunDirection;
uniform vec3 ae_moonDirection;
uniform float ae_moonStrength;
uniform float ae_moonRayStrength;
uniform vec3 ae_shadowDirection;
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

    float slope = 1.0 - max(dot(normalize(normal), normalize(ae_shadowDirection)), 0.0);
    float receiverSlope = clamp(max(abs(dFdx(projected.z)), abs(dFdy(projected.z))) * 0.25, 0.0, 0.00018);
    // Cover the depth footprint of slanted receivers within the filtered texels.
    float footprintBias=length(1.0/vec2(textureSize(ae_shadowMap,0)))
        *slope*mix(0.7,1.4,smoothstep(24.0,110.0,length(fragPosition-viewPos)));
    float bias = ae_shadowBias * (0.30 + slope * 0.70) + receiverSlope + footprintBias;
    vec2 texel = 1.0 / vec2(textureSize(ae_shadowMap, 0));
    float softness = max(ae_shadowSoftness, 0.05);
    float lit = 0.0;
    float totalWeight = 0.0;
    float radius = mix(0.65, 1.10, clamp(softness * 0.5, 0.0, 1.0));
    radius *= mix(1.0,1.8,smoothstep(24.0,110.0,length(fragPosition-viewPos)));
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
    float distanceFade=1.0-smoothstep(12.0,38.0,length(fragPosition-viewPos));
    return mix(1.0, lit / totalWeight, edgeFade*distanceFade);
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
    float exposure = mix(1.02, 0.90, smoothstep(0.12, 0.82, skyLuma));
    color *= exposure;
    float sceneLuma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color *= mix(vec3(0.96, 0.99, 1.035), vec3(0.99, 1.0, 1.02),
        smoothstep(0.08, 0.75, sceneLuma));
    color = color * (2.51 * color + 0.03) / max(color * (2.43 * color + 0.59) + 0.14, vec3(0.001));
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float chroma = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
    float adaptiveSaturation = ae_saturation * 1.09 + (1.0 - smoothstep(0.08, 0.50, chroma)) * 0.035;
    color = mix(vec3(luma), color, adaptiveSaturation);
    color = (color - 0.5) * (1.0+(ae_contrast-1.0)*0.45) * 1.025 + 0.5;
    color *= vec3(0.98 + ae_warmth * 0.02, 1.0, 1.025 - ae_warmth * 0.015);
    // Gentle split toning and highlight shoulder; no texture blur.
    float toneLuma=dot(color,vec3(0.2126,0.7152,0.0722));
    vec3 tone=mix(vec3(0.97,0.995,1.035),vec3(0.995,1.005,1.02),
        smoothstep(0.15,0.75,toneLuma));
    color*=tone;
    color=color/(1.0+max(color-vec3(0.86),vec3(0.0))*0.24);
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
    float atmosphereLuma=dot(baseAtmosphere,vec3(0.2126,0.7152,0.0722));
    baseAtmosphere=mix(vec3(atmosphereLuma),baseAtmosphere,0.65);
    float desertDay=ae_biomeWarmth*smoothstep(0.02,0.28,ae_sunDirection.y);
    baseAtmosphere=mix(baseAtmosphere,baseAtmosphere*vec3(1.05,1.0,0.76),desertDay*0.78);
    vec3 rayleigh = vec3(0.135, 0.16, 0.19) * rayleighPhase * horizon * 0.20;
    vec3 mie = vec3(1.0, 0.55, 0.22) * miePhase * 0.014 * (0.3 + horizon * 0.7);
    // Low-amplitude directional gradient, coloured by the native biome/day palette.
    float sunFacing=pow(max(mu,0.0),4.0)*smoothstep(0.0,0.22,ae_sunDirection.y);
    vec3 gradientTint=mix(vec3(0.96,0.99,1.035),vec3(1.035,1.015,0.98),sunFacing);
        vec3 nearTint=vec3(0.97,1.0,1.03);
    vec3 middleTint=vec3(0.99,0.995,1.02);
    float middleBlend=smoothstep(25.0,140.0,distanceToCamera);
    vec3 layeredTint=mix(nearTint,middleTint,middleBlend);
    layeredTint=mix(layeredTint,gradientTint,smoothstep(120.0, max(fogEnd,121.0),distanceToCamera));
    // Gentle distance-dependent colour filter on the fog, not on surface textures.
    float closeBlend=1.0-smoothstep(8.0,65.0,distanceToCamera);
    float night=1.0-smoothstep(-0.08,0.18,ae_sunDirection.y);
    vec3 closeFilter=mix(vec3(1.015,1.005,0.99),vec3(0.97,0.99,1.02),night);
    baseAtmosphere*=layeredTint*mix(vec3(1.0),closeFilter,closeBlend);
    baseAtmosphere=mix(baseAtmosphere,vec3(atmosphereLuma),closeBlend*0.06);
    return clamp(baseAtmosphere + (rayleigh + mie*0.30) * opticalDepth * ae_fogStrength*smoothstep(0.03,0.20,ae_sunDirection.y), 0.0, 1.0);
}

// Single scattering integrated along the camera ray, occluded by the shadow map.
uniform mat4 ae_lightViewProjection;
uniform float ae_underwater;
uniform float ae_waterSurface;
uniform float ae_morningRays;
uniform float ae_cloudTime;
uniform int ae_raySteps;
vec3 volumetricShafts(vec3 ray, float rayLength)
{
    if(ae_underwater>0.5) {
        float sun=smoothstep(0.04,0.25,ae_sunDirection.y);
        vec3 lightDir=normalize(ae_sunDirection);
        float segment=min(rayLength,20.0);
        if(ray.y>0.001)segment=min(segment,max(0.0,(ae_waterSurface-viewPos.y)/ray.y));
        float sum=0.0;
        for(int k=0;k<12;k++) {
            float travel=(float(k)+0.5)*segment/12.0;
            vec3 p=viewPos+ray*travel;
            float depth=max(ae_waterSurface-p.y,0.0);
            vec2 entry=p.xz+lightDir.xz*depth/max(lightDir.y,0.15);
            // Broad, irregular shafts carried by a slowly moving surface pattern.
            float field=sin(entry.x*0.73+sin(entry.y*0.49)+ae_cloudTime*0.12)
                *sin(entry.y*0.61-entry.x*0.27-ae_cloudTime*0.09);
            float beam=smoothstep(0.20,0.85,field);
            sum+=beam*exp(-travel*0.06-depth*0.12)*segment/12.0;
        }
        float phase=0.5+0.5*pow(max(dot(ray,lightDir),0.0),3.0);
        return vec3(0.35,0.72,0.82)*min(sum*0.065,0.22)*sun*phase;
    }
    if (ae_shadowMapEnabled < 0.5) return vec3(0.0);
    bool submerged = ae_underwater > 0.5;
    if (submerged && ae_sunDirection.y <= 0.04) return vec3(0.0);
    float lengthInFog = min(rayLength,submerged?24.0:96.0);
    if(ae_underwater>0.5 && ray.y>0.001)
        lengthInFog=min(lengthInFog,max(0.0,(ae_waterSurface-viewPos.y)/ray.y));
    int shaftSteps=clamp(ae_raySteps,12,24);
    float ds = lengthInFog / float(shaftSteps);
    float illumination = 0.0;
    for (int i = 0; i < 24; ++i)
    {
        if(i>=shaftSteps)break;
        float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        float travel = (float(i) + 0.25 + 0.5*jitter) * ds;
        vec4 light = vec4(viewPos + ray * travel, 1.0) * ae_lightViewProjection;
        vec3 uvz = light.xyz / light.w * 0.5 + 0.5;
        if (all(greaterThan(uvz, vec3(0.001))) && all(lessThan(uvz, vec3(0.999))))
        {
            float depth=texture(ae_shadowMap,uvz.xy).r;
            float visible=smoothstep(-0.00035,0.00035,depth-uvz.z);
            illumination += visible * exp(-travel * mix(0.012,0.06,ae_underwater)) * ds * mix(0.012,0.085,ae_underwater);
        }
    }
    float sunForward=pow(max(dot(ray,normalize(ae_sunDirection)),0.0),8.0);
    float moonForward=pow(max(dot(ray,normalize(ae_moonDirection)),0.0),10.0);
    float daylight=smoothstep(0.02,0.22,ae_sunDirection.y);
    float moonlight=smoothstep(0.02,0.24,ae_moonDirection.y)
        *clamp(ae_moonStrength,0.0,1.0)*(1.0-daylight);
    vec3 sunShaft=vec3(0.93,0.94,1.0)
        *(0.054+sunForward*0.46)*daylight*max(ae_morningRays,1.0);
    vec3 moonShaft=vec3(0.48,0.63,1.0)
        *(0.025+moonForward*0.28)*moonlight*ae_moonRayStrength;
    if (submerged) {
        // Broad, bounded scattering: no morning multiplier or bright solar disk.
        float waterDepth=max(ae_waterSurface-viewPos.y,0.0);
        vec3 waterShaft=vec3(0.30,0.65,0.75)*(0.10+sunForward*0.10);
        return waterShaft*min(illumination,0.85)*daylight
            *exp(-waterDepth*0.10)*clamp(ae_fogStrength,0.0,1.5);
    }
    return illumination*ae_fogStrength*(sunShaft+moonShaft);
}
uniform samplerCube ae_localShadow;
uniform float ae_localActive;
uniform float ae_localRange;
uniform vec3 ae_localPosition;
uniform vec3 ae_localShadowPosition;
uniform vec3 ae_localColor;
uniform float ae_localGain;
vec3 cubeTexelDirection(vec3 v) {
    vec3 a=abs(v); vec2 st; int face;
    if(a.x>=a.y && a.x>=a.z){face=v.x>0.0?0:1;st=vec2(v.x>0.0?-v.z:v.z,-v.y)/a.x;}
    else if(a.y>=a.z){face=v.y>0.0?2:3;st=vec2(v.x,v.y>0.0?v.z:-v.z)/a.y;}
    else{face=v.z>0.0?4:5;st=vec2(v.z>0.0?v.x:-v.x,-v.y)/a.z;}
    st=(clamp(floor((st*0.5+0.5)*512.0),vec2(0),vec2(511))+0.5)/512.0*2.0-1.0;
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
    float footprintBias=min(0.06,d*(2.0/512.0)*(1.0-facing)/max(facing,0.2));
    float bias=0.008+footprintBias;
    float visibility=0.0;
    float width=0.008+d*0.0025;
    float blockerDistance=texture(ae_localShadow,direction).r*ae_localRange;
    float penumbra=clamp((d-blockerDistance)/max(blockerDistance,0.5),0.0,2.0);
    float filterRadius=1.0+penumbra*1.5;
    for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
        vec3 sampleDirection=normalize(direction+(tangent*float(x)+bitangent*float(y))*(2.0/512.0)*filterRadius);
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
    return pow(max(ae_localColor,vec3(0)),vec3(2.2))*ae_localGain*attenuation*(0.25+0.75*facing)*visibility;
}
float distanceTransmittance(float d,vec3 ray) {
    float endDistance=max(fogEnd,1.0);
    float density=ae_biomeFog>0.0?ae_biomeFog:1.0;
    float x=max(d,0.0);
    // Smooth optical depths add before exponentiation; never add layer alpha.
    float closeDepth=0.04*x*x/((x+12.0)*(x+12.0));
    float nearDepth=0.16*x*x/((x+55.0)*(x+55.0));
    float middleDepth=0.30*x*x/((x+115.0)*(x+115.0));
    float farDepth=1.65*pow(x/endDistance,2.1);
    float horizon=1.0+0.12*pow(1.0-abs(ray.y),2.0);
    float depth=(closeDepth+nearDepth+middleDepth+farDepth)*density*ae_fogStrength*horizon;
    float altitude=max(viewPos.y-64.0,0.0);
    float vertical=ray.y*x;
    float slope=clamp(vertical*0.012,-4.0,4.0);
    float heightIntegral=abs(slope)<0.001?1.0:(1.0-exp(-slope))/slope;
    float heightDepth=min(0.18,x*0.0011*exp(-altitude*0.012)*heightIntegral);
    float visibility=exp(-(depth+heightDepth*ae_fogStrength));
    return visibility*(1.0-smoothstep(endDistance*0.65,endDistance*0.995,x));
}


uniform float ae_cloudShadowStrength;
float cloudShadowHash(vec2 p){
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
float cloudShadowNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(cloudShadowHash(i),cloudShadowHash(i+vec2(1,0)),f.x),
               mix(cloudShadowHash(i+vec2(0,1)),cloudShadowHash(i+vec2(1,1)),f.x),f.y);
}
float terrainCloudShadow(vec3 position){
    float sunY=ae_sunDirection.y;
    if(sunY<=0.035 || position.y>=256.0)return 0.0;
    float travel=(272.0-position.y)/sunY;
    vec2 wind=vec2(ae_cloudTime*2.0,ae_cloudTime*0.55);
    vec2 projected=position.xz+ae_sunDirection.xz*travel-wind;
    float sum=0.0;
    const vec2 taps[9]=vec2[9](vec2(0),vec2(14,0),vec2(-14,0),
        vec2(0,14),vec2(0,-14),vec2(10,10),vec2(-10,10),
        vec2(10,-10),vec2(-10,-10));
    for(int i=0;i<9;i++){
        vec2 p=projected+taps[i];
        float shape=cloudShadowNoise(p*0.010)*0.8
            +cloudShadowNoise(p*0.035+17.0)*0.2-0.57;
        sum+=smoothstep(-0.035,0.075,shape);
    }
    return sum/9.0*smoothstep(0.035,0.22,sunY);
}
vec3 underwaterParticles(vec3 ray,float sceneDistance) {
    if(ae_underwater<0.5)return vec3(0);
    float limit=min(sceneDistance,14.0);
    if(ray.y>0.001)limit=min(limit,max((ae_waterSurface-viewPos.y)/ray.y,0.0));
    vec3 origin=viewPos-vec3(0,ae_cloudTime*0.08,0);
    vec3 cell=floor(origin/0.8), stepDir=sign(ray);
    vec3 safeRay=vec3(abs(ray.x)<0.00001?0.00001:ray.x,abs(ray.y)<0.00001?0.00001:ray.y,abs(ray.z)<0.00001?0.00001:ray.z);
    vec3 nextT=((cell+step(vec3(0),ray))*0.8-origin)/safeRay;
    vec3 deltaT=abs(vec3(0.8)/safeRay);
    float t=0.0, glow=0.0;
    for(int i=0;i<16;i++){
        if(t>limit)break;
        float seed=fract(sin(dot(cell,vec3(17.13,61.7,29.3)))*43758.5453);
        if(seed>0.72){
            vec3 center=(cell+vec3(0.2+seed*0.6,0.5,0.2+fract(seed*13.7)*0.6))*0.8;
            vec3 delta=center-origin;float along=dot(delta,ray);
            if(along>0.15 && along<limit){
                vec3 axis=normalize(cross(ray,abs(ray.y)<0.95?vec3(0,1,0):vec3(1,0,0)));
                vec3 axis2=cross(ray,axis);
                float r=max(abs(dot(delta,axis)),abs(dot(delta,axis2)));
                float radius=0.012+seed*0.01;
                float aa=max(along*0.001,0.002);
                float disk=1.0-smoothstep(radius-aa,radius+aa,r);
                glow+=disk*exp(-along*0.18)*0.12;
            }
        }
        if(nextT.x<=nextT.y && nextT.x<=nextT.z){t=nextT.x;nextT.x+=deltaT.x;cell.x+=stepDir.x;}
        else if(nextT.y<=nextT.z){t=nextT.y;nextT.y+=deltaT.y;cell.y+=stepDir.y;}
        else{t=nextT.z;nextT.z+=deltaT.z;cell.z+=stepDir.z;}
    }
    return vec3(0.5,0.8,0.85)*min(glow,0.18);
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
    float shadowAmount = (1.0 - mapLight) * clamp(ae_shadowStrength * 0.85, 0.0, 0.88) * ae_shadowMapEnabled * outdoorShadow;
    enhancedLit = max(enhancedLit - albedo.rgb * directSunlight * shadowAmount, vec3(0.0));
    float cloudShade=terrainCloudShadow(fragPosition)
        *smoothstep(0.72,0.98,skyVisibility);
    enhancedLit=max(enhancedLit-albedo.rgb*directSunlight*cloudShade*ae_cloudShadowStrength,vec3(0.0));
    vec3 geometric=cross(dFdx(fragPosition),dFdy(fragPosition));
    geometric=length(geometric)>0.000001?normalize(geometric):normalize(worldNormal);
    if(dot(geometric,ae_localPosition-fragPosition)<0.0)geometric=-geometric;
    vec3 receiverNormal=normalize(mix(worldNormal,geometric,vegetationFactor));
    enhancedLit += albedo.rgb * paintCol * localDirectLight(fragPosition,receiverNormal);
    vec3 enhanced = max(enhancedLit, emission);
    // Stylized surface caustics, not simulated refracted photon transport.
    float sunAbove=smoothstep(0.08,0.30,ae_sunDirection.y);
    // Two moving, rotated wave fields form broad caustic islands without parallel bands.
    vec2 causticUV=fragPosition.xz*0.82;
    float causticA=sin(causticUV.x*1.31+sin(causticUV.y*0.91+ae_cloudTime*0.31));
    float causticB=sin(dot(causticUV,vec2(-0.73,1.19))-ae_cloudTime*0.24+
        sin(dot(causticUV,vec2(1.11,0.47))+ae_cloudTime*0.17));
    float caustic=smoothstep(0.60,0.94,abs(causticA*0.55+causticB*0.45));
    float waterDepth=max(ae_waterSurface-fragPosition.y,0.0);
    float movingLight=caustic*(0.55+0.45*sin(ae_cloudTime*0.37+fragPosition.x*0.08));
    enhanced+=albedo.rgb*vec3(0.38,0.66,0.72)*movingLight*0.075*ae_underwater*sunAbove*mapLight
        *max(worldNormal.y,0.0)*exp(-waterDepth*0.16);
    vec3 viewDirection = normalize(viewPos - fragPosition);
    vec3 normal = normalize(worldNormal);
    float leafTransmission = vegetationFactor
        * pow(max(dot(-normal, normalize(ae_sunDirection)), 0.0), 1.5)
        * smoothstep(0.72, 0.98, skyVisibility);
    enhanced += albedo.rgb * vec3(1.0, 0.72, 0.34) * leafTransmission * 0.10 * smoothstep(0.0,0.15,ae_sunDirection.y);
    float luma = dot(albedo.rgb, vec3(0.2126, 0.7152, 0.0722));
    float chroma = max(albedo.r, max(albedo.g, albedo.b)) - min(albedo.r, min(albedo.g, albedo.b));
    float smoothMaterial = smoothstep(0.82, 0.97, luma) * (1.0 - smoothstep(0.05, 0.16, chroma));
    smoothMaterial *= smoothstep(0.25, 0.85, normal.y);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
    float sunGlint = pow(max(dot(reflect(-normalize(ae_sunDirection), normal), viewDirection), 0.0), 72.0);
    vec3 reflectedLight = environmentReflection(normal, viewDirection) * (0.008 + fresnel * 0.055) + vec3(sunGlint * 0.10 * smoothstep(0.0,0.15,ae_sunDirection.y));
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
    float fogAmount = max((1.0 - visibility) * ae_fogStrength * 0.42, exponentialFog * 0.30) * smoothstep(fogEnd*0.40,fogEnd*0.90,distanceToCamera);
    float nearbyHaze=(1.0-exp(-distanceToCamera/90.0))*0.035*ae_fogStrength;
    float biomeDensity=ae_biomeFog>0.0?ae_biomeFog:1.0;
    float enhancedVisibility = distanceTransmittance(distanceToCamera,viewRay);
    vec3 atmosphere = atmosphericScattering(viewRay, distanceToCamera);
    vec3 enhancedFogged = mix(atmosphere, gradeColor(enhanced), enhancedVisibility);
    enhancedFogged += volumetricShafts(viewRay, distanceToCamera);
    vec3 vanillaFogged = mix(mix(fogColor.rgb, fogMidColor.rgb, visibility), vanilla, visibility);
    outputColor = vec4(mix(vanillaFogged, enhancedFogged, clamp(ae_enabled, 0.0, 1.0)), albedo.a);
        outputColor.rgb+=ae_enabled*underwaterParticles(viewRay,distanceToCamera);
    if(ae_enabled>0.0 && ae_underwater>0.5) {
        // Continuous depth haze and slow current variation replace the old hard light bands.
        float waterDistance=min(distanceToCamera,32.0);
        float extinction=1.0-exp(-waterDistance*0.050);
        // Non-directional breathing only: moving sine fields produced visible travelling bands.
        float current=0.5+0.5*sin(ae_cloudTime*0.16);
        vec3 waterFog=mix(vec3(0.030,0.115,0.17),vec3(0.050,0.18,0.23),current*0.18);
        outputColor.rgb=mix(outputColor.rgb,waterFog,extinction*0.48);
    }
}
