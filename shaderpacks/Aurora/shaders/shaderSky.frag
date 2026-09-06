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
uniform vec3 ae_moonDirection;
uniform float ae_moonStrength;
uniform float ae_moonRayStrength;
uniform float ae_warmth;
uniform float ae_underwater;
uniform float ae_biomeWarmth;
uniform float ae_biomeSnow;

uniform sampler2D ae_shadowMap;
uniform float ae_shadowMapEnabled;
// Single scattering integrated along the camera ray, occluded by the shadow map.
uniform mat4 ae_lightViewProjection;
uniform float ae_morningRays;
uniform int ae_raySteps;
vec3 volumetricShafts(vec3 ray, float rayLength)
{
    if (ae_shadowMapEnabled < 0.5 || ae_underwater > 0.5) return vec3(0.0);
    float lengthInFog = min(rayLength, 96.0);
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
            illumination += visible * exp(-travel * 0.012) * ds * 0.012;
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
    return illumination*ae_fogStrength*(sunShaft+moonShaft);
}
uniform float ae_cloudTime;
uniform vec3 ae_cloudTint;
float winterCloudVisibility()
{
    float night=1.0-smoothstep(-0.20,0.18,ae_sunDirection.y);
    return 1.0-ae_biomeSnow*night;
}
float cloudHash(vec2 p) {
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
float cloudNoise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(cloudHash(i),cloudHash(i+vec2(1,0)),f.x),
               mix(cloudHash(i+vec2(0,1)),cloudHash(i+vec2(1,1)),f.x),f.y);
}
float cloudDensityAt(vec3 p){
    if(p.y<256.0 || p.y>=288.0)return 0.0;
    vec2 fp=(floor(p.xz/32.0)+0.5)*32.0;
    float layer=floor(abs((p.y-272.0)/16.0)*2.0)*0.5;
    float shape=cloudNoise(fp*0.010)*0.8+cloudNoise(fp*0.035+17.0)*0.2-0.57-layer*0.10;
    return shape>0.0?mix(0.45,1.0,smoothstep(0.0,0.14,shape)):0.0;
}
vec4 pixelCloudVolume(vec3 ray) {
    if(abs(ray.y)<0.008) return vec4(0);
    float a=(256.0-viewPos.y)/ray.y, b=(288.0-viewPos.y)/ray.y;
    float enter=max(min(a,b),0.0), leave=min(max(a,b),900.0);
    if(leave<=enter) return vec4(0);
    // Traverse actual rectangular cells, not smooth density samples.
    vec3 cellSize=vec3(8.0,4.0,8.0);
    vec3 wind=vec3(ae_cloudTime*2.0,0,ae_cloudTime*0.55);
    vec3 origin=viewPos-wind;
    float t=enter+0.001; vec3 accumulated=vec3(0); float transmittance=1.0;
    vec3 cell=floor((origin+ray*t)/cellSize);
    vec3 stepDir=sign(ray);
    vec3 safeRay=vec3(ray.x==0.0?0.0000001:ray.x,ray.y,ray.z==0.0?0.0000001:ray.z);
    vec3 boundary=(cell+step(vec3(0),ray))*cellSize;
    vec3 nextT=(boundary-origin)/safeRay;
    vec3 deltaT=abs(cellSize/safeRay);
    vec3 faceNormal=vec3(0,-sign(ray.y),0);
    int cloudSteps=clamp(ae_raySteps*4,48,128);
    for(int i=0;i<128;i++){
        if(i>=cloudSteps)break;
        if(t>=leave) break;
        vec3 center=(cell+0.5)*cellSize;
        vec2 footprint=(floor(center.xz/32.0)+0.5)*32.0;
        float broad=cloudNoise(footprint*0.010);
        float detail=cloudNoise(footprint*0.035+17.0);
        float layer=floor(abs((center.y-272.0)/16.0)*2.0)*0.5;
        float shape=broad*0.8+detail*0.2-0.57-layer*0.10;
        // Fine 8x8 edge cells, attached only to a filled adjacent macro-cell.
        float adjacentShape=-1.0;
        vec2 local=mod(center.xz,32.0);
        vec2 edgeOffset=abs(local.x-16.0)>abs(local.y-16.0)
            ?vec2(local.x<16.0?-32.0:32.0,0)
            :vec2(0,local.y<16.0?-32.0:32.0);
        vec2 neighbour=footprint+edgeOffset;
        adjacentShape=cloudNoise(neighbour*0.010)*0.8
            +cloudNoise(neighbour*0.035+17.0)*0.2-0.57-layer*0.10;
        bool fringe=shape<=0.0 && shape>-0.08 && adjacentShape>0.0
            && max(abs(local.x-16.0),abs(local.y-16.0))>=12.0;
        if(center.y>=256.0 && center.y<288.0 && (shape>0.0 || fringe)){
            float daylight=smoothstep(-0.12,0.22,ae_sunDirection.y);
            float faceLight=smoothstep(256.0,288.0,center.y);
            vec3 color=mix(vec3(0.84,0.875,0.925),vec3(0.92,0.945,0.975),faceLight);
            vec3 tint=ae_cloudTint/max(max(ae_cloudTint.r,ae_cloudTint.g),max(ae_cloudTint.b,0.001));
            tint=mix(vec3(1.0),tint,0.20);
            float twilight=exp(-pow(ae_sunDirection.y/0.20,2.0))*daylight;
            float sunFacing=pow(max(dot(ray,normalize(ae_sunDirection)),0.0),3.0);
            vec3 sunlight=mix(vec3(1.0,0.78,0.52),vec3(1.0,0.98,0.92),smoothstep(0.03,0.45,ae_sunDirection.y));
            vec3 ambient=mix(vec3(0.035,0.042,0.065),vec3(0.72,0.765,0.82),daylight);
            float optical=0.0;
            for(int k=0;k<2;k++){
                vec3 probe=center+normalize(ae_sunDirection)*(6.0+float(k)*12.0);
                optical+=cloudDensityAt(probe)*12.0*0.10;
            }
            float sunTransmission=exp(-optical);
            float mu=clamp(dot(ray,normalize(ae_sunDirection)),-1.0,1.0);
            float phase=0.35+0.65*pow(max(mu,0.0),6.0);
            vec3 direct=sunlight*daylight*sunTransmission*(0.20+0.12*faceLight+0.12*phase);
            color*=tint*(ambient+direct);
            // Soft highlight shoulder keeps midday tops below clipping while preserving shape.
            color=color/(vec3(1.0)+max(color-vec3(0.78),vec3(0.0))*0.72);
            color=mix(color,color*vec3(1.07,0.98,0.90),twilight*0.35);
            float segment=max(min(min(nextT.x,nextT.y),min(nextT.z,leave))-t,0.0);
            float edgeVariation=cloudHash(floor(center.xz/8.0));
            float level=fringe?mix(0.22,0.26,edgeVariation)
                :mix(0.45,1.0,smoothstep(0.0,0.14,shape));
            float alpha=1.0-exp(-level*0.20*segment);
            accumulated+=color*alpha*transmittance;
            transmittance*=1.0-alpha;
            if(transmittance<0.015)break;
        }
        if(nextT.x<=nextT.y && nextT.x<=nextT.z){
            t=nextT.x;nextT.x+=deltaT.x;cell.x+=stepDir.x;faceNormal=vec3(-stepDir.x,0,0);
        }else if(nextT.y<=nextT.z){
            t=nextT.y;nextT.y+=deltaT.y;cell.y+=stepDir.y;faceNormal=vec3(0,-stepDir.y,0);
        }else{
            t=nextT.z;nextT.z+=deltaT.z;cell.z+=stepDir.z;faceNormal=vec3(0,0,-stepDir.z);
        }
    }
    float fade=1.0-smoothstep(450.0,850.0,enter);
    float winterFade=winterCloudVisibility();
    return vec4(accumulated*fade*winterFade,
        (1.0-transmittance)*fade*winterFade);
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
    vec3 rayleigh = vec3(0.10, 0.20, 0.36) * rayleighPhase * (0.08 + horizon * 0.22);
    vec3 mie = vec3(1.0, 0.38, 0.08) * miePhase * 0.042 * (0.35 + horizon * 0.65);
    float sunVisibility=smoothstep(0.03,0.20,ae_sunDirection.y);
    float waterVisibility=mix(1.0,0.20,ae_underwater);
    vec3 scattered = vertexCol.rgb + (rayleigh + mie*0.25) * ae_fogStrength*sunVisibility*waterVisibility
        + volumetricShafts(viewDirection,96.0)*waterVisibility;
    scattered += vec3(0.32, 0.09, 0.015) * horizon * (1.0 - clamp(ae_sunDirection.y, 0.0, 1.0)) * 0.24;
    float desertDay=ae_biomeWarmth*sunVisibility;
    scattered=mix(scattered,scattered*vec3(1.045,1.0,0.76),desertDay*0.78);
    scattered *= vec3(1.0 + ae_warmth * 0.03, 1.0, 1.0 - ae_warmth * 0.025);
    scattered = scattered / (1.0 + max(scattered - vec3(0.86), vec3(0.0)) * 0.8);
    float moonAlignment=clamp(dot(viewDirection,ae_moonDirection),-1.0,1.0);
    float moonHalo=exp(-(1.0-moonAlignment)/0.0035)*0.025;
    scattered+=vec3(0.68,0.79,1.0)*moonHalo*ae_moonStrength;
    vec4 clouds = pixelCloudVolume(viewDirection);
    scattered = scattered * (1.0-clouds.a) + clouds.rgb;
    outputColor = vec4(mix(vertexCol.rgb, scattered, clamp(ae_enabled, 0.0, 1.0)), vertexCol.a);

    
}
