#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;
in vec2 texCoord;
flat in float ae_isHand;
in vec4 vertexCol;
in vec3 fragPosition;

uniform sampler2D texture0;
uniform vec3 ae_handLightColor;
uniform vec4 fogColor;
uniform vec4 fogMidColor;
uniform float fogStart;
uniform float fogEnd;
uniform vec3 viewPos;
uniform vec3 ae_sunDirection;
uniform float ae_enabled;
uniform float ae_saturation;
uniform float ae_contrast;
uniform float ae_warmth;
uniform float ae_fogStrength;
uniform float ae_biomeFog;
uniform float ae_biomeWarmth;

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

uniform float ae_underwater;
uniform float ae_waterSurface;
uniform float ae_cloudTime;
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
    ae_objectMask=vec4(ae_isHand,0,0,1);
    vec4 sourceTexel = texture(texture0, texCoord);
    vec4 texel = sourceTexel * vertexCol;
    float heldEmitter=max(ae_handLightColor.r,max(ae_handLightColor.g,ae_handLightColor.b));
    vec3 heldTint=ae_handLightColor/max(heldEmitter,0.001);
    texel.rgb=max(texel.rgb,sourceTexel.rgb*(vec3(0.34)+heldTint*0.46)*ae_isHand*step(0.01,heldEmitter));
    if (texel.a < 0.5)
        discard;
    float d = length(viewPos - fragPosition);
    float visibility = clamp((fogEnd - d) / max(fogEnd - fogStart, 0.001), 0.0, 1.0);
    visibility = visibility * visibility * (3.0 - 2.0 * visibility);
    vec3 atmosphere = mix(fogColor.rgb, fogMidColor.rgb, visibility);
    vec3 viewRay = normalize(fragPosition - viewPos);
    float horizonHaze = smoothstep(0.55, 0.96, 1.0 - abs(viewRay.y))
        * smoothstep(fogStart * 0.72, fogEnd, d) * ae_fogStrength;
    float enhancedVisibility = distanceTransmittance(d,viewRay);
    vec3 enhanced = mix(atmosphericScattering(viewRay,d), gradeColor(texel.rgb), enhancedVisibility);
    outputColor = vec4(mix(texel.rgb, enhanced, clamp(ae_enabled, 0.0, 1.0)), texel.a);
    outputColor.rgb+=ae_enabled*underwaterParticles(viewRay,d);
}
