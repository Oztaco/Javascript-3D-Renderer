/////////////// State mgr
scenes = [];
beforeFuncs = [];
afterFuncs = [];
sceneVars = {
    current: {
        index: 0,
        id: "_loader"
    },
    overlay: {
        index: 1,
        id: "",
        active: false
    },
    lastUpdateTime: 0,
    elapsedUpdateTime: 0
};
//currentSceneIndex = 0; // The actual current scene (or state, whatever you call it)
//currentSceneName = "";
//overlayScene = false; // If true, current scene will not be updated but still drawn. Used to handle pausing and other such menus
//overlaySceneIndex = 1; // The scene that will be drawn on top of the current one, if overlayScene is true

// Provides timing fallback
window.performance = window.performance || {};
performance.now = function(){return performance.now||performance.mozNow||performance.msNow||performance.oNow||performance.webkitNow||function(){return(new Date).getTime()}}();
// Scene timing
//sceneLastUpdateTime = 0;     // Used to calculate time delta between each frame 
//sceneElapsedUpdateTime = 0;  //

function setScene(id) { // Changes the current scene
// Searches for the scene by ID, if found it de-inits the current scene, changes the scene, and inits the new one.
	for (var i = 0; i < scenes.length; i++) {
		if (scenes[i].id == id) {
			if (sceneVars.current.index == i) return false; // It's the same scene!
			if (scenes[sceneVars.current.index].cleanUp) scenes[sceneVars.current.index].cleanUp();
			sceneVars.current.index = i;
            sceneVars.current.id = scenes[i].id;
			sceneVars.lastUpdateTime = 0;
			sceneVars.elapsedUpdateTime = 0;
			if (scenes[sceneVars.current.index].init) scenes[sceneVars.current.index].init();
			return true;
		}
	}
	return false; // Not found
}
function scene(id, obj) { // Adds a new scene. I called it just "scene" because the code looks cleaner this way
	scenes.push(obj);
	scenes[scenes.length - 1].id = id;
}

// The update and draw logic below
function sceneUpdate () {
	sceneVars.elapsedUpdateTime = performance.now() - sceneVars.lastUpdateTime;
	scenes[sceneVars.current.index].update();
	sceneVars.lastUpdateTime = performance.now();
}
function sceneOverlayUpdate() {
	sceneVars.elapsedUpdateTime = performance.now() - sceneVars.lastUpdateTime;
	scenes[sceneVars.overlay.index].update();
	sceneVars.lastUpdateTime = performance.now();
}
function sceneDraw() {
	scenes[sceneVars.current.index].draw();
}
function sceneOverlayDraw() {
	scenes[sceneVars.current.index].draw();
}
lastFrame = 0;
function pipeline() { // This is the main game loop, handles updating, drawing, and overlays (i.e. pausing)
	if (performance.now() - lastFrame > 10) {
		while (beforeFuncs.length > 0) {
			beforeFuncs[0]();
			beforeFuncs.shift();
		}
		if (!sceneVars.overlay.active) {
			sceneUpdate();
			sceneDraw();
		}
		else {
			sceneOverlayUpdate();
			sceneDraw();
			sceneOverlayDraw();
		}
		while (afterFuncs.length > 0) {
			afterFuncs[0]();
			afterFuncs.shift();
		}
		dbg_recordFpsFrame();
		lastFrame = performance.now();
	}
	requestAnimationFrame(pipeline);
}
function startEngine(loop, canvasID) {
	if (scenes[sceneVars.current.index].init)
        scenes[sceneVars.current.index].init();
    canvas = document.getElementById(canvasID);
    ctx = canvas.getContext("2d");
	requestAnimationFrame(loop);
}
function showOverlayScene(id) {
		for (var i = 0; i < scenes.length; i++) {
		if (scenes[i].id == id) {
			if (sceneVars.current.index == i) return false; // You can't overlay a scene over itself
			sceneVars.overlay.index = i;
            sceneVars.overlay.id = scenes[i].id;
			sceneVars.lastUpdateTime = 0;
			sceneVars.elapsedUpdateTime = 0;
			if (scenes[sceneVars.overlay.index].init) scenes[sceneVars.overlay.index].init();
			return true;
		}
	}
	return false; // Not found
}
function queueFunctionBefore(func) {
	beforeFuncs.push(func);
}
function queueFunctionAfter(func) {
	afterFuncs.push(func);
}

///////////// Resource manager =================================================================================
res = {}; // To access resources, do res.idOfResource 
resVars = {
	totalResources: 0,
	resourcesLeftToDownload: 0,
	failedResources: 0,
	resourceReference: null // Used to refer to the current resource because Javascript doesn't give access to parent objects
};
downloadDone = false; // Check if all resources are downloaded
function resource(_id, _type, _paths) { // Queues a resource for download. Called it resource so it can be declared in the same way of a scene
	var resi = {
		paths: _paths, // Multiple paths, will try until one works
		pathToTry: 0, // Increments each time until a path works
		type: _type, // image, audio, video
		downloaded: false,
		failed: false,
		data: (_type == "image") ? new Image() :
			  (_type == "audio") ? new Audio() : 
			  (console.log(_type + " is not supported by the resource downloader.")) ? false : false // To do: add video support
	};
	res[_id] = resi;
	resVars.totalResources++;
	resVars.resourcesLeftToDownload++;
}
function downloadResources() {
	for (var resx in res) {
		if ((res.hasOwnProperty(resx) && !res[resx].downloaded) && !res[resx].failed) {
			if (res[resx].type == "image") {
				res[resx].data.onload = function () {
					resVars.resourceReference.downloaded = true;
					resVars.resourcesLeftToDownload--;
					downloadResources();
				}
				res[resx].data.onerror = function () {
					resVars.resourceReference.pathToTry++;
					if (resVars.resourceReference.pathToTry > resVars.resourceReference.paths.length - 1) {
						resVars.resourceReference.failed = true;
						resVars.failedResources++;
					}
					console.log("Resource failed to load: " + resVars.resourceReference.paths[resVars.resourceReference.pathToTry]);
					downloadResources();
				}
				resVars.resourceReference = res[resx];
				res[resx].data.crossOrigin = "anonymous";
				res[resx].data.src = res[resx].paths[res[resx].pathToTry];
				break;
			}
			else if (res[resx].type == "audio") {
				// to do
				res[resx].data.oncanplaythrough = function () {
					resVars.resourceReference.downloaded = true;
					resVars.resourcesLeftToDownload--;
					downloadResources();
				}
				res[resx].data.onerror = function () {
					resVars.resourceReference.pathToTry++;
					if (resVars.resourceReference.pathToTry > resVars.resourceReference.paths.length - 1) {
						resVars.resourceReference.failed = true;
						resVars.failedResources++;
					}
					console.log("Resource failed to load: " + resVars.resourceReference.paths[resVars.resourceReference.pathToTry]);
					downloadResources();
				}
				resVars.resourceReference = res[resx];
				res[resx].data.crossOrigin = "anonymous";
				res[resx].data.preload = "auto";
				res[resx].data.src = res[resx].paths[res[resx].pathToTry];
				break;
			}
			break;
		}
		else if (resVars.resourcesLeftToDownload == 0) downloadDone = true;
	}
}
////////////// Sprite Factory
sprites = {}; // The final, usable sprites
spritesQueue = []; // Store the data, so that it can be processed after the images are actually loaded. Elements from this queue are removed after they are used.
function sprite(id, image, json, alias, numberOfFrames) { // Generates a set of frames into a sprite. "image" MUST be done downloading to call this.
	spritesQueue.push([id, image, json, alias, numberOfFrames]);
}
function processSprites() { // Call when the Queue is full
	var id, image, son, alias, numberOfFrames;
	for (var n = spritesQueue.length - 1; n >= 0; n--) {
		id = spritesQueue[n][0];
		image = spritesQueue[n][1];
		json = spritesQueue[n][2];
		alias = spritesQueue[n][3];
		numberOfFrames = spritesQueue[n][4];

		// Creates a sprite from the JSON information
		if (numberOfFrames == 1) {
			sprites[id] = createSpriteTemplate(alias, json);
			sprites[id].data = trimImage(image,
				json.frames[alias]["frame"]["x"],
				json.frames[alias]["frame"]["y"],
				json.frames[alias]["frame"]["w"],
				json.frames[alias]["frame"]["h"])
		} else {
			sprites[id] = new Array(numberOfFrames);
			for (var i = 0; i < numberOfFrames; i++) {
				sprites[id][i] = createSpriteTemplate(alias + "_" + i, json);
				sprites[id][i].data = trimImage(image,
					json.frames[alias + "_" + i]["frame"]["x"],
					json.frames[alias + "_" + i]["frame"]["y"],
					json.frames[alias + "_" + i]["frame"]["w"],
					json.frames[alias + "_" + i]["frame"]["h"])
			}
		}
		spritesQueue.pop();
	}
}
function trimImage(image, x, y, width, height) { // Cuts out an image from a larger image and returns the cut image. (Does not change original image)
	var tempCanvas = document.createElement("canvas");
	var tempCtx;
	tempCanvas.width = width;
	tempCanvas.height = height;
	tempCtx = tempCanvas.getContext("2d");
	tempCtx.drawImage(image, x, y, width, height, 0, 0, width, height);
	var tempImg = new Image();
	tempImg.src = tempCanvas.toDataURL(); // Canvas -> Image. Slight performance boost on some systems
	return tempImg;
}
function createSpriteTemplate(alias, json) { // Just to make sprite() cleaner, do not use otherwise. Unless you want to. I'm just a comment
	return {
		x: json.frames[alias]["spriteSourceSize"]["x"], // Gets info from the JSON file exported from Texture Packer
		y: json.frames[alias]["spriteSourceSize"]["y"],
		width: json.frames[alias]["frame"]["w"],
		height: json.frames[alias]["frame"]["h"],
		fullWidth: json.frames[alias]["sourceSize"]["w"],
		fullHeight: json.frames[alias]["sourceSize"]["h"],
		data: null
	}
}



///////////// Controllers ================================================================================
// The keyboard half of this code is kinda messy and could definitely be improved.
// If you make any improvements please contact me efehq.com (latest contact info on the bottom of the page)
keys = {
	enter: false,
	shift: false,
	ctrl: false,
	alt: false,
	up: false,
	down: false,
	left: false,
	right: false
}
keyCodeList = {
	enter: 13,
	shift: 16,
	ctrl: 17,
	alt: 18,
	up: 38,
	down: 40,
	left: 37,
	right: 39
}
alphabet = "abcdefghijklmnopqrstuvwxyz"; // Defined as global in case other code needs it
populateKeys(); // Adds the alphabet and numbers to the "keys" object
function populateKeys() {
	for (var i = 0; i < alphabet.length; i++) {
		keys[alphabet.substring(i, i + 1)] = false;
	}
	for (var i = 0; i < 10; i++) {
		keys["num" + i] = false; // Set when either numpad or number row keys are pushed
	}
}
window.addEventListener("keydown", function (e) { // For all the special keys (shift, ctrl, etc)
	keySetter(e, true);
})
window.addEventListener("keypress", function (e) { // For all the text/number keys
	var letter = e.key || String.fromCharCode(e.keyCode).toLowerCase(); // Gets key as string
	if (!isNaN(parseInt(letter, 10))) keys["num" + letter] = true; // Checks for number
	for (var i = 0; i < alphabet.length; i++) { // Checks alphabet
		if (letter == alphabet.substring(i, i + 1)) {
			keys[letter] = true;
			break;
		}
	}
})

window.addEventListener("keyup", function (e) { // For all keys
	keySetter(e, false);
	var letter = e.key || String.fromCharCode(e.keyCode).toLowerCase();
	for (var i = 0; i < alphabet.length; i++) {
		if (letter == alphabet.substring(i, i + 1)) {
			keys[letter] = false;
			break;
		}
	}

	if (!isNaN(parseInt(letter, 10))) keys["num" + letter] = false;
	else if (!isNaN(parseInt(String.fromCharCode(e.keyCode - 48), 10))) keys["num" + String.fromCharCode(e.keyCode - 48)] = false; // The numpad should give you keycodes that are 48 off. This checks for that
})
function keySetter(e, value) { // Checks special keys, used by multiple functions above
	if (value) value = performance.now(); // This way you can tell which button was first
	switch (e.keyCode) {
		case keyCodeList.enter:
		keys.enter = value;
			break;
		case keyCodeList.shift:
		keys.shift = value;
			break;
		case keyCodeList.ctrl:
		keys.ctrl = value;
			break;
		case keyCodeList.alt:
		keys.alt = value;
			break;
		case keyCodeList.up:
		keys.up = value;
			break;
		case keyCodeList.down:
		keys.down = value;
			break;
		case keyCodeList.left:
		keys.left = value;
			break;
		case keyCodeList.right:
		keys.right = value;
			break;
	}
}

//////// Mouse
mouse = {
	x: 0,
	y: 0,
	leftButton: false,
	middleButton: false,
	rightButton: false,
	pressedAt: {
		x: 0,
		y: 0,
		t: 0 // Time, for things like dragging
	}
}
window.addEventListener("mousemove", function(e) {
	mouse.x = e.pageX;
	mouse.y = e.pageY;
})
window.addEventListener("mousedown", function(e) {
	var btn = e.which - 1 || e.button;
	switch (btn) {
		case 0:
		mouse.leftButton = true;
			break;
		case 1:
		mouse.middleButton = true;
			break;
		case 2:
		mouse.rightButton = true;
			break;
	}
	mouse.pressedAt.t = performance.now();
	mouse.pressedAt.x = e.pageX;
	mouse.pressedAt.y = e.pageY;
})
window.addEventListener("mouseup", function(e) {
	var btn = e.which - 1 || e.button;
	switch (btn) {
		case 0:
		mouse.leftButton = false;
			break;
		case 1:
		mouse.middleButton = false;
			break;
		case 2:
		mouse.rightButton = false;
			break;
	}
})





////////////// Physics =============================================================================
function vector(components) { // components should be an array of at least 2 values
	this.data = components;
	this.derivative = 0; // Can either be set to a vector or zero.
}
vector.prototype.x = function() {return this.data[0];}
vector.prototype.y = function() {return this.data[1];}
vector.prototype.z = function() {return (this.data.length > 2) ? this.data[2] : 0;}
vector.prototype.setX = function(val) {this.data[0] = val;}
vector.prototype.setY = function(val) {this.data[1] = val;}
vector.prototype.setZ = function(val) {if (this.data.length > 2) this.data[2] = val;}
vector.prototype.update = function() {
	if (!this.derivative) {

	}
	else {
		for (var i = 0; i < this.data.length; i++) {
			this.data[i] += this.derivative.data[i];
		}
		this.derivative.update();
	}
}
vector.prototype.getNextPosition = function() {
	var temp = new vector(this.data.slice());
	temp.derivative = derivativeCloner(this);
	temp.update();
	return temp;
}
derivativeCloner = function(vec) {
	if (vec.derivative == 0) return 0;
	else {
		var newVec = new vector(vec.derivative.data);
		newVec.derivative = derivativeCloner(vec.derivative);
		return newVec;
	}
}
vector.prototype.getDistance = function(pointB) {
	return Math.sqrt(this.data[0] * this.data[0] + this.data[1] * this.data[1]);
}

function line(a, b) { // a and b are vector objects
	this.pointA = a;
	this.pointB = b;
}
line.prototype.getMidpoint = function() {
	if (this.pointA.data.length == 2)
		return new vector([
			(this.pointA.data[0] + this.pointB.data[0]) / 2,
			(this.pointA.data[1] + this.pointB.data[1]) / 2
		]);
	else {
		var newVec = new Array(this.pointA.data.length);
		for (var i = 0; i <= newVec.length; i++) {
			newVec[i] = (this.pointA.data[i] + this.pointB.data[i]) / 2;
		}
		return new vector(newVec);
	}
}

function collisionPointToLine(point, line) { // point is a vector, line is a line (of course). If collision, returns collision point, else returns false
	var nextPoint = point.getNextPosition(),
		a1 = line.pointB.y() - line.pointA.y(),
		b1 = line.pointA.x() - line.pointB.x(),
		c1 = a1 * line.pointA.x() + b1 * line.pointA.y(),
		a2 = nextPoint.y() - point.y(),
		b2 = point.x() - nextPoint.x(),
		c2 = a2 * point.x() + b2 * point.y(),
		denominator = a1 * b2 - a2 * b1,
		intersection = new vector([
			(b2 * c1 - b1 * c2) / denominator,
			(a1 * c2 - a2 * c1) / denominator
		]);
	// To do: add checks for line segments, etc.
	return intersection;
}
function collisionPointToHorizontal(movingPoint, staticPoint1, staticPoint2) {
	var	nextPoint = movingPoint.getNextPosition(),
		lineDist = staticPoint1.y() - movingPoint.y(),
		pointDist = nextPoint.y() - movingPoint.y();
	if (Math.abs(lineDist) < Math.abs(pointDist)) {
		if (inRange(movingPoint.x(), staticPoint1.x(), staticPoint2.x())) {
			var ret = new vector(movingPoint.data.slice());
			ret.data[1] = staticPoint1.y() - pointDist - 1;
			ret.data[0] += pointDist / (nextPoint.y() - movingPoint.y()) * (nextPoint.x() - movingPoint.x());
			ret.derivative = derivativeCloner(movingPoint);
			return ret;
		}
		return false;
	}
	else return false;
}
function collisionHorizontalToHorizontal(movingPoint1, movingPoint2, staticPoint1, staticPoint2) {
	var c1 = collisionPointToHorizontal(movingPoint1, staticPoint1, staticPoint2),
		c2 = collisionPointToHorizontal(movingPoint2, staticPoint1, staticPoint2)
	if (c1 || c2) {
		return c1;
	}
}





////////////// Debug ==================================================================================
dbg_fpsQueue = new Array(120);
dbg_lastRecordedFps = 0;
for (var i = 0; i < dbg_fpsQueue.length; i++) {
	dbg_fpsQueue[i] = 16;
}
function dbg_recordFpsFrame() {
	dbg_fpsQueue.push(performance.now() - dbg_lastRecordedFps);
	dbg_fpsQueue.shift();
	dbg_lastRecordedFps = performance.now();
}
function dbg_calcFps() {
	var sum = 0;
	for (var i = 0; i < dbg_fpsQueue.length; i++) {
		sum += (1000 / dbg_fpsQueue[i]);
	}
	return Math.floor(sum / dbg_fpsQueue.length);
}

///////////// Graphics ===============================================================================
canvas = ctx = null;





///////////// UI Code ================================================================================
uiTheme = {
    loader: {
        background: "#B50E35",
        backgroundShade: "#510617" // 510617
    }
};
loaderUI = {
    init: function() {

    },
    update: function() {

    },
    draw: function() {
        var gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.4, 0, canvas.width / 2, canvas.height / 2, canvas.width * 0.55);
        gradient.addColorStop(0, uiTheme.loader.background);
        gradient.addColorStop(1, uiTheme.loader.backgroundShade);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    cleanUp: function() {

    },
};



////////////// DOM Helpers ======================================================================
viewportLastResize = 0;
viewportPendingResize = false;
window.actualWidth = function() {
	return Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
}
window.actualHeight = function() {
	return Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
}
HTMLElement.prototype.dockToViewport = function() {
	this.style.position = "fixed";
	this.style.top = "0";
	this.style.left = "0";
	this.style.height = "100vh";
	this.style.width = "100vw";
}
HTMLCanvasElement.prototype.dockToViewport = function() {
	this.style.position = "fixed";
	this.style.top = "0";
	this.style.left = "0";
	this.sizeToViewport();
	var that = this;
	viewportLastResize = Date.now();
	window.addEventListener("resize", function() {
		if (!viewportPendingResize) {
			dockToViewportHelper(that);
			console.log("Hello");
			viewportPendingResize = true;
		}
	})
}
function dockToViewportHelper(ref) {
	queueFunctionBefore(function() {
		if (Date.now() - viewportLastResize > 160) {
			ref.sizeToViewport();
			viewportLastResize = Date.now();
			viewportPendingResize = false;
		}
		else {
			queueFunctionAfter(function() {
				dockToViewportHelper(ref);
			});
		}
	});
}
HTMLElement.prototype.sizeToViewport = function() {
	this.style.height = window.actualHeight() + "px";
	this.style.width = window.actualWidth() + "px";
}
HTMLCanvasElement.prototype.sizeToViewport = function() {
	this.style.height = window.actualHeight() + "px";
	this.style.width = window.actualWidth() + "px";
	this.setAttribute("height", window.actualHeight());
	this.setAttribute("width", window.actualWidth());
}





///////////// Utils =============================================================================
function inRange(n, min, max) { // Checks if 'n' is between 'min' and 'max'
	var _min = Math.min(min, max),
		_max = Math.max(min, max);
	if (n >= min && n <= max) return true;
	return false;
}


///////////// User code =============================================================================================

scene("_loader", {
	init: function() {
		//downloadResources();
	},
	update: function() {
		//console.log("load update");
		//if (downloadDone) 
			setScene("intro");
		//else {
		//	console.log("Not done yet");
		//}
	},
	draw: function() {
	},
	cleanUp: function() {
		//processSprites();
	}
});

scene("intro", {
	init: function() {
		canvas.dockToViewport();
		centerViewport();
		var cube = new model();
		createCube(cube, 100, 0, 0, 0);
		models.push(cube);
		models[0].rotate(0, 30, 0);
		models[0].applyRotation();
	},
	update: function() {
		
	},
	draw: function() {
		ctx.fillStyle = "#fff";


		ctx.fillRect(-window.actualWidth() / 2, -window.actualHeight() / 2, window.actualWidth(), window.actualHeight());
		drawModels();


		keyholder = document.getElementById("keyholder");
		var newText = "FPS: " + dbg_calcFps() + "<br/>Keys: ";
		for (var k in keys) {
			if (keys[k]) newText += k;
		}
		if (keyholder.innerHTML != newText) keyholder.innerHTML = newText;
	}
});
function init() {
	startEngine(pipeline, "scene");
	requestAnimationFrame(pipeline);
}

///////////// 3D Renderer
models = [];
focalLength = 300;
point = function(_x, _y, _z) {
	this.x = _x;
	this.y = _y;
	this.z = _z;
	this.screenX = this.screenY = 0;
	this.modX = _x;
	this.modY = _y;
	this.modZ = _y;
	this.pitch = 0;
	this.yaw = 0;
	this.roll = 0;
}
point.prototype.calcScreenCoords = function() {
	this.screenX = this.x * (focalLength) / (focalLength + this.z);
	this.screenY = this.y * (focalLength) / (focalLength + this.z);
}
point.prototype.
triangle = function(_a, _b, _c) {
	this.a = _a;
	this.b = _b;
	this.c = _c;
}
triangle.prototype.calcScreenCoords = function() {
	this.a.calcScreenCoords();
	this.b.calcScreenCoords();
	this.c.calcScreenCoords();
}
triangle.prototype.draw = function() {
	this.calcScreenCoords();
	ctx.strokeStyle = "#000";
	ctx.beginPath();
	ctx.moveTo(this.a.screenX, this.a.screenY);
	ctx.lineTo(this.b.screenX, this.b.screenY);
	ctx.lineTo(this.c.screenX, this.c.screenY);
	ctx.closePath();
	ctx.stroke();
}
model = function() {
	this.shapes = [];
	this.x = this.y = this.z = 0;
	this.pitch = this.yaw = this.roll = 0;
}
model.prototype.draw = function() {
	for (var i = 0; i < this.shapes.length; i++) {
		this.shapes[i].draw();
	}
}
model.prototype.rotate = function(pitch, yaw, roll) {
	this.pitch = pitch;
	this.yaw = yaw;
	this.roll = roll;
}
model.prototype.applyRotation = function() {
	for (var i = 0; i < this.shapes.length; i++) {
		var mag = calcMagnitude(this.shapes[i].a.x, this.shapes[i].a.y);
		var theta = calcAngle(this.shapes[i].a.x, this.shapes[i].a.y);
		var np = getRotatedPoint()
		console.log(this.shapes[i].a.x + " " + mag + " - " + theta + " deg");
	}
}
function calcMagnitude(x, y) {
	return Math.sqrt((x * x) + (y * y));
}
function calcAngle(x, y) {
	return Math.atan2(x, y);
}
function getRotatedPoint(point, pitch, yaw, roll) {

}
function createCube(model, size, x, y, x) {
	var topBackLeft      = new point(-size / 2,  size / 2, -size / 2);
	var topBackRight     = new point( size / 2,  size / 2, -size / 2);
	var topFrontLeft     = new point(-size / 2,  size / 2,  size / 2);
	var topFrontRight    = new point( size / 2,  size / 2,  size / 2);

	var bottomBackLeft   = new point(-size / 2,  -size / 2, -size / 2);
	var bottomBackRight  = new point( size / 2,  -size / 2, -size / 2);
	var bottomFrontLeft  = new point(-size / 2,  -size / 2,  size / 2);
	var bottomFrontRight = new point( size / 2,  -size / 2,  size / 2);

	// Top face
	model.shapes.push(new triangle(topBackLeft, topBackRight, topFrontLeft));
	model.shapes.push(new triangle(topFrontRight, topBackRight, topFrontLeft));
	// Bottom face
	model.shapes.push(new triangle(bottomBackLeft, bottomBackRight, bottomFrontLeft));
	model.shapes.push(new triangle(bottomFrontRight, bottomBackRight, bottomFrontLeft));
	// Left face
	model.shapes.push(new triangle(topBackLeft, topFrontLeft, bottomBackLeft));
	model.shapes.push(new triangle(bottomFrontLeft, topFrontLeft, bottomBackLeft));
	// Right face
	model.shapes.push(new triangle(topBackRight, topFrontRight, bottomBackRight));
	model.shapes.push(new triangle(bottomFrontRight, topFrontRight, bottomBackRight));
	// Back face
	model.shapes.push(new triangle(topBackLeft, topBackRight, bottomBackLeft));
	model.shapes.push(new triangle(bottomBackRight, topBackRight, bottomBackLeft));
	// Front face
	model.shapes.push(new triangle(topFrontLeft, topFrontRight, bottomFrontLeft));
	model.shapes.push(new triangle(bottomFrontRight, topFrontRight, bottomFrontLeft));
}
function drawModels() {
	for (var i = 0; i < models.length; i++) {
		models[i].draw();
	}
}
function centerViewport() {
	ctx.translate(window.actualWidth() / 2, window.actualHeight() / 2);
}