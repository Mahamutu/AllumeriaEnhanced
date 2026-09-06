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
        // Preserve the game's authored aurora silhouette. Changing the UV or
        // threshold per layer turns its forty translucent slices into long
        // straight rails when seen at a shallow angle.
        float source=texture(texture0,texCoord).r;
        vec2 pixelCell=floor(texCoord*64.0);
        float pixelPulse=0.94+0.06*sin(pixelCell.x*0.39+pixelCell.y*0.61
            +ae_cloudTime*0.55+density*19.0);
        float alpha=visibility*source/max(density*2.0,0.001)*intensity
            *pixelPulse;

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
        vec3 colour=mix(cloudColor.rgb,vec3(0.39,0.91,0.78),0.06);
        outputColor=vec4(colour,clamp(alpha,0.0,0.82));
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
