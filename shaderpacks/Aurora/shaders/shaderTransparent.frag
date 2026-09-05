#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;
in vec2 texCoord;
in vec4 vertexCol;
in vec3 fragPosition;
in vec3 worldNormal;

uniform sampler2D texture0; // surface texture
uniform sampler2D texture3; // screen color
uniform sampler2D texture4; // noise texture
uniform sampler2D texture5; // screen depth
uniform sampler2D ae_viewModelMask;
uniform float ae_maskReady;
uniform vec2 screenRes;
uniform vec4 fogColor;
uniform vec4 fogMidColor;
uniform float fogStart;
uniform float fogEnd;
uniform vec3 viewPos;
uniform vec3 ae_sunDirection;
uniform float uTime;
uniform int mode;
uniform mat4 view;
uniform mat4 projection;
uniform float ae_enabled;
uniform float ae_waterRefraction;
uniform float ae_saturation;
uniform float ae_contrast;
uniform float ae_fogStrength;
uniform float ae_biomeFog;
uniform float ae_reflections;
uniform float ae_reflectionStrength;
uniform int ae_raySteps;

vec4 filteredScene(vec2 uv) {
    // Explicit bilinear resolve: the native colour buffer can use nearest sampling.
    vec2 size=vec2(textureSize(texture3,0));
    vec2 pixel=uv*size-0.5;
    ivec2 base=ivec2(floor(pixel)), limit=ivec2(size)-1;
    vec2 f=fract(pixel);
    return mix(mix(texelFetch(texture3,clamp(base,ivec2(0),limit),0),
                       texelFetch(texture3,clamp(base+ivec2(1,0),ivec2(0),limit),0),f.x),
               mix(texelFetch(texture3,clamp(base+ivec2(0,1),ivec2(0),limit),0),
                       texelFetch(texture3,clamp(base+ivec2(1,1),ivec2(0),limit),0),f.x),f.y);
}
vec3 gradeColor(vec3 color)
{
    float skyLuma = dot(fogMidColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float exposure = mix(1.02, 0.90, smoothstep(0.12, 0.82, skyLuma));
    color *= exposure;
    color = color * (2.51 * color + 0.03) / max(color * (2.43 * color + 0.59) + 0.14, vec3(0.001));
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, ae_saturation * 1.09);
    return clamp((color - 0.5) * ae_contrast + 0.5, 0.0, 1.0);
}

float viewDistanceFromDepth(vec2 uv, float depth, mat4 inverseProjection)
{
    vec4 viewPosition = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0) * inverseProjection;
    return abs(viewPosition.z / max(abs(viewPosition.w), 0.00001));
}

bool traceScreenReflection(vec3 origin, vec3 direction, out vec2 hitUV, out float confidence)
{
    confidence=0.0;hitUV=vec2(0);
    vec3 start=(vec4(origin,1)*view).xyz;
    vec3 dir=normalize((vec4(direction,0)*view).xyz);
    float range=64.0;
    if(dir.z>0.00001)range=min(range,(-0.10-start.z)/dir.z);
    if(range<0.05 || start.z>=-0.10)return false;
    vec3 finish=start+dir*range;
    vec4 ca=vec4(start,1)*projection, cb=vec4(finish,1)*projection;
    vec2 a=ca.xy/ca.w*0.5+0.5,b=cb.xy/cb.w*0.5+0.5;
    vec2 delta=b-a;
    float endT=1.0;
    if(delta.x>0.000001)endT=min(endT,(0.998-a.x)/delta.x);
    if(delta.x< -0.000001)endT=min(endT,(0.002-a.x)/delta.x);
    if(delta.y>0.000001)endT=min(endT,(0.998-a.y)/delta.y);
    if(delta.y< -0.000001)endT=min(endT,(0.002-a.y)/delta.y);
    endT=clamp(endT,0.0,1.0);
    float pixels=max(abs(delta.x)*screenRes.x,abs(delta.y)*screenRes.y)*endT;
    int count=int(clamp(ceil(pixels),16.0,float(clamp(ae_raySteps*4,16,192))));
    float invA=1.0/ca.w,invB=1.0/cb.w;
    vec3 qa=start*invA,qb=finish*invB;
    mat4 inverseProjection=inverse(projection);
    float lastT=0.0;
    for(int i=0;i<192;i++){
        if(i>=count)break;
        float t=endT*(float(i)+1.0)/float(count);
        vec2 uv=a+delta*t;
        if(any(lessThan(uv,vec2(0.002))) || any(greaterThan(uv,vec2(0.998))))break;
        float prevZ=-(mix(qa,qb,lastT)/mix(invA,invB,lastT)).z;
        float currZ=-(mix(qa,qb,t)/mix(invA,invB,t)).z;
        float depth=texture(texture5,uv).r;
        bool masked=ae_maskReady>0.5 && texture(ae_viewModelMask,uv).r>0.5;
        float sceneZ=viewDistanceFromDepth(uv,depth,inverseProjection);
        float thickness=0.10+sceneZ*0.003;
        if(i>0 && !masked && depth<0.9999 &&
            min(prevZ,currZ)<=sceneZ+thickness && max(prevZ,currZ)>=sceneZ){
            float low=lastT,high=t;
            for(int j=0;j<6;j++){
                float mid=(low+high)*0.5;
                vec2 mUV=a+delta*mid;
                float mDepth=texture(texture5,mUV).r;
                float mScene=viewDistanceFromDepth(mUV,mDepth,inverseProjection);
                float mZ=-(mix(qa,qb,mid)/mix(invA,invB,mid)).z;
                float lowZ=-(mix(qa,qb,low)/mix(invA,invB,low)).z;
                if(min(lowZ,mZ)<=mScene+thickness && max(lowZ,mZ)>=mScene)high=mid;else low=mid;
            }
            uv=a+delta*((low+high)*0.5);
            if(ae_maskReady>0.5 && texture(ae_viewModelMask,uv).r>0.5){lastT=t;continue;}
            float finalT=(low+high)*0.5;
            float finalZ=-(mix(qa,qb,finalT)/mix(invA,invB,finalT)).z;
            float finalDepth=texture(texture5,uv).r;
            float surfaceZ=viewDistanceFromDepth(uv,finalDepth,inverseProjection);
            if(finalDepth>=0.9999 || abs(finalZ-surfaceZ)>thickness*2.0){lastT=t;continue;}
            float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
            hitUV=uv;confidence=smoothstep(0.003,0.055,edge)*(1.0-0.35*t);
            return confidence>0.01;
        }
        lastT=t;
    }
    return false;
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
    float limit=min(sceneDistance,18.0);
    if(ray.y>0.001)limit=min(limit,max((ae_waterSurface-viewPos.y)/ray.y,0.0));
    vec3 origin=viewPos-vec3(0,ae_cloudTime*0.08,0);
    vec3 cell=floor(origin/0.8), stepDir=sign(ray);
    vec3 safeRay=vec3(abs(ray.x)<0.00001?0.00001:ray.x,abs(ray.y)<0.00001?0.00001:ray.y,abs(ray.z)<0.00001?0.00001:ray.z);
    vec3 nextT=((cell+step(vec3(0),ray))*0.8-origin)/safeRay;
    vec3 deltaT=abs(vec3(0.8)/safeRay);
    float t=0.0, glow=0.0;
    for(int i=0;i<40;i++){
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

uniform sampler2D ae_shadowMap;
uniform float ae_shadowMapEnabled;
uniform mat4 ae_lightViewProjection;
uniform float ae_morningRays;
vec3 volumetricShafts(vec3 ray, float rayLength)
{
    if(ae_underwater>0.5) {
        float sun=smoothstep(0.04,0.25,ae_sunDirection.y);
        vec3 lightDir=normalize(ae_sunDirection);
        float segment=min(rayLength,20.0);
        if(ray.y>0.001)segment=min(segment,max(0.0,(ae_waterSurface-viewPos.y)/ray.y));
        float sum=0.0;
        for(int k=0;k<24;k++) {
            float travel=(float(k)+0.5)*segment/24.0;
            vec3 p=viewPos+ray*travel;
            float depth=max(ae_waterSurface-p.y,0.0);
            vec2 entry=p.xz+lightDir.xz*depth/max(lightDir.y,0.15);
            // Broad, irregular shafts carried by a slowly moving surface pattern.
            float field=sin(entry.x*0.73+sin(entry.y*0.49)+ae_cloudTime*0.12)
                *sin(entry.y*0.61-entry.x*0.27-ae_cloudTime*0.09);
            float beam=smoothstep(0.20,0.85,field);
            sum+=beam*exp(-travel*0.06-depth*0.12)*segment/24.0;
        }
        float phase=0.5+0.5*pow(max(dot(ray,lightDir),0.0),3.0);
        return vec3(0.35,0.72,0.82)*min(sum*0.065,0.22)*sun*phase;
    }
    if (ae_shadowMapEnabled < 0.5) return vec3(0.0);
    if(ae_underwater>0.5 && ae_sunDirection.y<0.04)return vec3(0.0);
    float lengthInFog = min(rayLength,ae_underwater>0.5?24.0:96.0);
    if(ae_underwater>0.5 && ray.y>0.001)
        lengthInFog=min(lengthInFog,max(0.0,(ae_waterSurface-viewPos.y)/ray.y));
    float ds = lengthInFog / 48.0;
    float illumination = 0.0;
    for (int i = 0; i < 48; ++i)
    {
        float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        float travel = (float(i) + 0.25 + 0.5*jitter) * ds;
        vec4 light = vec4(viewPos + ray * travel, 1.0) * ae_lightViewProjection;
        vec3 uvz = light.xyz / light.w * 0.5 + 0.5;
        if (all(greaterThan(uvz, vec3(0.001))) && all(lessThan(uvz, vec3(0.999))))
        {
            vec2 size=vec2(textureSize(ae_shadowMap,0));
            vec2 pixel=uvz.xy*size-0.5;ivec2 cell=ivec2(floor(pixel));
            vec2 f=fract(pixel);float visible=0.0;
            for(int sx=0;sx<2;sx++)for(int sy=0;sy<2;sy++){
                float depth=texelFetch(ae_shadowMap,clamp(cell+ivec2(sx,sy),ivec2(0),ivec2(size)-1),0).r;
                float w=(sx==0?1.0-f.x:f.x)*(sy==0?1.0-f.y:f.y);
                visible+=smoothstep(-0.0002,0.0002,depth-uvz.z)*w;
            }
            illumination += visible * exp(-travel * mix(0.012,0.06,ae_underwater)) * ds * mix(0.012,0.085,ae_underwater);
        }
    }
    float forwardScatter = pow(max(dot(ray, normalize(ae_sunDirection)), 0.0), 8.0);
    float daylight = smoothstep(0.02, 0.22, ae_sunDirection.y);
    return vec3(0.93, 0.94, 1.0) * illumination *
        (mix(0.054,0.16,ae_underwater) + forwardScatter * 0.46) * ae_fogStrength * daylight * mix(max(ae_morningRays,1.0),0.45,ae_underwater) * mix(1.0,0.75,ae_underwater);
}

void main()
{
    ae_objectMask=vec4(0,0,0,1);
    vec2 baseUV = gl_FragCoord.xy / screenRes.xy;
    vec4 surface = vertexCol * texture(texture0, texCoord);
    vec4 vanilla;
    vec4 enhanced;

    bool underwaterSurface=ae_underwater>0.5 && abs(worldNormal.y)>0.5 && viewPos.y<fragPosition.y;
    if (mode == 0) // Water
    {
        // Smooth 2D water wave perturbation (both X and Y) to prevent 1D horizontal slicing
        vec2 noiseUV1 = fragPosition.xz * 0.25 + vec2(uTime * 1.2, uTime * 0.8) + vec2(fragPosition.y * 0.1);
        vec2 noiseUV2 = fragPosition.xz * 0.12 - vec2(uTime * 0.9, uTime * 1.1) + vec2(fragPosition.y * 0.05);
        float waveX = sin(dot(fragPosition.xz, vec2(1.71, 0.93)) + uTime * 1.8) * 0.6 + sin(dot(fragPosition.xz, vec2(-0.83, 2.17)) - uTime * 1.3) * 0.4;
        float waveY = cos(dot(fragPosition.xz, vec2(1.23, -1.67)) - uTime * 1.5) * 0.6 + cos(dot(fragPosition.xz, vec2(2.03, 0.71)) + uTime * 1.1) * 0.4;
        
        float underwaterPulse=0.82+0.18*sin(ae_cloudTime*0.41+fragPosition.x*0.09+fragPosition.z*0.07);
        vec2 offset = vec2(waveX, waveY) * 0.0012 * ae_waterRefraction*(underwaterSurface?0.10*underwaterPulse:1.0);
        vec2 candidateUV = clamp(baseUV + offset, vec2(0.001), vec2(0.999));
        
        // Smooth depth transition instead of abrupt hard cutoff (prevents sharp sliced lines on underwater terrain)
        float currentDepth = gl_FragCoord.z;
        float sampleDepth = texture(texture5, candidateUV).r;
        mat4 invProjection=inverse(projection);
        float surfaceZ=viewDistanceFromDepth(baseUV,currentDepth,invProjection);
        float sampleZ=viewDistanceFromDepth(candidateUV,sampleDepth,invProjection);
        float smoothWeight = smoothstep(0.02,0.22,sampleZ-surfaceZ);
        vec2 refractedUV = mix(baseUV, candidateUV, smoothWeight);

        vec4 sceneBase = filteredScene(baseUV);
        vec4 sceneRefracted = filteredScene(refractedUV);
        vanilla = mix(sceneBase, surface, 0.5);
        float waterDepth=max(sampleZ-surfaceZ,0.0);
        float waterTint=underwaterSurface?0.20:mix(0.12,0.48,1.0-exp(-waterDepth*0.24));
        vec3 absorption=exp(-min(waterDepth,24.0)*vec3(0.095,0.040,0.021));
        vec3 transmitted=sceneRefracted.rgb*absorption+surface.rgb*(1.0-absorption)*0.65;
        enhanced=vec4(mix(transmitted,surface.rgb,waterTint*0.65),mix(sceneRefracted.a,surface.a,0.5));

        // Smooth wave normal
        vec3 normal = normalize(worldNormal + vec3(waveX * 0.022, 0.0, waveY * 0.022) * ae_waterRefraction);
        if (dot(normal, viewPos - fragPosition) < 0.0)
            normal = -normal;
            
        vec3 incident = normalize(fragPosition - viewPos);
        vec3 reflectionDirection = normalize(reflect(incident, normal));
        vec2 reflectionUV;
        float confidence;
        // Atmospheric fallback, as in Klimatyczne Odbicia; no stretched screen copy.
        float facingSky = max(dot(normal, normalize(viewPos - fragPosition)), 0.0);
        float skyFresnel = 0.02 + 0.98 * pow(1.0 - facingSky, 5.0);
        vec3 reflectedSky = mix(fogColor.rgb, fogMidColor.rgb,
            smoothstep(-0.05, 0.8, reflectionDirection.y));
        enhanced.rgb = mix(enhanced.rgb, reflectedSky,
            clamp((0.05 + skyFresnel * 0.60) * ae_reflections * ae_reflectionStrength, 0.0, 0.65)*(underwaterSurface?0.0:1.0));
        if (!underwaterSurface && traceScreenReflection(fragPosition + normal * 0.035, reflectionDirection, reflectionUV, confidence))
        {
            vec3 reflectedScene = texture(texture3, reflectionUV).rgb;
            float facing = max(dot(normal, normalize(viewPos - fragPosition)), 0.0);
            float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
            float reflectionMix = clamp((0.20 + fresnel * 0.60) * confidence * ae_reflectionStrength * ae_reflections, 0.0, 0.75);
            enhanced.rgb = mix(enhanced.rgb, reflectedScene, reflectionMix);
        }
    }
    else
    {
        vanilla = mix(texture(texture3, baseUV), surface, 0.5);
        enhanced = vanilla;
    }

    float d = length(viewPos - fragPosition);
    float visibility = clamp((fogEnd - d) / max(fogEnd - fogStart, 0.001), 0.0, 1.0);
    visibility = visibility * visibility * (3.0 - 2.0 * visibility);
    vec3 atmosphere = mix(fogColor.rgb, fogMidColor.rgb, visibility);
    vec3 vanillaFogged = mix(atmosphere, vanilla.rgb, visibility);
    vec3 enhancedColor = mode == 0 ? enhanced.rgb : gradeColor(enhanced.rgb);
    vec3 viewRay = normalize(fragPosition - viewPos);
    float horizonHaze = smoothstep(0.55, 0.96, 1.0 - abs(viewRay.y))
        * smoothstep(fogStart * 0.72, fogEnd, d) * ae_fogStrength;
    float enhancedVisibility = distanceTransmittance(d,viewRay);
    vec3 enhancedFogged = mix(atmosphericScattering(viewRay,d), enhancedColor, enhancedVisibility);
    
    outputColor = vec4(mix(vanillaFogged, enhancedFogged, clamp(ae_enabled, 0.0, 1.0)),
        mix(vanilla.a, enhanced.a, ae_enabled));
    outputColor.rgb+=ae_enabled*underwaterParticles(viewRay,d);
    // Rays ending at the underside have no submerged opaque receiver.
    // Resolve their water segment here, after the surface composite.
    if(underwaterSurface && mode==0)
        outputColor.rgb+=ae_enabled*min(volumetricShafts(viewRay,d),vec3(0.12));
}
