const cnv = document.getElementById('cnv');
const width = cnv.width = window.innerWidth;
const height = cnv.height = window.innerHeight;
const gl = cnv.getContext('webgl2');

const quad = [
	-1, -1,
	 1, -1,
	 1,  1,
	 1,  1,
	-1,  1,
	-1, -1,
];

const textCoords = [
	0, 0,
	1, 0,
	1, 1,
	1, 1,
	0, 1,
	0, 0,
];

let time = 0;
let currentTime = Date.now();
let interval;
let program;
let mx = 0;
let my = 0;
document.addEventListener('mousemove', mouseMove);

initGL();

function initGL() {
	gl.viewport(0, 0, width, height);
	program = makeProgram(gl);

	gl.useProgram(program.program);

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(program.positionAttribute);
	gl.vertexAttribPointer(program.positionAttribute, 2, gl.FLOAT, false, 0, 0);

	const texcoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textCoords), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(program.texcoordAttribute);
	gl.vertexAttribPointer(program.texcoordAttribute, 2, gl.FLOAT, false, 0, 0);

	gl.uniform2f(program.resolutionUniform, width, height);

	window.requestAnimationFrame(update);
}

function update() {
	let currentTimeNew = Date.now();
	let deltaTime = currentTimeNew - currentTime;
	time += deltaTime;
	gl.uniform2f(program.mouseUniform, mx * 2.8, -my * 1.5);
	currentTime = currentTimeNew;

	const urlParams = new URLSearchParams(window.location.search);
    let speed = urlParams.get('speed');
    speed = (speed !== null && !isNaN(speed)) ? parseFloat(speed) : 1000;


	gl.uniform1f(program.timeUniform, time / speed);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	window.requestAnimationFrame(update);
}

function mouseMove(e) {
	mx = e.clientX / width * 2 - 1;
	my = e.clientY / height * 2 - 1;
}
