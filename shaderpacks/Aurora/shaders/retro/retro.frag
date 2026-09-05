#version 330 core
layout(location=0) out vec4 outputColor;
in vec2 texCoord;
in vec4 fragColor;
uniform sampler2D texture0, ae_depth, ae_waterColor, ae_handMask;
uniform mat4 ae_inverseProjection;
uniform vec2 screenRes;
uniform float ae_postEnabled, ae_ao, ae_sharpen, ae_dof, ae_maskValid, ae_middayBloom;
// World-only post pass. Spatial AO, contrast-adaptive sharpening and optional far DoF.
// Deliberately no temporal jitter/history: this is not TAA or ray tracing.
vec3 positionAt(vec2 uv) {
    float d=texture(ae_depth,uv).r;
    vec4 p=vec4(uv*2.0-1.0,d*2.0-1.0,1.0)*ae_inverseProjection;
    return p.xyz/p.w;
}
bool protectedAt(vec2 uv) {
    return texture(ae_waterColor,uv).a>0.001 ||
           (ae_maskValid>0.5 && texture(ae_handMask,uv).r>0.5);
}
float occlusion(vec2 uv, vec3 p) {
    vec2 px=1.0/screenRes;
    vec3 l=p-positionAt(uv-vec2(px.x,0)), r=positionAt(uv+vec2(px.x,0))-p;
    vec3 b=p-positionAt(uv-vec2(0,px.y)), t=positionAt(uv+vec2(0,px.y))-p;
    vec3 n=cross(length(l)<length(r)?l:r,length(b)<length(t)?b:t);
    if(length(n)<0.000001)return 1.0;
    n=normalize(n);
    if(dot(n,-p)<0.0)n=-n;
    float radius=clamp(screenRes.y*0.65/max(-p.z,1.0),2.0,36.0);
    float total=0.0, weight=0.0;
    for(int i=0;i<8;i++) {
        float a=float(i)*2.39996323;
        vec2 q=uv+vec2(cos(a),sin(a))*px*radius*sqrt((float(i)+0.5)/8.0);
        if(any(lessThan(q,px))||any(greaterThan(q,vec2(1)-px))||protectedAt(q))continue;
        if(texture(ae_depth,q).r>=0.99999)continue;
        vec3 v=positionAt(q)-p;
        float d=length(v);
        float w=1.0-smoothstep(0.25,1.3,d);
        total+=max(dot(n,v/max(d,0.0001))-0.10,0.0)*w;
        weight+=1.0;
    }
    return 1.0-ae_ao*clamp(total/max(weight,1.0)*2.2,0.0,0.6);
}
void main() {
    vec4 src=texture(texture0,texCoord)*fragColor;
    if(ae_postEnabled<0.5){outputColor=src;return;}
    vec2 px=1.0/screenRes;
    float depth=texture(ae_depth,texCoord).r;
    bool protect=protectedAt(texCoord);
    vec3 c=src.rgb;
    if(!protect && depth<0.99999) {
        vec3 p=positionAt(texCoord);
        float viewDistance=max(-p.z,0.0);
        // Depth precision becomes too coarse at range; fade before it turns foliage/LOD
        // discontinuities into contour bands.
        float aoDistanceFade=1.0-smoothstep(8.0,24.0,viewDistance);
        float centerDepth=texture(ae_depth,texCoord).r;
        float depthSlope=max(abs(dFdx(centerDepth)),abs(dFdy(centerDepth)));
        float discontinuityFade=1.0-smoothstep(0.00035,0.0025,depthSlope);
        float aoFactor=ae_ao>0.0
            ?mix(1.0,occlusion(texCoord,p),aoDistanceFade*discontinuityFade)
            :1.0;
        c*=aoFactor;
        // Far-only, depth-aware gather; foreground and held items stay sharp.
        if(ae_dof>0.0) {
            float focus=clamp(-positionAt(vec2(0.5)).z,24.0,140.0);
            float blur=smoothstep(focus+32.0,focus+150.0,-p.z)*1.65*ae_dof;
            vec3 sum=c*1.6;float weights=1.6;
            for(int i=0;i<12;i++){
                float fi=float(i)+0.5;
                float a=fi*2.39996323;
                float radius=sqrt(fi/12.0)*blur;
                vec2 q=clamp(texCoord+vec2(cos(a),sin(a))*px*radius,px,vec2(1)-px);
                float qz=-positionAt(q).z;
                float w=(1.0-smoothstep(4.0,18.0,abs(qz+p.z)))*(protectedAt(q)?0.0:1.0);
                sum+=texture(texture0,q).rgb*aoFactor*w;
                weights+=w;
            }
            c=sum/weights;
        }
    }
    // Bounded spatial sharpening, not AMD's CAS implementation.
    if(ae_sharpen>0.001 && !protect) {
        vec3 n=texture(texture0,texCoord+vec2(0,px.y)).rgb;
        vec3 s=texture(texture0,texCoord-vec2(0,px.y)).rgb;
        vec3 e=texture(texture0,texCoord+vec2(px.x,0)).rgb;
        vec3 w=texture(texture0,texCoord-vec2(px.x,0)).rgb;
        vec3 lo=min(src.rgb,min(min(n,s),min(e,w)));
        vec3 hi=max(src.rgb,max(max(n,s),max(e,w)));
        float detail=1.0-clamp(length(hi-lo)*1.8,0.0,1.0);
        vec3 sharpenDelta=(src.rgb-(n+s+e+w)*0.25)*ae_sharpen*detail;
        float postDistance=depth<0.99999?max(-positionAt(texCoord).z,0.0):10000.0;
        float sharpenDistanceFade=1.0-smoothstep(8.0,24.0,postDistance);
        c+=clamp(sharpenDelta,vec3(-0.018),vec3(0.018))*sharpenDistanceFade;
    }
    // Very small high-threshold glow at noon. It keeps texture detail and does
    // not brighten dawn, night, underwater scenes or held items.
    if(ae_middayBloom>0.001 && !protect) {
        vec3 bloom=vec3(0.0);
        float bloomWeight=0.0;
        for(int i=0;i<4;i++) {
            float a=float(i)*1.57079633+0.78539816;
            vec2 q=clamp(texCoord+vec2(cos(a),sin(a))*px*3.25,px,vec2(1)-px);
            vec3 sampleColor=texture(texture0,q).rgb;
            float bright=smoothstep(0.72,0.96,max(sampleColor.r,max(sampleColor.g,sampleColor.b)));
            bloom+=sampleColor*bright;
            bloomWeight+=bright;
        }
        c+=bloom/max(bloomWeight,1.0)*ae_middayBloom*min(bloomWeight/2.0,1.0);
    }
    outputColor=vec4(clamp(c,0.0,1.0),src.a);
}
