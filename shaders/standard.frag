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

const float MAX_DIST = 100.0;
const float ALPHA_THRESH = 0.95;
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

// 6 60 degree cone
const int NUM_CONES = 6;
const float PI = 3.14159265f;
vec3 coneDirections[6] = vec3[]
(                             
	vec3(0.0f, 1.0f, 0.0f),
    vec3(0.0f, 0.5f, 0.866025f),
    vec3(0.823639f, 0.5f, 0.267617f),
    vec3(0.509037f, 0.5f, -0.7006629f),
    vec3(-0.50937f, 0.5f, -0.7006629f),
    vec3(-0.823639f, 0.5f, 0.267617f)
                            );
float coneWeights[6] = float[]
(
	0.25, 0.15, 0.15, 0.15, 0.15, 0.15
);

float TraceShadow(vec3 direction)
{

    float visibility = 0.0;

    float voxelWorldSize = VoxelGridWorldSize / VoxelDimensions;
    float dist = voxelWorldSize; // Start one voxel away to avoid self occlusion
    vec3 startPos = Pos + Normal * voxelWorldSize;

    float k = 0.3f;
    float traceSample = 0.0f;
    while (dist < 200 && visibility < ALPHA_THRESH) 
    {
		float diameter = max(voxelWorldSize, 2.0 * 0.3 * dist);
        float lodLevel = log2(diameter / voxelWorldSize);
		if (textureLod(VoxelTexture, (startPos + dist * direction)/VoxelGridWorldSize + 0.5, lodLevel).a == 0.0f)
		{
			traceSample = 0;
		}
		else
		{
			traceSample = k;
		}
        visibility += (1.0f - visibility) * traceSample / dist;
        //dist += voxelWorldSize;
		dist += diameter * voxelWorldSize; // smoother
    }
    return 1.0f - visibility;
}

vec4 sampleVoxels(sampler3D Texture, vec3 worldPosition, float lod) {
    vec3 TextureUV = worldPosition / VoxelGridWorldSize;
    TextureUV = TextureUV + 0.5;
	vec4 value = textureLod(Texture, TextureUV, lod);
    //value.xyz *= TraceShadow(LightDir);
    return value;
}

// Third argument to say how long between steps?
vec4 coneTrace(vec3 direction, float tanHalfAngle, out float occlusion) {
    
    // lod level 0 mipmap is full size, level 1 is half that size and so on
    float lod = 0.0;
    vec3 color = vec3(0);
    float alpha = 0.0;
    occlusion = 0.0;

    float voxelWorldSize = VoxelGridWorldSize / VoxelDimensions;
    float dist = voxelWorldSize; // Start one voxel away to avoid self occlusion
    vec3 startPos = Pos + Normal * voxelWorldSize; // Plus move away slightly in the normal direction to avoid
                                                                    // self occlusion in flat surfaces

    while(dist < MAX_DIST && alpha < ALPHA_THRESH) {
        // smallest sample diameter possible is the voxel size
        float diameter = max(voxelWorldSize, 2.0 * tanHalfAngle * dist);
        float lodLevel = log2(diameter / voxelWorldSize);
        vec4 voxelColor = sampleVoxels(VoxelTexture, startPos + dist * direction, lodLevel);
		//voxelColor.xyz *= visibility;

        // front-to-back compositing
        float a = (1.0 - alpha);
        color += a * voxelColor.rgb;
        alpha += a * voxelColor.a;
        //occlusion += a * voxelColor.a;
        occlusion += (a * voxelColor.a) / (1.0 + 0.03 * diameter);
        dist += diameter * 0.5; // smoother
        //dist += diameter; // faster but misses more voxels
    }

    return vec4(color, alpha);
}

vec4 indirectLight(out float occlusion_out) {
    vec4 color = vec4(0);
    occlusion_out = 0.0;

    for(int i = 0; i < NUM_CONES; i++) {
        float occlusion = 0.0;
        // 60 degree cones -> tan(30) = 0.577
        // 90 degree cones -> tan(45) = 1.0
        color += coneWeights[i] * coneTrace(TanToWorld * coneDirections[i], 0.577, occlusion);
        occlusion_out += coneWeights[i] * occlusion;
    }

    occlusion_out = 1.0 - occlusion_out;

    return color;
}

void main() {
    vec4 materialColor = texture(DiffuseTexture, UV);
    float alpha = materialColor.a;

    if(alpha < 0.5) {
        discard;
    }
    
    // Normal, light direction and eye direction in world coordinates
    vec3 N = Normal;
    vec3 L = LightDir;
    vec3 E = normalize(CamPos - Pos);

	// Direct light calculation
	vec3 direct;
	
		// Shadow map
		float visibility = texture(ShadowMap, vec3(Position_depth.xy, (Position_depth.z - 0.0005)/Position_depth.w));
		//float visibility = TraceShadow(LightDir);
		float cosTheta = max(0, dot(N, L));
		//direct = (ShowDiffuse > 0.5 ? vec3(cosTheta) : vec3(0.0)) * materialColor.rgb;
		direct = (ShowDiffuse > 0.5 ? vec3(visibility * cosTheta) : vec3(0.0)) * materialColor.rgb;
	
	 
    // Indirect light calculation
    vec3 indirect;
    
        // Indirect diffuse light
		float occlusion = 0.0;
        vec3 indirectDiffuseLight = indirectLight(occlusion).rgb;
        indirectDiffuseLight = ShowIndirectDiffuse > 0.5 ? 4.0 * indirectDiffuseLight : vec3(0.0);

        // Sum direct and indirect diffuse light and tweak a little bit
        occlusion = min(1.0, 1.5 * occlusion); // Make occlusion brighter
        indirectDiffuseLight = 2.0 * occlusion * indirectDiffuseLight * materialColor.rgb;

		// Calculate specular light
		vec3 indirectSpecularLight;
		vec4 specularColor = texture(SpecularTexture, UV);
		// Some specular textures are grayscale:
		specularColor = length(specularColor.gb) > 0.0 ? specularColor : specularColor.rrra;
		vec3 reflectDir = normalize(-E - 2.0 * dot(-E, N) * N);

		// Maybe fix so that the cone doesnt trace below the plane defined by the surface normal.
		// For example so that the floor doesnt reflect itself when looking at it with a small angle
		float specularOcclusion;
		vec4 tracedSpecular = coneTrace(reflectDir, 0.07, specularOcclusion); // 0.2 = 22.6 degrees, 0.1 = 11.4 degrees, 0.07 = 8 degrees angle
		indirectSpecularLight = ShowIndirectSpecular > 0.5 ? 2.0 * specularColor.rgb * tracedSpecular.rgb : vec3(0.0);

		indirect = indirectDiffuseLight + indirectSpecularLight;
    

    color = vec4(direct + indirect, alpha);

	/*
	// Calculate diffuse light
    vec3 diffuseReflection;
    {
        // Shadow map
        float visibility = texture(ShadowMap, vec3(Position_depth.xy, (Position_depth.z - 0.0005)/Position_depth.w));

        // Direct diffuse light
        float cosTheta = max(0, dot(N, L));
        vec3 directDiffuseLight = ShowDiffuse > 0.5 ? vec3(visibility * cosTheta) : vec3(0.0);

        // Indirect diffuse light
		float occlusion = 0.0;
        vec3 indirectDiffuseLight = indirectLight(occlusion).rgb;
        indirectDiffuseLight = ShowIndirectDiffuse > 0.5 ? 4.0 * indirectDiffuseLight : vec3(0.0);

        // Sum direct and indirect diffuse light and tweak a little bit
        occlusion = min(1.0, 1.5 * occlusion); // Make occlusion brighter
        diffuseReflection = 2.0 * occlusion * (directDiffuseLight + indirectDiffuseLight) * materialColor.rgb;
    }
    
    // Calculate specular light
    vec3 specularReflection;
    {
        vec4 specularColor = texture(SpecularTexture, UV);
        // Some specular textures are grayscale:
        specularColor = length(specularColor.gb) > 0.0 ? specularColor : specularColor.rrra;
        vec3 reflectDir = normalize(-E - 2.0 * dot(-E, N) * N);

        // Maybe fix so that the cone doesnt trace below the plane defined by the surface normal.
        // For example so that the floor doesnt reflect itself when looking at it with a small angle
        float specularOcclusion;
        vec4 tracedSpecular = coneTrace(reflectDir, 0.07, specularOcclusion); // 0.2 = 22.6 degrees, 0.1 = 11.4 degrees, 0.07 = 8 degrees angle
        specularReflection = ShowIndirectSpecular > 0.5 ? 2.0 * specularColor.rgb * tracedSpecular.rgb : vec3(0.0);
    }

    color = vec4(diffuseReflection + specularReflection, alpha);
	*/
}