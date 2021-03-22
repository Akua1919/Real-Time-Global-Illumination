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

void RGBA8Avg(layout(RGBA8) image3D img ,ivec3 texCoord, vec4 value)
{
    vec4 newVal = value;
    vec4 lastVal = vec4(0.0f, 0.0f, 0.0f, 0.0f);
    vec4 curVal;
    uint iter = 0;

    while((curVal = imageLoad(img, texCoord)) != lastVal && iter < 255)
    {
        lastVal = curVal;
        curVal.rgb = (curVal.rgb * curVal.a); 
        newVal = curVal + value;    
        newVal.rgb /= newVal.a;       
        ++iter;
    }
	imageStore(img, texCoord, newVal);
}

void main() {
	//float visibility = texture(ShadowMap, vec3(frag.position_depth.xy, (frag.position_depth.z - 0.001)/frag.position_depth.w));
	ivec3 camPos = ivec3(gl_FragCoord.x, gl_FragCoord.y, VoxelTexDim * gl_FragCoord.z);
	ivec3 texPos;

	if(frag.axis == 1) 
	{	// project onto YZ-plane
		if(frag.pos.y < frag.AABB.x || frag.pos.z < frag.AABB.y || frag.pos.y > frag.AABB.z || frag.pos.z > frag.AABB.w )
		{
			discard;
		}
	    texPos.x = VoxelTexDim - camPos.z;
		texPos.z = camPos.x;
		texPos.y = camPos.y;
	}
	else if(frag.axis == 2) 
	{	// project onto XZ-plane
		if(frag.pos.x < frag.AABB.x || frag.pos.z < frag.AABB.y || frag.pos.x > frag.AABB.z || frag.pos.z > frag.AABB.w )
		{
			discard;
		}
	    texPos.z = camPos.y;
		texPos.y = VoxelTexDim - camPos.z;
		texPos.x = camPos.x;
	} else 
	{	// project onto XY-plane
		if(frag.pos.x < frag.AABB.x || frag.pos.y < frag.AABB.y || frag.pos.x > frag.AABB.z || frag.pos.y > frag.AABB.w )
		{
			discard;
		}
	    texPos = camPos;
	}

	texPos.z = VoxelTexDim - texPos.z - 1;

    vec4 albedo = texture(DiffuseTexture, frag.UV);
    vec4 normal = vec4(normalize(frag.normal) * 0.5f + vec3(0.5f), 1.0f);

	albedo.rgb *= albedo.a;
	//albedo *= visibility;
	albedo.a = 1.0f;
	RGBA8Avg(VoxelTexture, texPos, albedo);

	normal.xyz *= normal.x;
	normal.x = 1.0f;
	RGBA8Avg(VoxelNormal, texPos, normal);

    //imageStore(VoxelTexture, texPos, vec4(albedo.xyz, 1.0));
}
