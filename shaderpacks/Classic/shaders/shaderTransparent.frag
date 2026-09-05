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
uniform float uTime;
uniform int mode;
uniform mat4 view;
uniform mat4 projection;
uniform float ae_enabled;
uniform float ae_waterRefraction;
uniform float ae_saturation;
uniform float ae_contrast;
uniform float ae_fogStrength;
uniform float ae_reflections;
uniform float ae_reflectionStrength;
uniform int ae_raySteps;

vec3 gradeColor(vec3 color)
{
    float skyLuma = dot(fogMidColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float exposure = mix(1.08, 0.92, smoothstep(0.12, 0.82, skyLuma));
    color *= exposure;
    color = color * (2.51 * color + 0.03) / max(color * (2.43 * color + 0.59) + 0.14, vec3(0.001));
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, ae_saturation);
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

void main()
{
    ae_objectMask=vec4(0,0,0,1);
    vec2 baseUV = gl_FragCoord.xy / screenRes.xy;
    vec4 surface = vertexCol * texture(texture0, texCoord);
    vec4 vanilla;
    vec4 enhanced;

    if (mode == 0) // Water
    {
        // Smooth 2D water wave perturbation (both X and Y) to prevent 1D horizontal slicing
        vec2 noiseUV1 = fragPosition.xz * 0.25 + vec2(uTime * 1.2, uTime * 0.8) + vec2(fragPosition.y * 0.1);
        vec2 noiseUV2 = fragPosition.xz * 0.12 - vec2(uTime * 0.9, uTime * 1.1) + vec2(fragPosition.y * 0.05);
        float waveX = sin(dot(fragPosition.xz, vec2(1.71, 0.93)) + uTime * 1.8) * 0.6 + sin(dot(fragPosition.xz, vec2(-0.83, 2.17)) - uTime * 1.3) * 0.4;
        float waveY = cos(dot(fragPosition.xz, vec2(1.23, -1.67)) - uTime * 1.5) * 0.6 + cos(dot(fragPosition.xz, vec2(2.03, 0.71)) + uTime * 1.1) * 0.4;
        
        vec2 offset = vec2(waveX, waveY) * 0.0012 * ae_waterRefraction;
        vec2 candidateUV = clamp(baseUV + offset, vec2(0.001), vec2(0.999));
        
        // Smooth depth transition instead of abrupt hard cutoff (prevents sharp sliced lines on underwater terrain)
        float currentDepth = gl_FragCoord.z;
        float sampleDepth = texture(texture5, candidateUV).r;
        float depthDiff = sampleDepth - currentDepth;
        float smoothWeight = smoothstep(-0.0001, 0.0005, depthDiff);
        vec2 refractedUV = mix(baseUV, candidateUV, smoothWeight);

        vec4 sceneBase = texture(texture3, baseUV);
        vec4 sceneRefracted = texture(texture3, refractedUV);
        vanilla = mix(sceneBase, surface, 0.5);
        enhanced = mix(sceneRefracted, surface, 0.5);

        // Smooth wave normal
        vec3 normal = normalize(worldNormal + vec3(waveX * 0.012, 0.0, waveY * 0.012) * ae_waterRefraction);
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
            clamp((0.05 + skyFresnel * 0.60) * ae_reflections * ae_reflectionStrength, 0.0, 0.65));
        if (traceScreenReflection(fragPosition + normal * 0.035, reflectionDirection, reflectionUV, confidence))
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
    float enhancedVisibility = mix(1.0, visibility, ae_fogStrength) * (1.0 - horizonHaze * 0.14);
    vec3 enhancedFogged = mix(atmosphere, enhancedColor, enhancedVisibility);
    
    outputColor = vec4(mix(vanillaFogged, enhancedFogged, clamp(ae_enabled, 0.0, 1.0) * 0.38),
        mix(vanilla.a, enhanced.a, ae_enabled));
}
