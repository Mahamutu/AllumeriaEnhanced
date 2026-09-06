#version 330

layout(location=0) out vec4 outputColor;
layout(location=1) out vec4 ae_objectMask;
in vec2 texCoord;
in vec4 vertexCol;
in vec3 fragPosition;

uniform sampler2D texture0;
uniform float fogStart;
uniform float fogEnd;
uniform vec4 cloudColor;
uniform vec3 viewPos;
uniform float density;
uniform float intensity;
uniform float ae_enabled;
uniform float ae_cloudSoftness;
uniform vec3 ae_sunDirection;
uniform float ae_cloudTime;
uniform float ae_biomeSnow;

float winterCloudVisibility()
{
    float night=1.0-smoothstep(-0.20,0.18,ae_sunDirection.y);
    return 1.0-ae_biomeSnow*night;
}

float auroraCloudHash(vec2 p) {
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
float auroraCloudNoise(vec2 p) {
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(auroraCloudHash(i),auroraCloudHash(i+vec2(1,0)),f.x),
               mix(auroraCloudHash(i+vec2(0,1)),auroraCloudHash(i+vec2(1,1)),f.x),f.y);
}

void main()
{
    ae_objectMask=vec4(0,0,0,1);
    bool auroraPass=intensity<0.5;
    // Aurora renders ordinary volumetric pixel clouds in the sky pass, but
    // the game's aurora uses this same shader and must remain visible.
    if (ae_enabled > 0.5 && !auroraPass) discard;

    float d=length(viewPos-fragPosition);
    float visibility=clamp((fogEnd-d)/max(fogEnd-fogStart,0.001),0.0,1.0);
    visibility=visibility*visibility*(3.0-2.0*visibility);

    if(auroraPass)
    {
        float layer=(density-0.05)/0.007;
        float motion=ae_cloudTime*0.075;
        vec2 pixelUV=(floor(texCoord*64.0)+0.5)/64.0;
        vec2 uvA=pixelUV+vec2(sin(pixelUV.y*10.0+motion+layer*0.13)*0.012,0.0);
        vec2 uvB=pixelUV+vec2(sin(pixelUV.y*8.0-motion*0.71+layer*0.19)*-0.010,0.010);
        float strandA=texture(texture0,clamp(uvA,vec2(0.004),vec2(0.996))).r;
        float strandB=texture(texture0,clamp(uvB,vec2(0.004),vec2(0.996))).r;
        float weave=0.86+0.14*sin(floor(pixelUV.x*32.0)*0.47
            +floor(pixelUV.y*48.0)*1.03+motion*1.7+layer*0.22);
        // Each of the game's forty layers draws only a narrow contour from
        // the source texture. This produces separate woven ribbons instead
        // of stacking the layers into one huge cyan sheet.
        float bandA=1.0-smoothstep(0.010,0.030,abs(strandA-density));
        float bandB=1.0-smoothstep(0.012,0.034,abs(strandB-density));
        float ribbon=max(bandA*weave,bandB*0.48);
        float layerStrength=smoothstep(0.0,0.045,intensity)
            *(1.0-0.28*smoothstep(0.20,0.28,intensity));
        float alpha=visibility*ribbon*layerStrength*0.43;

        // Approximate the custom cloud layer along this view ray so gaps show
        // the aurora while filled clouds correctly pass in front of it.
        vec3 ray=normalize(fragPosition-viewPos);
        float cloudTransmission=1.0;
        if(ray.y>0.01 && viewPos.y<288.0)
        {
            float t=(272.0-viewPos.y)/ray.y;
            if(t>0.0)
            {
                vec2 hit=viewPos.xz+ray.xz*t-vec2(ae_cloudTime*2.0,ae_cloudTime*0.55);
                vec2 footprint=(floor(hit/32.0)+0.5)*32.0;
                float shape=auroraCloudNoise(footprint*0.010)*0.8
                    +auroraCloudNoise(footprint*0.035+17.0)*0.2-0.57;
                float cloudCover=smoothstep(-0.035,0.075,shape)
                    *winterCloudVisibility();
                cloudTransmission=mix(1.0,0.38,cloudCover);
            }
        }
        alpha*=cloudTransmission;
        if(alpha<0.001)discard;
        vec3 colour=mix(cloudColor.rgb,vec3(0.39,0.91,0.78),0.12);
        outputColor=vec4(colour,clamp(alpha,0.0,0.68));
        return;
    }

    float cloud = texture(texture0, texCoord).r;
    float hardMask = cloud >= density ? 1.0 : 0.0;
    float edgeWidth = max(mix(0.012, 0.045, ae_cloudSoftness), fwidth(cloud) * 1.25);
    float softMask = smoothstep(density - edgeWidth, density + edgeWidth, cloud);
    float core = smoothstep(density + edgeWidth * 0.35, density + edgeWidth * 2.4, cloud);
    float mask = mix(hardMask, softMask, clamp(ae_enabled, 0.0, 1.0));
    if (mask < 0.01)
        discard;

    float vanillaAlpha = visibility * cloud / max(density * 2.0, 0.001) * intensity;
    float textureDensity = clamp(cloud / max(density * 1.55, 0.001), 0.0, 1.0);
    vec2 gradient = vec2(dFdx(cloud), dFdy(cloud));
    float silverLining = (1.0 - core) * smoothstep(0.002, 0.025, length(gradient));
    float sunHeight = clamp(ae_sunDirection.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 underside = cloudColor.rgb * mix(0.68, 0.84, sunHeight);
    vec3 enhancedColor = mix(cloudColor.rgb * 0.84, cloudColor.rgb * 0.96, textureDensity);
    enhancedColor *= vec3(1.08, 0.98, 0.84);
    enhancedColor += vec3(1.0, 0.72, 0.42) * silverLining * (0.035 + 0.055 * sunHeight);
    float enhancedAlpha = vanillaAlpha * softMask * 0.94;
    vec4 enhanced = vec4(enhancedColor, clamp(enhancedAlpha, 0.0, 0.92));
    outputColor = mix(vec4(cloudColor.rgb, clamp(vanillaAlpha, 0.0, 1.0)), enhanced, ae_enabled);
}
