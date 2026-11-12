const NAMES = ["black", "white", "red", "green", "blue", "yellow", "magenta", "cyan"];
const SIZE = 64;

export async function loadOxydPainter(base = "../assets/oxyd") {
	const patternImage = await loadImage(`${base}/pattern.png`);
	const sprites = [];
	for (const name of NAMES) sprites.push(await loadImage(`${base}/${name}.png`));
	return createPainter(sprites, patternImage);
}

function loadImage(src) {
	const image = new Image();
	image.src = src;
	return image.decode().then(() => image);
}

function createPainter(sprites, patternImage) {
	const scratch = document.createElement("canvas");
	scratch.width = SIZE;
	scratch.height = SIZE;
	const read = scratch.getContext("2d", { willReadFrequently: true });
	const sphere = buildSphere();
	const glasses = sprites.map((sprite) => scaledPixels(read, sprite));
	const pattern = nativePixels(patternImage);
	const sheets = new WeakMap();

	function draw(context, marble, diameter = 16) {
		let sheet = sheets.get(marble);
		if (!sheet) {
			const canvas = document.createElement("canvas");
			canvas.width = SIZE;
			canvas.height = SIZE;
			const ctx = canvas.getContext("2d", { willReadFrequently: true });
			sheet = {
				canvas,
				ctx,
				image: ctx.createImageData(SIZE, SIZE),
				qx: 0,
				qy: 0,
				qz: 0,
				qw: 0
			};
			sheets.set(marble, sheet);
		}
		const q = marble.q;
		if (q[0] !== sheet.qx || q[1] !== sheet.qy || q[2] !== sheet.qz || q[3] !== sheet.qw) {
			project(sheet.image.data, glasses[marble.kind], pattern, sphere, q);
			sheet.ctx.putImageData(sheet.image, 0, 0);
			sheet.qx = q[0];
			sheet.qy = q[1];
			sheet.qz = q[2];
			sheet.qw = q[3];
		}
		context.drawImage(sheet.canvas, marble.x - diameter / 2, marble.y - diameter / 2, diameter, diameter);
	}

	return { draw };
}

function scaledPixels(read, image) {
	read.clearRect(0, 0, SIZE, SIZE);
	read.drawImage(image, 0, 0, SIZE, SIZE);
	return read.getImageData(0, 0, SIZE, SIZE).data;
}

function nativePixels(image) {
	const canvas = document.createElement("canvas");
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	ctx.drawImage(image, 0, 0);
	return {
		data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
		w: canvas.width,
		h: canvas.height
	};
}

function buildSphere() {
	const count = SIZE * SIZE;
	const x = new Float32Array(count);
	const y = new Float32Array(count);
	const z = new Float32Array(count);
	const on = new Uint8Array(count);
	const radius = (SIZE - 1) / 2;
	const limit = radius * radius;
	for (let row = 0; row < SIZE; row++) {
		for (let col = 0; col < SIZE; col++) {
			const index = row * SIZE + col;
			const px = col - radius;
			const pz = row - radius;
			x[index] = px;
			z[index] = pz;
			const rr = px * px + pz * pz;
			if (rr <= limit) {
				y[index] = Math.sqrt(limit - rr);
				on[index] = 1;
			}
		}
	}
	return { x, y, z, on };
}

function project(out, glass, pattern, sphere, q) {
	const qx = q[0];
	const qy = q[1];
	const qz = q[2];
	const qw = q[3];
	const pw = pattern.w;
	const ph = pattern.h;
	const pdata = pattern.data;
	for (let i = 0; i < sphere.on.length; i++) {
		const o = i * 4;
		const sa = glass[o + 3];
		if (!sphere.on[i] || sa === 0) {
			out[o + 3] = 0;
			continue;
		}
		const x = sphere.x[i];
		const y = sphere.y[i];
		const z = sphere.z[i];
		const qvx = qw * x + qz * y - qy * z;
		const qvy = qw * y + qx * z - qz * x;
		const qvz = qw * z + qy * x - qx * y;
		const qvw = -qx * x - qy * y - qz * z;
		let rx = -qvw * qx + qvx * qw - qvz * qy + qvy * qz;
		let ry = -qvw * qy + qvy * qw - qvx * qz + qvz * qx;
		let rz = -qvw * qz + qvz * qw - qvy * qx + qvx * qy;
		const len = Math.hypot(rx, ry, rz) || 1;
		rx /= len;
		ry /= len;
		rz /= len;
		const lon = Math.atan2(rz, rx);
		const lat = Math.acos(ry < -1 ? -1 : ry > 1 ? 1 : ry);
		const u = lon / Math.PI * 0.5 + 0.5;
		const v = 1 - lat / Math.PI;
		const p = sample(pdata, pw, ph, u, v);
		const pa = p[3];
		const inv = 255 - pa;
		out[o] = (glass[o] * p[0] * inv + p[0] * pa * 255 / 1.5) / 65025;
		out[o + 1] = (glass[o + 1] * p[1] * inv + p[1] * pa * 255 / 1.5) / 65025;
		out[o + 2] = (glass[o + 2] * p[2] * inv + p[2] * pa * 255 / 1.5) / 65025;
		out[o + 3] = sa;
	}
}

function sample(data, w, h, u, v) {
	let x = u * w - 0.5;
	let y = v * h - 0.5;
	let x0 = Math.floor(x);
	let y0 = Math.floor(y);
	const tx = x - x0;
	const ty = y - y0;
	x0 = ((x0 % w) + w) % w;
	y0 = ((y0 % h) + h) % h;
	const x1 = (x0 + 1) % w;
	const y1 = (y0 + 1) % h;
	const i00 = (y0 * w + x0) * 4;
	const i10 = (y0 * w + x1) * 4;
	const i01 = (y1 * w + x0) * 4;
	const i11 = (y1 * w + x1) * 4;
	const sx = 1 - tx;
	const sy = 1 - ty;
	return [
		data[i00] * sx * sy + data[i10] * tx * sy + data[i01] * sx * ty + data[i11] * tx * ty,
		data[i00 + 1] * sx * sy + data[i10 + 1] * tx * sy + data[i01 + 1] * sx * ty + data[i11 + 1] * tx * ty,
		data[i00 + 2] * sx * sy + data[i10 + 2] * tx * sy + data[i01 + 2] * sx * ty + data[i11 + 2] * tx * ty,
		data[i00 + 3] * sx * sy + data[i10 + 3] * tx * sy + data[i01 + 3] * sx * ty + data[i11 + 3] * tx * ty
	];
}
