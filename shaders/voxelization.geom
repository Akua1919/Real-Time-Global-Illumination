#version 430

layout (triangles) in; // glDrawArrays is set to triangles so that's what we're working with
layout (triangle_strip, max_vertices = 3) out;

in vData {
    vec2 UV;
	vec4 position_depth;
	vec3 normal;
} vertices[];

out fData {
	flat int axis;
    vec2 UV;
	vec3 pos;
	vec3 normal;
	vec4 position_depth;
	vec4 AABB;
} frag;

uniform mat4 ProjX;
uniform mat4 ProjY;
uniform mat4 ProjZ;
uniform int VoxelDim;

void main() {
    vec3 p1 = gl_in[1].gl_Position.xyz - gl_in[0].gl_Position.xyz;
    vec3 p2 = gl_in[2].gl_Position.xyz - gl_in[0].gl_Position.xyz;
    vec3 normal = normalize(cross(p1,p2));

	int direction = 0; // 1 - x | 2 - y | 3 - z
	mat4 ProjMat; // Project onto which plane

	if ((abs(normal.x) > abs(normal.y)) && (abs(normal.x) > abs(normal.z))){
		direction = 1;
	}
	else if ((abs(normal.y) > abs(normal.x)) && (abs(normal.y) > abs(normal.z))){
		direction = 2;
	}
	else{
		direction = 3;
	}

	if (direction == 1){
		ProjMat = ProjX;
	}
	else if (direction == 2){
		ProjMat = ProjY;
	}
	else{
		ProjMat = ProjZ;
	}

	vec4 pos[3] = vec4[3]
	(
		ProjMat * gl_in[0].gl_Position,
		ProjMat * gl_in[1].gl_Position,
		ProjMat * gl_in[2].gl_Position
	);

	// AABB for conservative voxelization
	vec4 aabb; // [lb rb lu ru]
	aabb.xy = min(pos[0].xy, min(pos[1].xy, pos[2].xy));
	aabb.zw = max(pos[0].xy, max(pos[1].xy, pos[2].xy));
	aabb.xy -= vec2(1.0f / VoxelDim); // Enlarge surrounding
	aabb.zw += vec2(1.0f / VoxelDim);

    for(int i = 0;i < gl_in.length(); i++) {
		frag.axis = direction;
        frag.UV = vertices[i].UV;
		frag.pos = pos[i].xyz;
		frag.normal = vertices[i].normal;
		frag.position_depth = vertices[i].position_depth;
		frag.AABB = aabb;
        gl_Position = pos[i];
        EmitVertex();
    }
    EndPrimitive();
}