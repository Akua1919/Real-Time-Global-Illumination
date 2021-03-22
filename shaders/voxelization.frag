#version 430
#extension GL_ARB_shader_image_load_store : enable

in fData {
	flat int axis;
    vec2 UV;
	vec3 pos;
	vec3 normal;
	vec4 position_depth;
	vec4 AABB;
} frag;

layout(RGBA8) uniform image3D VoxelTexture;
layout(RGBA8) uniform image3D VoxelNormal;
uniform sampler2DShadow ShadowMap;
uniform sampler2D DiffuseTexture;
uniform int VoxelTexDim;

const float lightBleedingReduction = 0.0f;
const vec2 exponents = vec2(40.0f, 5.0f);

/*
float linstep(float low, float high, float value)
{
    return clamp((value - low) / (high - low), 0.0f, 1.0f);
}  

float ReduceLightBleeding(float pMax, float Amount)  
{  
    return linstep(Amount, 1, pMax);  
} 

vec2 WarpDepth(float depth)
{
    float pos = exp(exponents.x * depth);
    float neg = -exp(-exponents.y * depth);
    return vec2(pos, neg);
}

float Chebyshev(vec2 moments, float mean, float minVariance)
{
    if(mean <= moments.x)
    {
        return 1.0f;
    }
    else
    {
        float variance = moments.y - (moments.x * moments.x);
        variance = max(variance, minVariance);
        float d = mean - moments.x;
        float lit = variance / (variance + (d * d));
        return ReduceLightBleeding(lit, lightBleedingReduction);
    }
}

float Visibility(vec3 position)
{
    vec4 moments = texture(shadowMap, position.xy);
    // move to avoid acne
    vec2 wDepth = WarpDepth(position.z - 0.0001f);
    // derivative of warping at depth
    vec2 depthScale = 0.0001f * exponents * wDepth;
    vec2 minVariance = depthScale * depthScale;
    // evsm mode 4 compares negative and positive
    float positive = Chebyshev(moments.xz, wDepth.x, minVariance.x);
    float negative = Chebyshev(moments.yw, wDepth.y, minVariance.y);
    // shadowing value
    return min(positive, negative);
}
*/

void RGBA8Avg(layout(RGBA8) image3D grid ,ivec3 coords, vec4 value)
{
    vec4 newVal = value;
    vec4 prevStoredVal = vec4(0.0f, 0.0f, 0.0f, 0.0f);
    vec4 curStoredVal;
    uint iter = 0;

    while((curStoredVal = imageLoad(grid, coords)) != prevStoredVal && iter < 255)
    {
        prevStoredVal = curStoredVal;
        curStoredVal.rgb = (curStoredVal.rgb * curStoredVal.a); 
        newVal = curStoredVal + value;    
        newVal.rgb /= newVal.a;       
        ++iter;
    }

	imageStore(grid, coords, newVal);
}

void main() {
	if(frag.pos.x < frag.AABB.x || frag.pos.y < frag.AABB.y || frag.pos.x > frag.AABB.z || frag.pos.y > frag.AABB.w )
	{
		discard;
	}

	float visibility = texture(ShadowMap, vec3(frag.position_depth.xy, (frag.position_depth.z - 0.001)/frag.position_depth.w));
	ivec3 camPos = ivec3(gl_FragCoord.x, gl_FragCoord.y, VoxelTexDim * gl_FragCoord.z);
	ivec3 texPos;

	if(frag.axis == 1) 
	{	// project onto YZ-plane
	    texPos.x = VoxelTexDim - camPos.z;
		texPos.z = camPos.x;
		texPos.y = camPos.y;
	}
	else if(frag.axis == 2) 
	{	// project onto XZ-plane
	    texPos.z = camPos.y;
		texPos.y = VoxelTexDim - camPos.z;
		texPos.x = camPos.x;
	} else 
	{	// project onto XY-plane
	    texPos = camPos;
	}

	texPos.z = VoxelTexDim - texPos.z - 1;

    vec4 albedo = texture(DiffuseTexture, frag.UV);
    vec4 normal = vec4(normalize(frag.normal) * 0.5f + vec3(0.5f), 1.0f);

	albedo.rgb *= albedo.a;
	albedo *= visibility;
	albedo.a = 1.0f;
	RGBA8Avg(VoxelTexture, texPos, albedo);

	normal.xyz *= normal.x;
	normal.x = 1.0f;
	RGBA8Avg(VoxelNormal, texPos, normal);

    //imageStore(VoxelTexture, texPos, vec4(albedo.xyz, 1.0));
}
