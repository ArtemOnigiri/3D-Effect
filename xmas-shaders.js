function makeProgramXmas(gl, mouse = false) {
	let vertexShaderCode =
		`#version 300 es
		in vec2 a_position;
		in vec2 a_texcoord;
		out vec2 v_texcoord;
		void main() {
			v_texcoord = a_texcoord;
			gl_Position = vec4(a_position, 0.0, 1.0);
		}
	`;

	let fragmentShaderCode =
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

		float pinch(float p, float d, float h) {
			return d + abs(p / (h * 5.0 + 0.5));
		}

		float sdCone( vec3 p, vec2 c, float h ) {
			vec2 q = h*vec2(c.x/c.y,-1.0);
			vec2 w = vec2( length(p.xy), p.z );
			vec2 a = w - q*clamp( dot(w,q)/dot(q,q), 0.0, 1.0 );
			vec2 b = w - q*vec2( clamp( w.x/q.x, 0.0, 1.0 ), 1.0 );
			float k = sign( q.y );
			float d = min(dot( a, a ),dot(b, b));
			float s = max( k*(w.x*q.y-w.y*q.x),k*(w.y-q.y)  );
			return sqrt(d)*sign(s);
		}

		float sdStar5(in vec2 p, in float r, in float rf) {
			const vec2 k1 = vec2(0.809016994375, -0.587785252292);
			const vec2 k2 = vec2(-k1.x,k1.y);
			p.x = abs(p.x);
			p -= 2.0*max(dot(k1,p),0.0)*k1;
			p -= 2.0*max(dot(k2,p),0.0)*k2;
			p.x = abs(p.x);
			p.y -= r;
			vec2 ba = rf*vec2(-k1.y,k1.x) - vec2(0,1);
			float h = clamp( dot(p,ba)/dot(ba,ba), 0.0, r );
			return length(p-ba*h) * sign(p.y*ba.x-p.x*ba.y);
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

		vec2 getDist(vec3 p) {
			vec2 c = vec2(sin(3.1415 / 6.0), cos(3.1415 / 6.0));
			float d = sdCone(p - vec3(0.0, 0.0, 1.0), c, 0.3);
			c = vec2(sin(3.1415 / 5.5), cos(3.1415 / 5.5));
			d = min(d, sdCone(p - vec3(0.0, 0.0, 0.8), c, 0.5));
			c = vec2(sin(3.1415 / 5.0), cos(3.1415 / 5.0));
			d = min(d, sdCone(p - vec3(0.0, 0.0, 0.5), c, 0.7));
			c = vec2(sin(3.1415 / 4.5), cos(3.1415 / 4.5));
			d = min(d, sdCone(p - vec3(0.0, 0.0, 0.1), c, 0.9));
			float id = 1.0;
			float star = sdStar5(p.yz - vec2(0.0, 1.05), 0.1, 0.5);
			star = pinch(p.x, star, 0.1) * 0.5;
			if(star < d) {
				d = star;
				id = 2.0;
			}
			p.xy = abs(p.xy);
			float balls = length(p - vec3(0.35, 0.15, -0.05)) - 0.1;
			balls = min(balls, length(p - vec3(0.15, 0.25, 0.15)) - 0.1);
			balls = min(balls, length(p - vec3(0.4, 0.3, -0.5)) - 0.1);
			balls = min(balls, length(p - vec3(0.15, 0.15, 0.5)) - 0.1);
			if (balls < d) {
				d = balls;
				id = 3.0;
			}
			float s = p.z * 0.5 - u_time * 0.25 + 1.0;
			d = max(d, s);
			return vec2(d, id);
		}

		vec3 getNormal(vec3 p) {
			float d = getDist(p).x;
			vec2 e = vec2(0.0001, 0.0);
			vec3 n = d - vec3(getDist(p - e.xyy).x, getDist(p - e.yxy).x, getDist(p - e.yyx).x);
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

		vec4 getGlow(vec2 g) {
			g.x = max(1.0, g.x * 100.0);
			float t = clamp(6.0 - u_time, 0.0, 1.0);
			vec4 col = vec4(1.0, 0.8, 0.4, 1.0);
			if (g.y == 2.0) {
				g.x *= 2.0;
				t = 1.0;
			}
			return 1.0 / g.x * t * col;
		}

		vec4 march(vec3 ro, vec3 rd) {
			vec3 light = normalize(vec3(-0.5, 0.5, 1.0));
			vec3 p = ro;
			vec2 minD = vec2(1000.0, 0.0);
			for(int i = 0; i < 200; i++) {
				vec2 d = getDist(p);
				if(d.x > 20.0) return getGlow(minD);
				if (d.x < minD.x) {
					minD = d;
				}
				if(d.x < 0.005) {
					vec3 n = getNormal(p);
					vec3 refDir = reflect(rd, n);
					vec3 dif = vec3(dot(n, light) * 0.5 + 0.5);
					if (d.y == 1.0) dif *= vec3(0.4, 0.8, 0.2);
					else if (d.y == 2.0) dif *= vec3(1.0, 0.8, 0.4);
					else dif = vec3(0.6, 0.1, 0.05);
					float ref = dot(light, refDir) * 0.5 + 0.5;
					ref = pow(ref, 256.0);
					vec3 colRef = getSkyRef(ro, refDir);
					vec3 col = dif + vec3(ref) + colRef * 0.2;
					return vec4(col, 1.0) + getGlow(minD);
				}
				p += rd * d.x;
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
	const mouseCode = `
		float ballSize = clamp(u_time - 4.0, 0.0, 0.3);
		p.yx *= rot(-u_time + sin(u_time * 1.0) * 1.0);
		p.yz -= u_mouse;
		float ball = length(p) - ballSize;
		d = smin(d, ball, ballSize);
	`;
	if (mouse) fragmentShaderCode = fragmentShaderCode.replace('// mouse', mouseCode);
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderCode);
	gl.compileShader(vertexShader);
	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderCode);
	gl.compileShader(fragmentShader);
	const log = gl.getShaderInfoLog(fragmentShader);
	if (log) console.log(log);

	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	const positionAttribute = gl.getAttribLocation(program, 'a_position');
	const texcoordAttribute = gl.getAttribLocation(program, "a_texcoord");
	const resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
	const mouseUniform = gl.getUniformLocation(program, 'u_mouse');
	const timeUniform = gl.getUniformLocation(program, 'u_time');
	return { program, positionAttribute, texcoordAttribute, resolutionUniform, mouseUniform, timeUniform };
}