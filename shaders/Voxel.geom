#version 430

layout (triangles) in;
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
uniform float VoxelDim;
uniform float WorldSize;

void expandTriangles(inout vec2 pos[3], float size)
{
	vec2 lb, mid, ru;
	int id_l, id_m, id_r;

	if (pos[1].x > pos[0].x && pos[1].y > pos[0].y)
	{
		mid = pos[1];
		id_m = 1;
		lb = pos[0];
		id_l = 0;
	}
	else
	{
		mid = pos[0];
		id_m = 0;
		lb = pos[1];
		id_l = 1;
	}

	if (pos[2].x > mid.x && pos[2].y > mid.y)
	{
		ru = pos[2];
		id_r = 2;
	}
	else if (pos[2].x > lb.x && pos[2].y > lb.y)
	{
		ru = pos[id_m];
		id_r = id_m;
		mid = pos[2];
		id_m = 2;
	}
	else
	{
		ru = pos[id_m];
		id_r = id_m;
		mid = pos[id_l];
		id_m = id_l;
		lb = pos[2];
		id_l = 2;
	}

	pos[id_l] -= size;
	pos[id_r] += size;
	if (2 * mid.x <= lb.x + ru.x)
	{
		pos[id_m].x -= size;
	}
	else
	{
		pos[id_m].x += size;
	}
	if (2 * mid.y <= lb.y + ru.y)
	{
		pos[id_m].y -= size;
	}
	else
	{
		pos[id_m].y += size;
	}
}

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
	vec2 expand[3];
	if (direction == 1)
	{
		aabb.xy = min(pos[0].yz, min(pos[1].yz, pos[2].yz));
		aabb.zw = max(pos[0].yz, max(pos[1].yz, pos[2].yz));
		aabb.xy -= vec2(1.0f / VoxelDim); // Enlarge surrounding
		aabb.zw += vec2(1.0f / VoxelDim);

		expand[0] = pos[0].yz;
		expand[1] = pos[1].yz;
		expand[2] = pos[2].yz;
		expandTriangles(expand, WorldSize/VoxelDim);
		expandTriangles(expand, WorldSize/VoxelDim);
		expandTriangles(expand, WorldSize/VoxelDim);
	}
	else if (direction == 2)
	{
		aabb.xy = min(pos[0].xz, min(pos[1].xz, pos[2].xz));
		aabb.zw = max(pos[0].xz, max(pos[1].xz, pos[2].xz));
		aabb.xy -= vec2(1.0f / VoxelDim); // Enlarge surrounding
		aabb.zw += vec2(1.0f / VoxelDim);
		
		expand[0] = pos[0].xz;
		expand[1] = pos[1].xz;
		expand[2] = pos[2].xz;
		expandTriangles(expand, WorldSize/VoxelDim);
		expandTriangles(expand, WorldSize/VoxelDim);
		expandTriangles(expand, WorldSize/VoxelDim);
	}
	else
	{
		aabb.xy = min(pos[0].xy, min(pos[1].xy, pos[2].xy));
		aabb.zw = max(pos[0].xy, max(pos[1].xy, pos[2].xy));
		aabb.xy -= vec2(1.0f / VoxelDim); // Enlarge surrounding
		aabb.zw += vec2(1.0f / VoxelDim);
		
		expand[0] = pos[0].xy;
		expand[1] = pos[1].xy;
		expand[2] = pos[2].xy;
		expandTriangles(expand, WorldSize/VoxelDim);
		expandTriangles(expand, WorldSize/VoxelDim);
		expandTriangles(expand, WorldSize/VoxelDim);
	}
	
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