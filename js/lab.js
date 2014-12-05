// Three.js vars
var camera, scene, light, renderer, container, projector, mouseVector, spheres, groundContents, groundMesh, wall;
var meshs = [];
var bodys=[];
var joints=[];
var grounds = [];
var selectedMesh, previousSelectedMeshMaterial;
var filterWallBody, filterWall1, filterWall2, filterWall3, filterWall4;
var isMobile = false;
var antialias = true;

var geos = {};
var mats = {};

// Oimo vars
var world = null;
var bodys = [];
var updatePhysicsInterval;

var fps = [0,0,0,0];
var ToRad = Math.PI / 180;
var type=1;
var debugColor = 0x282929;
var debugColor2 = 0x288829;
var debugAlpha = 0.3;

// Collision groups
var spheres_mask = 1 << 0;  // 00000000 00000000 00000000 00000001
var walls_mask = 1 << 2;    // 00000000 00000000 00000000 00000010
var filtered_mask = 1 << 3; // 00000000 00000000 00000000 00001000
var all_mask = 0xffffffff;  // 11111111 11111111 11111111 11111111

// Is all the physics setting for rigidbody
var config = [
    1, // The density of the shape.
    0.4, // The coefficient of friction of the shape.
    0.2, // The coefficient of restitution of the shape.
    1, // The bits of the collision groups to which the shape belongs.
    0xffffffff // The bits of the collision groups with which the shape collides.
];

// Dataset vars
var zipcode = null;
var month = null;
var analysisStarted = false;
var datasets = {
    64700: 'monterrey_tech_dataset',
    44130: 'guadalajara_ccd_dataset',
    '': 'cc_santafe_dataset'
};
var zipcodeAsString = {
    64700: 'Instituto Tecnológico de Monterrey (64700)',
    44130: 'Centro Comercial Guadalajara (44130)'
};
var monthAsString = ['Nov 2013', 'Dic 2013', 'Jan 2014', 'Feb 2014', 'Mar 2014', 'Apr 2014'];
var textureColors = {
    'sph.mx_barsandrestaurants': '#81c16a',
    'sph.mx_services': '#67b0b6',
    'sph.mx_food': '#d66f6c',
    'sph.mx_office': '#c0a0e0',
    'sph.mx_car': '#fa842c',
    'sph.mx_auto':'#fb2d22',
    'sph.mx_travel': '#ebef4e',
    'sph.mx_sport': '#2c66a4',
    'sph.mx_beauty': '#ecc82c',
    'sph.mx_health':'#fffeef'
};
var filterColors = [ '#633', '#363', '#336' ];
var filters = [];

var paymentsPerSphere = 50;
var paymentBucket = 500;
var radioPerPaymentBucket = 20;

var yGapBetweenDays = 250;
var daysOfMonth = [
    30, // 0 -> 11/2013
    31, // 1 -> 12/2013
    31, // 2 -> 01/2014
    28, // 3 -> 02/2014
    31, // 4 -> 03/2014
    30  // 5 -> 04/2014
];
var currentDate = 0;
var inspectorActivated = false, filterActivated = false, showMoreFilterInstructions = false;

function init() {
    var n = navigator.userAgent;
    if (n.match(/Android/i) ||
        n.match(/webOS/i) ||
        n.match(/iPhone/i) ||
        n.match(/iPad/i) ||
        n.match(/iPod/i) ||
        n.match(/BlackBerry/i) ||
        n.match(/Windows Phone/i)) {
        isMobile = true;
        antialias = false;
    }

    // camera
    var cameraFOV = 60;
    var cameraAspectRatio = window.innerWidth / window.innerHeight;
    var cameraNearPlane = 1;
    var cameraFarPlane = 15000;
    camera = new THREE.PerspectiveCamera(cameraFOV, cameraAspectRatio, cameraNearPlane, cameraFarPlane);
    initCamera(0, 70, 2000);
    camera.lookAt( new THREE.Vector3( 0, 0, 0 ) )        

    scene = new THREE.Scene();

    // container objects
    spheres = new THREE.Object3D();
    groundContents = new THREE.Object3D();
    scene.add(spheres);                
    scene.add(groundContents);

    // filter wall objects
    wall = new THREE.Object3D();
    scene.add(wall);
    
    // object picking stuff
    projector = new THREE.Projector();
    raycaster = new THREE.Raycaster();
    
    // renderer
    renderer = new THREE.WebGLRenderer({precision: "mediump", antialias: antialias});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;

    // lights
    if (!isMobile){
        var ambientLight = new THREE.AmbientLight(0x555557);
        light = new THREE.DirectionalLight(0xffffff , 1.3);
        light.position.set( 300, 1000, 500 );
        light.target.position.set( 0, 0, 0 );
        light.castShadow = true;
        light.shadowCameraNear = 500;
        light.shadowCameraFar = 1600;
        light.shadowCameraFov = 70;
        light.shadowBias = 0.0001;
        light.shadowDarkness = 0.7;
        //light.shadowCameraVisible = true;
        light.shadowMapWidth = light.shadowMapHeight = 1024;

        scene.add(ambientLight);
        scene.add( light );
        
        renderer.shadowMapEnabled = true;
        renderer.shadowMapType = THREE.PCFShadowMap;
    }

    // background
    var buffgeoBack = new THREE.BufferGeometry();
    buffgeoBack.fromGeometry( new THREE.IcosahedronGeometry(3000,1));
    var back = new THREE.Mesh(buffgeoBack,
                              new THREE.MeshBasicMaterial( {
                                  map: gradTexture([[0.75,0.6,0.4,0.25], ['#1B1D1E','#3D4143','#72797D', '#b0babf']]),
                                  side: THREE.BackSide,
                                  depthWrite: false,
                                  fog: false }  ));
    back.geometry.applyMatrix(new THREE.Matrix4().makeRotationZ(15*ToRad));
    scene.add(back);

    // geometries
    geos['sphere'] = new THREE.BufferGeometry();
    geos['sphere'].fromGeometry( new THREE.SphereGeometry(1,16,10));
    geos['box'] = new THREE.BufferGeometry();
    geos['box'].fromGeometry( new THREE.BoxGeometry(1,1,1));
    geos['cyl'] = new THREE.BufferGeometry();
    geos['cyl'].fromGeometry( new THREE.CylinderGeometry(1, 1, 1, 20));
    
    // materials
    if(!isMobile){
        mats['sph.mx_barsandrestaurants'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_barsandrestaurants'), name:'sph.mx_barsandrestaurants' } );
        mats['sph.mx_services'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_services'), name:'sph.mx_services' } );
        mats['sph.mx_food'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_food'), name:'sph.mx_food' } );            
	mats['sph.mx_office'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_office'), name:'sph.mx_office' } );            
        mats['sph.mx_car'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_car'), name:'sph.mx_car' } );            
	mats['sph.mx_auto'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_auto'), name:'sph.mx_auto' } );            
	mats['sph.mx_travel'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_travel'), name:'sph.mx_travel' } );            
	mats['sph.mx_sport'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_sport'), name:'sph.mx_sport' } );            
	mats['sph.mx_beauty'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_beauty'), name:'sph.mx_beauty' } );            
	mats['sph.mx_health'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_health'), name:'sph.mx_health' } );            


        mats['box'] = new THREE.MeshPhongMaterial( { map: basicTexture(1), name:'box' } );
        mats['filter'] = new THREE.MeshLambertMaterial( { color: 0x3D4143, transparent: true, opacity: 0.8 } );            
        mats['ground'] = new THREE.MeshBasicMaterial( { color:debugColor, wireframe:true, transparent:true, opacity:0, fog: false, depthTest: false, depthWrite: false});
    } else {
        mats['sph.mx_barsandrestaurants'] = new THREE.MeshBasicMaterial( { map: basicTexture('sph.mx_barsandrestaurants'), name:'sph.mx_barsandrestaurants' } );
        mats['sph.mx_services'] = new THREE.MeshBasicMaterial( { map: basicTexture('sph.mx_services'), name:'sph.mx_services' } );
        mats['sph.mx_food'] = new THREE.MeshBasicMaterial( { map: basicTexture('sph.mx_food'), name:'sph.mx_food' } );            
	mats['sph.mx_office'] = new THREE.MeshBasicMaterial( { map: basicTexture('sph.mx_office'), name:'sph.mx_office' } );    
        mats['sph.mx_car'] = new THREE.MeshBasicMaterial( { map: basicTexture('sph.mx_car'), name:'sph.mx_car' } );            
	mats['sph.mx_auto'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_auto'), name:'sph.mx_auto' } );            
	mats['sph.mx_travel'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_travel'), name:'sph.mx_travel' } );            
        mats['sph.mx_sport'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_sport'), name:'sph.mx_sport' } );            
	mats['sph.mx_beauty'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_beauty'), name:'sph.mx_beauty' } );            
	mats['sph.mx_health'] = new THREE.MeshPhongMaterial( { map: basicTexture('sph.mx_health'), name:'sph.mx_health' } );            
        mats['box'] = new THREE.MeshBasicMaterial( { map: basicTexture(1), name:'box' } );
        mats['filter'] = new THR
        EE.MeshLambertMaterial( { color: 0x3D4143, transparent:true, opacity:0.6 } );            
        mats['ground'] = new THREE.MeshBasicMaterial( { color:debugColor, wireframe:true, transparent:true, opacity:0, fog: false, depthTest: false, depthWrite: false});
    }

    container = document.getElementById("lab");
    container.appendChild( renderer.domElement );

    initEvents();
    initOimoPhysics();
}

function loop() {
    requestAnimationFrame( loop );
    renderer.render( scene, camera );
}

function addStaticBox(size, position, rotation, spec) {
    var mesh;
    if(spec) mesh = new THREE.Mesh( geos.box, mats.filter );
    else mesh = new THREE.Mesh( geos.box, mats.box );
    mesh.scale.set( size[0], size[1], size[2] );
    mesh.position.set( position[0], position[1], position[2] );
    mesh.rotation.set( rotation[0]*ToRad, rotation[1]*ToRad, rotation[2]*ToRad );
    scene.add(mesh);
    grounds.push(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function addGround(size, position, rotation) {
    var mesh = new THREE.Mesh(geos.box, mats.ground);
    mesh.scale.set( size[0], size[1], size[2] );
    mesh.position.set( position[0], position[1], position[2] );
    mesh.rotation.set( rotation[0]*ToRad, rotation[1]*ToRad, rotation[2]*ToRad );

    /*
      var helper = new THREE.BoxHelper(mesh);
      helper.material.color.setHex( debugColor );
      helper.material.opacity = debugAlpha;
      helper.material.transparent = true;
      mesh.add(helper);
    */
    helper2 = new THREE.GridHelper( 0.5, 0.0625 );
    helper2.setColors( debugColor2, debugColor );
    helper2.material.opacity = debugAlpha;
    helper2.material.transparent = true;
    helper2.position.y = 0.5;
    mesh.add(helper2);
    
    scene.add(mesh);
    grounds.push(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function clearMeshes(){
    var i=meshs.length;
    while (i--) spheres.remove(meshs[ i ]);
    i = grounds.length;
    while (i--) scene.remove(grounds[ i ]);
    groundContents.remove(groundMesh);
    bodys = [];
    grounds = [];
    meshs = [];
    joints = [];
}

//----------------------------------
//  OIMO PHYSICS
//----------------------------------

function initOimoPhysics(){

    // world setting:( TimeStep, BroadPhaseType, Iterations )
    // BroadPhaseType can be 
    // 1 : BruteForce
    // 2 : Sweep and prune , the default 
    // 3 : dynamic bounding volume tree

    world = new OIMO.World(1/60, 2, 8);

    addGroundToWorld();

    //populateWorld();    
}

function populateWorld() {
    
    // Reset world
    resetWorld();

    // add ground
    addGroundToWorld();
    
    // add walls
    var wall1 = new OIMO.Body({size:[1100, 5000, 50], pos:[0,2500,525], world:world, config: config});
    var wall2 = new OIMO.Body({size:[1100, 5000, 50], pos:[0,2500,-525], world:world, config: config});               
    var wall3 = new OIMO.Body({size:[50, 5000, 1000], pos:[525,2500,0], world:world, config: config});
    var wall4 = new OIMO.Body({size:[50, 5000, 1000], pos:[-525,2500,0], world:world, config: config});               
    
    // dataset by month
    var dataset = getCurrentDataset();
    var categories = Object.keys(dataset);
    var fromDay = 0;
    var toDay = 0;
    for (var i = 0; i <= month; i++) {
        toDay += daysOfMonth[i];
        if (i > 0) {
            fromDay += daysOfMonth[i - 1];
        }
    }

    // add objects
    var i = 0;
    var x, y, z, w, h, d,p, date;
    for (var day = fromDay; day < toDay; day++)
    {
        date = dataset[categories[0]].stats[day].date;
        y = (day - fromDay + 1) * yGapBetweenDays;

        for (var categoryIdx = 0; categoryIdx < categories.length; categoryIdx++) {
            var category = categories[categoryIdx];
            var cubesByCategoryAndDay = dataset[category].stats[day].cube;
            
            for (var cubeIdx = 0; cubeIdx < cubesByCategoryAndDay.length; cubeIdx++) {
                var cube = cubesByCategoryAndDay[cubeIdx];

                var numBodiesPerCube =
                    Math.floor(cube.num_payments / paymentsPerSphere) +
                    ((cube.num_payments % paymentsPerSphere > 0) ? 1 : 0);
                
                for (var j = 0; j < numBodiesPerCube; j++) {
                    x = -100 + Math.random()*200;
                    z = -100 + Math.random()*200;
		    p = Math.floor(cube.avg / paymentBucket);
                    if (p < 5) {
                        w = (p + 1) * radioPerPaymentBucket;
                    } else {
			w= p* radioPerPaymentBucket / 5;
                    }
                    
                    var numPayments = (((j + 1) * paymentsPerSphere) > cube.num_payments) ?
                        cube.num_payments % paymentsPerSphere :
                        paymentsPerSphere;
                    
                    // Create sphere body and mesh
                    var sphereMetadata = {
                        date: date,
                        category: category,
                        payments: numPayments,
                        avg: cube.avg,
                        gender: cube.hash.substring(0,1),
                        age: cube.hash.substring(2),
                        landed: false
                    };
                    config[3] = spheres_mask;
                    config[4] = all_mask;
                    bodys[i] = new OIMO.Body({name: 'sphere-' + i, type:'sphere', size:[w*0.5], pos:[x,y,z], move:true, sleeping: false, world:world, metadata: sphereMetadata, config: config});
                    meshs[i] = new THREE.Mesh( geos.sphere, mats['sph.' + category]);
                    meshs[i].name = i;
                    meshs[i].userData = sphereMetadata;
                    meshs[i].scale.set( w*0.5, w*0.5, w*0.5 );           
                    meshs[i].castShadow = true;
                    meshs[i].receiveShadow = true;
                    //scene.add(meshs[i++]);
                    spheres.add(meshs[i++]);
                } // bodies                    
            } // cubes                
        } // categories
    } // days

    physicsUpdateInterval = setInterval(updateOimoPhysics, 1000/60);        
}

function resetWorld() {
    turnOffInspector();
    clearInterval(updateOimoPhysics, 1000/60);
    currentDate = 0;
    document.getElementById("dayInfo").innerHTML = null;
    clearMeshes();
    world.clear();    
}

function addGroundToWorld() {
    // add ground    
    config[3] = walls_mask;
    config[4] = all_mask & ~filtered_mask;
    var ground = new OIMO.Body({size:[2000, 100, 1000], pos:[0,-50,0], world:world, config: config});
    groundMesh = addGround([2000, 1, 1000], [0,0,0], [0,0,0]);
    groundContents.add(groundMesh);    
}

function updateOimoPhysics() {
    if (!analysisStarted) return;
    
    world.step();

    if (filterWallBody) {
        filterWallBody.resetPosition(wall.position.x, 75, 0);
    }

    var x, y, z;
    var i = bodys.length;
    var mesh;
    var body; 

    while (i--) {
        body = bodys[i].body;
        mesh = meshs[i];

        mesh.position.copy(body.getPosition());
        mesh.quaternion.copy(body.getQuaternion());

        // landing objects
        if ((mesh.position.y < 100) && (!bodys[i].metadata.landed)) {
            bodys[i].metadata.landed = true;
            if (bodys[i].metadata.date > currentDate) {
                currentDate = bodys[i].metadata.date;
                document.getElementById("dayInfo").innerHTML = "Day " + bodys[i].metadata.date;
                if (currentDate.substring(6) == daysOfMonth[month]) {
                    showTools();
                }
            }
        }
        
        // reset position
        if (mesh.position.y < -100){
            x = -100 + Math.random()*200;
            z = -100 + Math.random()*200;
            y = 100 + Math.random()*1000;
            body.resetPosition(x,y,z);
        }

        // contact test
        /*
          if (world.checkContact('wall', 'sphere-' + i)) {
          console.log("Contact with sphere-" + i);
          joints[joints.length] = new OIMO.Link({body1:'wall', body2:'sphere-'+i, min:0, max:0, collision:false, world:world });       
          }
        */
        
    }
}

function gravity(g){
    nG = -9;
    world.gravity = new OIMO.Vec3(0, nG, 0);
}

//----------------------------------
//  TEXTURES
//----------------------------------

function gradTexture(color) {
    var c = document.createElement("canvas");
    var ct = c.getContext("2d");
    c.width = 16; c.height = 128;
    var gradient = ct.createLinearGradient(0,0,0,128);
    var i = color[0].length;
    while(i--){ gradient.addColorStop(color[0][i],color[1][i]); }
    ct.fillStyle = gradient;
    ct.fillRect(0,0,16,128);
    var texture = new THREE.Texture(c);
    texture.needsUpdate = true;
    return texture;
}

function basicTexture(texture){
    var canvas = document.createElement( 'canvas' );
    canvas.width = canvas.height = 64;
    var ctx = canvas.getContext( '2d' );
    var color = textureColors[texture];

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(0,0,0,0.2);";//colors[1];
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);
    var tx = new THREE.Texture(canvas);
    tx.needsUpdate = true;
    return tx;
}

// Raycast Test
var rayTest = function () {
    if (inspectorActivated && mouse.down) {
        var vector = new THREE.Vector3( mouse.mx, mouse.my, 1 );
        projector.unprojectVector( vector, camera );
        raycaster.set( camera.position, vector.sub(camera.position).normalize());
        var intersects = raycaster.intersectObjects(spheres.children, true);
        if (intersects.length > 0) {
            if (selectedMesh) {
                selectedMesh.material = previousSelectedMeshMaterial;
            }
            selectedMesh = intersects[0].object;
            var selectedBody = bodys[selectedMesh.name].body;
            var metadata = selectedMesh.userData;
            document.querySelector("#inspectorInfo .content").innerHTML =
                "<dl><dt>Date</dt><dd>" + metadata.date + "</dd>" +
                "<dt>Category</dt><dd>" + metadata.category + "</dd>" +
                "<dt>Num. payments</dt><dd>" + metadata.payments + "</dd>" +
                "<dt>Avg. payment</dt><dd>" + metadata.avg + "</dd>" +
                "<dt>Gender</dt><dd>" + genderAsString(metadata.gender) + "</dd>" +
                "<dt>Age</dt><dd>" + ageAsString(metadata.age) + "</dd></dl>";
            //selectedBody.resetPosition(selectedBody.position.x, 200, selectedBody.position.z);
            previousSelectedMeshMaterial = selectedMesh.material;
            selectedMesh.material = selectedMesh.material.clone();
            selectedMesh.material.color.setRGB(.5,0,0);
        }        
    }
    if (filterActivated) {
        var vector = new THREE.Vector3( mouse.mx, mouse.my, 1 );
        projector.unprojectVector( vector, camera );
        raycaster.set( camera.position, vector.sub( camera.position ).normalize() );
        var intersects = raycaster.intersectObjects(groundContents.children);
        if ( intersects.length) {
            wall.position.copy( intersects[0].point );
        }            
    }
}

// UI Controls

function getCurrentDataset() {
    return eval(datasets[zipcode]);;
}

function toggleInspector() {
    inspectorActivated = !inspectorActivated;
    if (inspectorActivated) {
        document.getElementById("inspectorBtn").className = "activated";
        document.getElementById("inspectorInfo").className = "shown";        
    } else {
        document.getElementById("inspectorInfo").className = "";        
        document.querySelector("#inspectorInfo .content").innerHTML = "";        
        document.getElementById("inspectorBtn").className = "";
        if (selectedMesh) {
            selectedMesh.material = previousSelectedMeshMaterial;
        }
    }
}

function turnOffInspector() {
    if (inspectorActivated) {
        toggleInspector();
    }
}

function toggleFiltersInfo() {
    filterActivated = !filterActivated;
    if (filterActivated) {
        document.getElementById("filterBtn").className = "activated";
        document.getElementById("filtersInfo").className = "shown";        
    } else {
        document.getElementById("filtersInfo").className = "";        
        document.querySelector("#filtersInfo .content").innerHTML = "";        
        document.getElementById("filterBtn").className = "";
    }


    /*
    if (filterActivated) {
        config[3] = filtered_mask;
        config[4] = all_mask;
        wall.position.x=-550;        
        filterWallBody = new OIMO.Body({name: 'wall', size:[20, 150, 1000], pos:[-550,75,0], rot:[0,0,0], world:world, move: false, config:config});
        bodys[bodys.length] = filterWallBody;
        meshs[meshs.length] = addStaticBox([20, 150, 1000], [-550,75,0], [0,0,0], true);

        var i = bodys.length;
        var body;
        while (i--) {
            body = bodys[i];
            if (body.metadata && body.metadata.category == 'mx_barsandrestaurants') {
                body.body.shapes.belongsTo = filtered_mask;
                joints[joints.length] = new OIMO.Link({
                    type: 'jointBall',
                    body1:'wall',
                    body2:'sphere-'+i,
                    pos1: [0, 0, body.getPosition().z],
                    pos2: [0, 0, 0],
                    min:0,
                    max:100,
                    collision:true,
                    world:world });
            }
        }        
        document.getElementById("filterBtn").className = "activated";
    }
    */
}

function turnOffFiltersInfo() {
    if (filtersActivated) {
        toggleFiltersInfo();
    }
}

function toggleMoreFilterInstructions() {
    showMoreFilterInstructions = !showMoreFilterInstructions;
    if (showMoreFilterInstructions) {
        document.getElementById("moreFilterInstructions").className = 'shown';
        document.querySelector("#filtersInfo .showMore").innerHTML = 'hide instructions';
    } else {
        document.getElementById("moreFilterInstructions").className = '';
        document.querySelector("#filtersInfo .showMore").innerHTML = 'show instructions';
    }
}

function addFilter() {
    var filterName = document.getElementById("newFilterName").value;
    var filterExpression = document.getElementById("newFilterExpression").value;
    if (validateFilterData(filterName, filterExpression)) {        
        filters.push(createNewFilter(filterName, filterExpression));
        clearNewFilterForm();
        addLastFilterInfo();
    } else {
        alert("Oops, filter creation error!");
    }
}

function addLastFilterInfo() {
    addFilterInfo(filters[filters.length - 1]);
}

function addFilterInfo(filter) {
    var filtersContent = document.querySelector("#filtersInfo .content");
    filtersContent.innerHTML += '<div id="filter-' + filter.position + '" class="filter" style="border-color: ' + filter.color + '">' +
        '<div class="filter-header" style="background-color: ' + filter.color + '">' + filter.name + '</div>' +
        '<div class="filter-contents">' +
        '<div class="code">' + filter.expression + '</div>' +
        '<a href="#" onclick="removeFilter(' + filter.position + ')"><span class="icon-remove"></span></a>' +
        '<a id="moveFilter-' + filter.position + '" href="#" onclick="moveFilter(' + filter.position + ')"><span class="icon-target"></span></a>' +        
        '<a id="toggleFilter-' + filter.position + '" href="#" onclick="toogleFilter(' + filter.position + ')"><span class="icon-checkbox-unchecked"></span></a>' +
        '</div>' +
        '</div>';
}

function removeFilter(filterIndex) {
    if (confirm("Are you sure you want to remove this force field?")) {
        filters.splice(filterIndex, 1);
        var filterElement = document.getElementById("filter-" + filterIndex);
        filterElement.parentNode.removeChild(filterElement);
    }
}

function clearNewFilterForm() {
    document.getElementById("newFilterName").value = '';
    document.getElementById("newFilterExpression").value = '';
}

function validateFilterData(name, expression) {
    var isValid = false;
    if (name && expression) {
        // TODO: check only supported data variables and operators are used
        isValid = true;
    }
    return isValid;
}

function createNewFilter(name, expression) {
    var filter = {
        name: name,
        expression: expression,
        position: filters.length,
        color: filterColors[filters.length],
        matchData: function(data) {
            return true;
        }
    };
    return filter;
}

function genderAsString(gender) {
    var genders = {
        'M': 'Male',
        'F': 'Female',
        'E': 'Enterprise',
        'U': 'Unknown'
    };
    return genders[gender];
}

function ageAsString(age) {
    var ages = {
        '0': '<= 18',
        '1': '19 - 25',
        '2': '26 - 35',
        '3': '36 - 45',
        '4': '46 - 55',
        '5': '56 - 65',
        '6': '> 66',
        'U': 'unknown'
    };
    return ages[age];    
}

function selectZipcode() {
    var select = document.getElementById('zipcodeSelect');
    if (select.value != '') {
        zipcode = select.value;
        showPeriodControl();
        deactivateCurrentPeriodButton();
        hideTools();
        hideInfo();
    } else {
        zipcode = null;
        month = null;
        hideControls();
    }
}

function selectPeriod(period) {
    deactivateCurrentPeriodButton();
    month = period;
    activatePeriodButton(period);
    showInfo();
    if (analysisStarted) {
        populateWorld();
        hideTools();
    }
}

function showPeriodControl() {
    var control = document.getElementById('choose-period');
    if (control.className !== 'show') {
        control.className = 'show';
    }
}

function hidePeriodControl() {
    document.getElementById('choose-period').className = '';
    deactivateCurrentPeriodButton();
}

function activatePeriodButton(period) {
    var btn = document.getElementById('button-period-' + period);
    btn.className = 'activated';
}

function deactivateCurrentPeriodButton() {
    var activatedBtn = document.querySelectorAll("#choose-period input.activated");
    if (activatedBtn && activatedBtn.length > 0) {
        activatedBtn[0].className = null;
    }
}

function showInfo() {
    document.getElementById("monthInfo").innerHTML = monthAsString[month];
    document.getElementById("zipcodeInfo").innerHTML = zipcodeAsString[zipcode];
    document.getElementById("info").className = 'activated';    
}

function hideInfo() {
    document.getElementById("info").className = null;    
}

function hideControls() {
    resetWorld();
    hideTools();    
    hideInfo();    
    hidePeriodControl();
}

function toggleAnalysis() {
    if (analysisStarted) {
        document.getElementById('pause-button').style.display = 'none';
        document.getElementById('start-button').style.display = 'block';
    } else {
        if (bodys.length == 0) {
            populateWorld();
        }
        document.getElementById('start-button').style.display = 'none';
        document.getElementById('pause-button').style.display = 'block';        
    }
    analysisStarted = !analysisStarted;    
}

function showTools() {
    document.getElementById("tools").className = 'shown';
}

function hideTools() {
    document.getElementById("tools").className = '';
    turnOffInspector();
    turnOffFiltersInfo();    
}

init();
loop();
