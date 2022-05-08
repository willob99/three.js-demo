/*
* This demo web app loads a model from a glTF file, renders it, then sends a
* JPEG image of the render back to the server. It then replaces the image with
* a grayscale image that gives the depth information for the model. It also
* sends the depth image to the server.
*
* The scene and the code to load and render the model are adapted from this
* Three.js demo: 
* https://github.com/mrdoob/three.js/blob/master/examples/webgl_loader_gltf.html
* The code to display the depth information (anything labeled "for depth 
* info") is adapted from this Three.js demo:
* https://github.com/mrdoob/three.js/blob/master/examples/webgl_depth_texture.html
* I simplified and modified both demos to fit this use case.
* The code to save the outputs as images and send them to the server is my 
* own.
*/

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

let camera, scene, renderer;

// For depth info
let target;
let postScene, postCamera, postMaterial;

init();

function init() {
    const container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.25, 20 );
    camera.position.set( - 1.8, 0.6, 2.7 );

    // for depth
    setupRenderTarget();
    setupPost();

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer( { 
        antialias: true,
        preserveDrawingBuffer: true
    } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild( renderer.domElement );

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.target.set( 0, 0, - 0.2 );
    controls.update();

    new RGBELoader()
        .setPath( 'textures/equirectangular/' )
        .load( 'royal_esplanade_1k.hdr', function ( texture ) {

            texture.mapping = THREE.EquirectangularReflectionMapping;

            scene.background = texture;
            scene.environment = texture;

            // Load the model.
            const loader = new GLTFLoader();
            loader.load( 'models/DamagedHelmet/DamagedHelmet.gltf', function ( gltf ) {
                scene.add( gltf.scene );
                renderer.render( scene, camera );

                // Following written by Will
                // Return rendered image to server.
                sendFrameToServer("image");

                // Replace image with depth output.
                animate();
                sendFrameToServer("depth");
            } );
        } ); 
}

// For depth info
function setupRenderTarget() {
    if (target) target.dispose();

    const format = THREE.DepthFormat;
    const type = THREE.UnsignedShortType;

    target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.depthTexture = new THREE.DepthTexture();
    target.depthTexture.format = format;
    target.depthTexture.type = type;
}

// For depth info
function setupPost() {
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postMaterial = new THREE.ShaderMaterial({
        vertexShader: document.querySelector( '#post-vert').textContent.trim(),
        fragmentShader: document.querySelector( '#post-frag' ).textContent.trim(),
        uniforms: {
            cameraNear: { value: camera.near },
            cameraFar: { value: camera.far },
            tDiffuse: { value: null },
            tDepth: { value: null}
        }
    });
    const postPlane = new THREE.PlaneGeometry(2, 2);
    const postQuad = new THREE.Mesh(postPlane, postMaterial);
    postScene = new THREE.Scene();
    postScene.add(postQuad);
}

// For depth info
function animate() {
    requestAnimationFrame( animate );

    // render scene into target
    renderer.setRenderTarget( target );
    renderer.render( scene, camera );

    // render post FX
    postMaterial.uniforms.tDiffuse.value = target.texture;
    postMaterial.uniforms.tDepth.value = target.depthTexture;

    renderer.setRenderTarget( null );
    renderer.render( postScene, postCamera );
}

// Written by Will
function sendFrameToServer(imageOrDepth) {
    var imgData;
    try {
        imgData = renderer.domElement.toDataURL("image/jpeg", 1);

        fetch('http://192.168.1.175:8000/return/' + imageOrDepth, {
            method: 'POST',
            headers: {
                'Content-Type': 'image/jpeg',
                'Content-Length': imgData.length
            },
            body: imgData
        })
        .then(result => {
        console.log('Success:', result);
        })
        .catch(error => {
        console.error('Error:', error);
        });

    } catch (e) {
        console.log(e);
        return;
    }
}
