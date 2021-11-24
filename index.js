import * as THREE from 'https://cdn.skypack.dev/three@0.134.0/build/three.module.js';
import {
  OrbitControls
} from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/OrbitControls.js';
import {
  MarchingCubes
} from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/objects/MarchingCubes.js';
import {
  GUI
} from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/libs/dat.gui.module.js';
import Stats from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/libs/stats.module.js';
let stats;

let analyser, renderer, scene, camera, controls;
let light, pointLight, ambientLight;
let material;
let metaBall_material;
let _cube, cube;
let effect, resolution;
let effectController;
let currentFFTsize = document.getElementById('numFFT');

let audioLoader, sound, data;
let time = 0;
let fftSize = 32;
const clock = new THREE.Clock();

const startButton = document.getElementById('startButton');
startButton.addEventListener('click', init);
//init();

function init() {
  const overlay = document.getElementById('overlay');
  overlay.remove();

  //SCENE
  scene = new THREE.Scene();

  //AXES

  var axisMin = -5;
  var axisMax = 5;
  var axisRange = axisMax - axisMin;

  scene.add(new THREE.AxesHelper(axisMax));

  //CAMERA
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(90, 5, 90);
  camera.lookAt(scene.position);


  // LIGHTS
  light = new THREE.DirectionalLight(0xffffff);
  light.position.set(0.5, 0.5, 1);
  scene.add(light);

  pointLight = new THREE.PointLight(0xff3300);
  pointLight.position.set(0, 0, 100);
  scene.add(pointLight);

  ambientLight = new THREE.AmbientLight(0x080808);
  scene.add(ambientLight);




  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // CONTROLS
  controls = new OrbitControls(camera, renderer.domElement);

  // MATERIAL for the cube

  material = new THREE.MeshPhongMaterial({
    color: 0xFF0000, // red (can also use a CSS color string here)
    flatShading: true,
  });

  // CUBE
  const _cube = new THREE.BoxGeometry();
  cube = new THREE.Mesh(_cube, material);
  scene.add(cube);

  // MATERIAL for the metaballs

  // MARCHING CUBES
  metaBall_material = new THREE.MeshPhongMaterial({
    color: 0x0000FF, // red (can also use a CSS color string here)
    flatShading: true,
  });

  resolution = 60;

  effect = new MarchingCubes(resolution, metaBall_material, true, true, 100000);
  effect.position.set(0, 0, 0);
  effect.scale.set(100, 100, 100);

  effect.enableUvs = false;
  effect.enableColors = false;

  scene.add(effect);



  // GUI

  setupGui();

  //stats
			stats = new Stats();
			document.body.appendChild( stats.dom );

  //create an AudioListener and add it to the camera
  const listener = new THREE.AudioListener();
  camera.add(listener);

  //AUDIO
  // create an Audio source
  sound = new THREE.Audio(listener);

  // load a sound and set it as the Audio object's buffer
  audioLoader = new THREE.AudioLoader();
  audioLoader.load('sounds/moogify.mp3', function(buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.5);
    sound.play();
  });

  // create an AudioAnalyser, passing in the sound and desired fftSize
  //Must be a power of 2 between 2^5 and 2^15
  //The FFT size defines the number of bins used for dividing the window into equal strips, or bins. Hence, a bin is a spectrum sample, and defines the frequency resolution of the window.
  //N = fftSize/2, 128 fft size will give us 64 bins
  analyser = new THREE.AudioAnalyser(sound, effectController.numBlobs * 2);


  window.addEventListener('resize', onWindowResize);
  animate();
}


function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  render();
  	stats.update();
}


function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupGui() {
  const createHandler = function(id) {

    return function() {

      current_material = id;

      //effect.material = materials[ id ];
      effect.material = material;
      effect.enableUvs = (current_material === 'textured') ? true : false;
      effect.enableColors = (current_material === 'colors' || current_material === 'multiColors') ? true : false;

    };

  };

  effectController = {

    material: 'shiny',

    speed: 1.0,
    numBlobs: 16,
    resolution: 60,
    isolation: 60,

    floor: false,
    wallx: false,
    wallz: false,

    dummy: function() {}

  };

  let h;

  const gui = new GUI();

  // material (type)

  // h = gui.addFolder( 'Materials' );
  //
  // for ( const m in materials ) {
  //
  // 	effectController[ m ] = createHandler( m );
  // 	h.add( effectController, m ).name( m );
  //
  // }

  // simulation

  //h = gui.addFolder( 'Simulation' );

  gui.add(effectController, 'speed', 0.1, 8.0, 0.05);
  gui.add(effectController, 'numBlobs', {
    '4': 4,
    '8': 8,
    '16': 16,
    '32': 32
  });
  gui.add(effectController, 'resolution', 14, 100, 1);
  gui.add(effectController, 'isolation', 10, 300, 1);

  gui.add(effectController, 'floor');
  gui.add(effectController, 'wallx');
  gui.add(effectController, 'wallz');


}

function render() {
  audioAnalyze();
  const delta = clock.getDelta();
  time += delta * effectController.speed * 0.5;

  // marching cubes

  if (effectController.resolution !== resolution) {

    resolution = effectController.resolution;
    effect.init(Math.floor(resolution));

  }

  if (effectController.isolation !== effect.isolation) {

    effect.isolation = effectController.isolation;

  }

  updateCubes(effect, time, effectController.numBlobs, effectController.floor, effectController.wallx, effectController.wallz);
  renderer.render(scene, camera);
}

function audioAnalyze() {

  // get the average frequency of the sound
  // data = analyser.getAverageFrequency();
  analyser.fftSize = effectController.numBlobs * 8;
  currentFFTsize.innerHTML = "current fft size: " + analyser.fftSize;

  // get the  frequency of the sound
  data = analyser.getFrequencyData();
  //uniforms.tAudioData.value.needsUpdate = true;

}

function updateCubes(object, time, numblobs, floor, wallx, wallz) {

  object.reset();

  // fill the field with some metaballs

  const rainbow = [
    new THREE.Color(0xff0000),
    new THREE.Color(0xff7f00),
    new THREE.Color(0xffff00),
    new THREE.Color(0x00ff00),
    new THREE.Color(0x0000ff),
    new THREE.Color(0x4b0082),
    new THREE.Color(0x9400d3)
  ];
  const subtract = 20;
  const strength = 1.2 / ((Math.sqrt(numblobs) - 1) / 4 + 1);

  for (let i = 0; i < numblobs; i++) {

    const ballx = Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5;
    const bally = Math.abs(Math.cos(i + 1.12 * time * Math.cos(1.22 + 0.1424 * i))) * 0.77; // dip into the floor
    const ballz = Math.cos(i + 1.32 * time * 0.1 * Math.sin((0.92 + 0.53 * i))) * 0.27 + 0.5;

    // if (current_material === 'multiColors') {
    //
    //   object.addBall(ballx, bally, ballz, strength, subtract, rainbow[i % 7]);
    //
    // } else {

    object.addBall(ballx, bally, ballz, strength, subtract / (data[i] / 40));

    // }

  }

  if (floor) object.addPlaneY(2, 12);
  if (wallz) object.addPlaneZ(2, 12);
  if (wallx) object.addPlaneX(2, 12);

  // object.addPlaneY(2, 12);
  // object.addPlaneZ(2, 12);
  // object.addPlaneX(2, 12);

}

//
