#version 430

layout(location = 0) in vec3 vertexPosition_model;
layout(location = 1) in vec3 vertexUV;

out vec4 position;
out vec2 texCoord;

uniform mat4 ModelViewProjectionMatrix;

void main() {
	vec4 vertexPos = vec4(vertexPosition_model, 1.0);
    position = ModelViewProjectionMatrix * vertexPos;
    texCoord = vertexUV.xy;
	gl_Position = ModelViewProjectionMatrix * vec4(vertexPosition_model, 1);
}
