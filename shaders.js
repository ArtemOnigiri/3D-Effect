function makeProgram(gl) {
	const vertexShaderCode =
		`#version 300 es
		in vec2 a_position;
		in vec2 a_texcoord;
		out vec2 v_texcoord;
		void main() {
			v_texcoord = a_texcoord;
			gl_Position = vec4(a_position, 0.0, 1.0);
		}
	`;

	const fragmentShaderCode =
		`#version 300 es
		precision highp float;
		uniform float u_time;
		uniform vec2 u_resolution;
		uniform vec2 u_mouse;
		in vec2 v_texcoord;
		out vec4 outColor;

		float soft(float a) {
			a = clamp(a, 0.0, 1.0);
			return 1.0 - cos(a * 3.1415) * 0.5 - 0.5;
		}

		float extrude(float p, float d, float h) {
			vec2 w = vec2(d, abs(p) - h);
			return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
		}

		float smin(float a, float b, float k) {
			float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
			return mix(b, a, h) - k * h * (1.0 - h);
		}

		float smax(float d1, float d2, float k) {
			float h = max(k - abs(-d1 - d2), 0.0);
			return max(-d1, d2) + h * h * 0.25 / k;
		}

		mat2 rot(float a) {
			float s = sin(a);
			float c = cos(a);
			return mat2(c, -s, s, c);
		}

		float plane(vec3 p, vec3 n, float h) {
			return dot(p, n) + h;
		}

		float box(vec2 p, vec2 b) {
			vec2 d = abs(p) - b;
			return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
		}

		float horseshoe(vec2 p, vec2 c, float r, vec2 w) {
			p.x = abs(p.x);
			float l = length(p);
			p = mat2(-c.x, c.y, c.y, c.x) * p;
			p = vec2((p.y > 0.0 || p.x > 0.0) ? p.x : l * sign(-c.x), (p.x > 0.0) ? p.y : l);
			p = vec2(p.x, abs(p.y - r)) - w;
			return length(max(p, 0.0)) + min(0.0, max(p.x, p.y));
		}

		float getDist(vec3 p) {
			vec2 uv = p.yz + vec2(0.5, -0.35);
			uv *= rot(-2.0);
			float d3u = horseshoe(uv, vec2(cos(1.0), sin(1.0)), 0.3, vec2(0.0, 0.1));
			uv = p.yz + vec2(0.5, 0.3);
			uv *= rot(-1.0);
			float d3d = horseshoe(uv, vec2(cos(1.0), sin(1.0)), 0.35, vec2(0.0, 0.1));
			float d3 = min(d3u, d3d);
			uv = p.yz + vec2(-0.4, 0.0);
			float dd = box(uv, vec2(0.25, 0.15)) - 0.15;
			dd = abs(dd - 0.3) - 0.12;
			dd = max(dd, -uv.x);
			dd = min(dd, box(uv + vec2(0.0, 0.0), vec2(0.13, 0.72)));
			float d = min(d3, dd) - 0.02;
			d = mix(abs(d) - 0.001, d, clamp(u_time - 3.5, 0.0, 1.0));
			float s = -uv.y * 0.5 - u_time * 0.5 + 1.0;
			d = max(d, s);
			float e = clamp(u_time - 4.0, 0.01, 1.0) * 0.1;
			d = extrude(p.x, d, e) - 0.01;
			return d;
		}

		vec3 getNormal(vec3 p) {
			float d = getDist(p);
			vec2 e = vec2(0.0001, 0.0);
			vec3 n = d - vec3(getDist(p - e.xyy), getDist(p - e.yxy), getDist(p - e.yyx));
			return normalize(n);
		}

		float castPlane(vec3 ro, vec3 rd, vec4 p) {
			return -(dot(ro, p.xyz) + p.w) / dot(rd, p.xyz);
		}

		vec3 getSky(vec3 ro, vec3 rd) {
			float d = castPlane(ro, rd, vec4(0.0, 0.0, 1.0, 0.8));
			if(d > 0.0) {
				vec3 it = ro + rd * d;
				float colSquare = sin(it.x) + sin(it.y);
				colSquare = step(0.0, colSquare);
				vec3 col = mix(vec3(0.2), vec3(0.9), colSquare);
				float fog = distance(it, ro);
				float size = u_time * 20.0;
				size = min(size, 20.0);
				fog /= size;
				col *= (1.0 - fog);
				return col;
			}
			return vec3(0.0);
		}

		vec3 getSkyRef(vec3 ro, vec3 rd) {
			float d = castPlane(ro, rd, vec4(0.0, 0.0, 1.0, 0.8));
			if(d > 0.0) {
				vec3 it = ro + rd * d;
				float colSquare = sin(it.x) + sin(it.y);
				colSquare = step(0.0, colSquare);
				return mix(vec3(0.2), vec3(0.9), colSquare);
			}
			return vec3(0.0);
		}

		vec4 getGlow(float g) {
			g = max(1.0, g * 100.0);
			float t = clamp(6.0 - u_time, 0.0, 1.0);
			return 1.0 / g * t * vec4(0.8, 0.9, 1.0, 1.0);
		}

		vec4 march(vec3 ro, vec3 rd) {
			vec3 light = normalize(vec3(-0.5, 0.5, 1.0));
			vec3 p = ro;
			float minD = 1000.0;
			for(int i = 0; i < 200; i++) {
				float d = getDist(p);
				if(d > 20.0) return getGlow(minD);
				minD = min(minD, d);
				if(d < 0.005) {
					vec3 n = getNormal(p);
					vec3 refDir = reflect(rd, n);
					float dif = dot(n, light) * 0.5 + 0.25;
					float ref = dot(light, refDir) * 0.5 + 0.5;
					ref = pow(ref, 256.0);
					vec3 colRef = getSkyRef(ro, refDir);
					vec3 col = vec3(dif + ref) + colRef * 0.2;
					return vec4(col, 1.0) + getGlow(minD);
				}
				p += rd * d;
			}
			return getGlow(minD);
		}

		void main() {
			vec2 uv = v_texcoord - 0.5;
			uv.x *= u_resolution.x / u_resolution.y;
			vec3 ro = vec3(-3.0, 0.0, 1.0);
			vec3 rd = normalize(vec3(1.0, uv));
			rd.xz *= rot(-0.3);
			ro.xy *= rot(-u_time + sin(u_time * 1.0) * 1.0);
			rd.xy *= rot(-u_time + sin(u_time * 1.0) * 1.0);
			vec3 bg = getSky(ro, rd);
			vec4 col = march(ro, rd);
			col.rgb = mix(bg, col.rgb, col.a);
			outColor = vec4(col.rgb, 1.0);
		}
	`;
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderCode);
	gl.compileShader(vertexShader);
	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderCode);
	gl.compileShader(fragmentShader);
	const log = gl.getShaderInfoLog(fragmentShader);
	if(log) console.log(log);

	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	const positionAttribute = gl.getAttribLocation(program, 'a_position');
	const texcoordAttribute = gl.getAttribLocation(program, "a_texcoord");
	const resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
	const mouseUniform = gl.getUniformLocation(program, 'u_mouse');
	const timeUniform = gl.getUniformLocation(program, 'u_time');
	return {program, positionAttribute, texcoordAttribute, resolutionUniform, mouseUniform, timeUniform};
}