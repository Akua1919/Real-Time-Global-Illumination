#version 430 

in vec2 UV;
in vec3 Pos;
in vec3 Normal;
in vec4 Position_depth; 
in mat3 TanToWorld;

out vec4 color;

uniform float VoxelGridWorldSize;
uniform int VoxelDimensions;
uniform vec2 HeightTextureSize;
uniform vec3 CamPos;
uniform vec3 LightDir;
uniform float Shininess;
uniform float Opacity;
uniform sampler2D DiffuseTexture;
uniform sampler2D SpecularTexture;
uniform sampler2D HeightTexture;
uniform sampler2DShadow ShadowMap;
uniform sampler3D VoxelTexture;
uniform sampler3D VoxelNormal;
uniform float ShowDiffuse;
uniform float ShowIndirectDiffuse;
uniform float ShowIndirectSpecular;
uniform float ShowAmbientOcculision;
uniform float ShowSoftShadow;

const float TAN30 = 0.57735f;
const vec3 coneDirections[6] = vec3[] 
(
	vec3(0.0f, 1.0f, 0.0f),
    vec3(0.0f, 0.5f, 0.866025f),
    vec3(0.823639f, 0.5f, 0.267617f),
    vec3(0.509037f, 0.5f, -0.7006629f),
    vec3(-0.50937f, 0.5f, -0.7006629f),
    vec3(-0.823639f, 0.5f, 0.267617f)
);

const float coneWeights[6] = float[] (0.25, 0.15, 0.15, 0.15, 0.15, 0.15);

float softShadow()
{
	float voxelSize = VoxelGridWorldSize / VoxelDimensions;
    float dist = 2 * voxelSize; 
    vec3 samplePos = Pos + LightDir * dist;

    float k = 0.4f;
    float traceSample = 0.0f;
	float visibility = 0.0;
    while (dist < 200 && visibility <= 1.f) 
    {
		vec3 texCoord = (samplePos / VoxelGridWorldSize) + 0.5;
		if (texCoord.x < 0.0f || texCoord.y < 0.0f || texCoord.z < 0.0f || texCoord.x > 1.0f || texCoord.y > 1.0f || texCoord.z > 1.0f) 
        { 
            break; 
        }
		traceSample = ceil(texture(VoxelTexture, texCoord).a) * k;
        if(traceSample > 1.0f - 1e-30f) 
		{ 
			return 0.0f; 
		}
		visibility += (1.0f - visibility) * traceSample / dist;
        dist += voxelSize;
        samplePos = LightDir * dist + Pos;
    }
    return 1.0f - visibility;
}

vec4 lightTrace(vec3 direction, float visibility, float tang)
{
	vec4 color = vec4(0.0f);

	float voxelSize = VoxelGridWorldSize / VoxelDimensions;
    float dist = voxelSize;
    vec3 startPos = Pos + Normal * voxelSize;

    while (dist < 200 && color.a < 0.95)
    {
    	vec3 textureUV = (startPos + dist * direction) / VoxelGridWorldSize + 0.5;
    	float d = max(voxelSize, 2.0 * tang * dist);
    	float mipLevel = log2(d / voxelSize);
    	vec4 voxelColor = textureLod(VoxelTexture, textureUV, mipLevel);
		if (ShowSoftShadow > 0.5f)
		{
			voxelColor.rgb *= visibility;
		}
		else
		{
			voxelColor.rgb *= visibility * 0.7f + 0.3f;
		}
		color.rgb += (1.0f - color.a) * voxelColor.rgb;
		color.a += (1.0f - color.a) * voxelColor.a;
		dist += d * 0.5;
    }
    return color;
}

float occlusionTrace(vec3 direction, float tang)
{
	float occlusion = 0.0f;
	float alpha = 0.f;

    float voxelSize = VoxelGridWorldSize / VoxelDimensions;
    float dist = voxelSize;
    vec3 startPos = Pos + Normal * voxelSize;

    while (dist < 30 && alpha < 0.95)
    {
    	vec3 textureUV = (startPos + dist * direction) / VoxelGridWorldSize + 0.5;
    	float d = max(voxelSize, 2.0 * tang * dist);
    	float mipLevel = log2(d / voxelSize);
    	vec4 voxelColor = textureLod(VoxelTexture, textureUV, mipLevel);
		occlusion += ((1.0f - alpha) * voxelColor.a) / (1.0 + 0.03 * d);
		alpha += (1.0f - alpha) * voxelColor.a;
		dist += d * 0.5;
    }
    return occlusion;
}

vec3 diffLight(float visibility)
{
	if (ShowIndirectDiffuse > 0.5f)
	{
		vec4 color = coneWeights[0] * lightTrace(TanToWorld * coneDirections[0], visibility, TAN30);
		float occlusion = coneWeights[0] * occlusionTrace(TanToWorld * coneDirections[0], TAN30);
		for (int i = 1; i < 6; i++)
		{
			color += coneWeights[i] * lightTrace(TanToWorld * coneDirections[i], visibility, TAN30);
			occlusion += coneWeights[i] * occlusionTrace(TanToWorld * coneDirections[i], TAN30);
		}
		occlusion = 1.0f - occlusion;
		if (ShowAmbientOcculision > 0.5f)
		{
			return color.rgb * occlusion * 2.0f * texture(DiffuseTexture, UV).rgb;
		}
		return color.rgb * 2.0f * texture(DiffuseTexture, UV).rgb;
	}
	return vec3(0.0f);
}

vec3 specLight(float visibility)
{
	if (ShowIndirectSpecular > 0.5f)
	{
		vec4 color = texture(SpecularTexture, UV);
		if (length(color.gb) > 0.0f)
		{
			color = color;
		}
		else
		{
			color = color.rrra;
		}
		vec3 reflectDir = normalize(normalize(Pos - CamPos) - 2.0 * dot(normalize(Pos - CamPos), Normal) * Normal);
		vec4 specular = lightTrace(reflectDir, visibility, 0.07f);
		float occlusion = occlusionTrace(reflectDir, 0.07f) * 0.8f;
		occlusion = 1.0f - occlusion;
		if (ShowAmbientOcculision > 0.5f)
		{
			return color.rgb * specular.rgb * occlusion * 2.0f;
		}
		return color.rgb * specular.rgb * 2.0f;
	}
	return vec3(0.0f);
}

vec3 getDirLight(float visibility)
{
	if (ShowDiffuse > 0.5f)
	{
		return vec3(visibility * max(0.0f, dot(Normal, LightDir))) * texture(DiffuseTexture, UV).rgb;
	}
	return vec3(0.0f);
}

vec3 getIndirLight(float visibility)
{
	return diffLight(visibility) + specLight(visibility);
}

void main() 
{
	vec4 albedo = texture(DiffuseTexture, UV);

	if (albedo.a >= 0.5)
	{
		vec3 shadowUV = vec3(Position_depth.x, Position_depth.y, (Position_depth.z - 1e-3) / Position_depth.w);
		float visibility = texture(ShadowMap, shadowUV);
		if (ShowSoftShadow > 0.5f)
		{
			visibility = 0.7 * visibility + 0.3 * softShadow();
		}

		vec3 dirLight = getDirLight(visibility);
		vec3 indirLight = getIndirLight(visibility);
		color = vec4(dirLight + indirLight, albedo.a);
	}
}