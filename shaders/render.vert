#version 430

layout(location = 0) in vec3 vertexPosition_model;
layout(location = 1) in vec2 vertexUV;
layout(location = 2) in vec3 vertexNormal_model;
layout(location = 3) in vec3 vertexTangent_model;
layout(location = 4) in vec3 vertexBitangent_model;

out vec2 UV;
out vec3 Pos;
out vec3 Normal;
out vec4 Position_depth;
out mat3 TanToWorld;

uniform mat4 ModelMatrix;
uniform mat4 ModelViewMatrix;
uniform mat4 ProjectionMatrix;
uniform mat4 DepthModelViewProjectionMatrix;

void main() {
	gl_Position =  ProjectionMatrix * ModelViewMatrix * vec4(vertexPosition_model,1);

	Pos = (ModelMatrix * vec4(vertexPosition_model,1)).xyz;

	Position_depth = DepthModelViewProjectionMatrix * vec4(vertexPosition_model, 1);
	Position_depth.xyz = Position_depth.xyz * 0.5 + 0.5;

	Normal = normalize((ModelMatrix * vec4(vertexNormal_model,0)).xyz);
	TanToWorld = inverse(transpose(mat3(normalize((ModelMatrix * vec4(vertexTangent_model,0)).xyz), 
											Normal, 
											normalize((ModelMatrix * vec4(vertexBitangent_model,0)).xyz))));
	UV = vertexUV;
}