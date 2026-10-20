////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Constants
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var GAME_CONFIG = Object.freeze({ 
    // Lane and buttons settings
    laneColors: [0x00ff00, 0xff0000, 0xffff00, 0x0000ff],
    lanePositions: [-1.5, -0.5, 0.5, 1.5],
    laneKeys: ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],
    hitZoneZ: 2,
    hitWindow: 1.5,
    missedNoteZ: 2.5,
    darkButtonColor: 0x111111,

    // Note settings
    noteStartZ: -30,
    missedNoteColor: 0x333333,

    // Song and audio settings
    defaultSongName: 'Seven_Nation_Army',
    initialNoteSpeed: 10,
    audioVolume: 0.5,
    noteMapDirectory: 'songs/notemaps/',
    audioDirectory: 'songs/source/',
    noteMapExtension: '.js',
    audioExtension: '.mp3',

    // Lighting settings
    holdLightIntensity: 4,
    missLightDuration: 0.6,
    missLightIntensity: 6,

    // Background and textures
    trackTexturePath: 'images/guitar_neck.jpg',
    backgroundVideoPath: 'https://github.com/M4GPIe/proyecto_GPC/releases/download/video/fondo.mp4',
    containerId: 'container',
    backgroundVideoId: 'background-video',
    pauseOverlayId: 'pause-overlay',
    
    // Game states
    gameStates: {
        start: 'START',
        playing: 'PLAYING',
        paused: 'PAUSED',
        finished: 'FINISHED'
    },

    // Labels for GUI elements and messages
    labels: {
        startTitle: 'BASS HERO!',
        startButton: '¡EMPEZAR JUEGO! [ESPACIO]',
        songTitle: 'Canción Seleccionada',
        songName: 'Nombre',
        speed: 'Velocidad',
        songDuration: 'Duración',
        scoreTitle: 'Marcador',
        hits: 'Aciertos',
        misses: 'Fallos',
        pause: 'Pausar [ESPACIO]',
        restart: 'Reiniciar [DELETE]',
        finishedTitle: '¡Canción Finalizada!',
        totalHits: 'Aciertos Totales',
        totalMisses: 'Fallos Totales',
        accuracy: 'Precisión',
        replay: 'Volver a Jugar [ESPACIO]'
    }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Global Variables
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

// Three.js objects
var renderer;
var scene;
var camera;

// Game state
var gameState = GAME_CONFIG.gameStates.start;
var isPaused = true;

// Song and notes
var activeSongName = GAME_CONFIG.defaultSongName;
var activeSong = null;
var activeSongDuration = '0:00';

var noteSpeed = GAME_CONFIG.initialNoteSpeed;
var noteTravelTime = 0;
var nextNoteIndex = 0;
var activeNotes = [];

// Game time
var clock = new THREE.Clock();
var gameTime = 0;

// Player points
var hitCount = 0;
var missCount = 0;

// Button controls
var hitButtons = [];
var heldLanes = [false, false, false, false];

// Audio
var audioListener;
var gameAudio;
var audioElement;

// Lightings
var missLight;
var isMissLightAnimating = false;
var missLightAnimationTime = 0;

// Gui to show / hide different menus
var guiStart;
var guiSong;

var guiHud;

var guiResults;
var guiSongControls = {
    name: activeSongName,
    speed: noteSpeed,
    duration: activeSongDuration
};

var guiStartControls = {
    play: function() {
        startGame();
    }
};

var guiHudControls = {
    hitCount: 0,
    missCount: 0,
    togglePause: function() {
        togglePause();
    },
    restart: function() {
        restartGame();
    }
};

var guiResultsControls = {
    totalHits: 0,
    totalMisses: 0,
    accuracy: '0%',
    restart: function() {
        restartGame();
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// INITIALIZE GAME AND THREEJS OBJECTS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function initializeGame() {
    initializeScene();
    initializeGUIs();
    createTrackObjects();
    setupInput();
    loadSongMap(activeSongName);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SCENE
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initializeScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.getElementById(GAME_CONFIG.containerId).appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x111111, 10, 50);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 3, 5);
    camera.lookAt(0, 0, -10);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    var directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    missLight = new THREE.PointLight(0xff0000, 0, 10);
    missLight.position.set(0, 4, 0);
    scene.add(missLight);

    window.addEventListener('resize', updateAspectRatio);
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    gameAudio = new THREE.Audio(audioListener);

    var backgroundVideo = document.getElementById(GAME_CONFIG.backgroundVideoId);
    backgroundVideo.src = GAME_CONFIG.backgroundVideoPath;
    backgroundVideo.load();
}

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// GUIs
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initializeGUIs() {
    guiStart = new lil.GUI({ title: GAME_CONFIG.labels.startTitle, width: 300 });
    guiStart.domElement.classList.add('no-collapse');
    guiStart.add(guiStartControls, 'play').name(GAME_CONFIG.labels.startButton);
    centerGUI(guiStart);

    guiSong = new lil.GUI({ title: GAME_CONFIG.labels.songTitle, width: 430 });
    guiSong.domElement.classList.add('no-collapse');
    guiSong.add(guiSongControls, 'name').name(GAME_CONFIG.labels.songName).disable();
    guiSong.add(guiSongControls, 'speed').name(GAME_CONFIG.labels.speed).listen().disable();
    guiSong.add(guiSongControls, 'duration').name(GAME_CONFIG.labels.songDuration).listen().disable();
    

    guiHud = new lil.GUI({ title: GAME_CONFIG.labels.scoreTitle, width: 430, height: 350 });
    guiHud.add(guiHudControls, 'hitCount').name(GAME_CONFIG.labels.hits).listen().disable();
    guiHud.add(guiHudControls, 'missCount').name(GAME_CONFIG.labels.misses).listen().disable();
    guiHud.add(guiHudControls, 'togglePause').name(GAME_CONFIG.labels.pause);
    guiHud.add(guiHudControls, 'restart').name(GAME_CONFIG.labels.restart);
    guiHud.domElement.classList.add('no-collapse');
    guiHud.hide();

    guiResults = new lil.GUI({ title: GAME_CONFIG.labels.finishedTitle, width: 320 });
    guiResults.domElement.classList.add('no-collapse');
    guiResults.add(guiResultsControls, 'totalHits').name(GAME_CONFIG.labels.totalHits).listen().disable();
    guiResults.add(guiResultsControls, 'totalMisses').name(GAME_CONFIG.labels.totalMisses).listen().disable();
    guiResults.add(guiResultsControls, 'accuracy').name(GAME_CONFIG.labels.accuracy).listen().disable();
    guiResults.add(guiResultsControls, 'restart').name(GAME_CONFIG.labels.replay);
    centerGUI(guiResults);
    guiResults.hide();
}

function centerGUI(guiInstance) {
    var element = guiInstance.domElement;
    element.style.position = 'absolute';
    element.style.top = '50%';
    element.style.left = '50%';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.margin = '0';
    element.style.zIndex = '1000';
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TRACK OBJECTS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function createTrackObjects() {
    createTrackSurface();
    createFretDividers();
    createHitButtons();
}

function createTrackSurface() {
    var trackTexture = new THREE.TextureLoader().load(GAME_CONFIG.trackTexturePath);
    var trackGeometry = new THREE.PlaneGeometry(5, 100);
    var trackMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, map: trackTexture });
    var track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.position.z = -40;
    scene.add(track);
}

function createFretDividers() {
    var laneLinePositions = [-2, -1, 0, 1, 2];
    var laneLineGeometry = new THREE.BoxGeometry(0.04, 0.01, 100);
    var laneLineMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });

    for (var index = 0; index < laneLinePositions.length; index++) {
        var laneLine = new THREE.Mesh(laneLineGeometry, laneLineMaterial);
        laneLine.position.set(laneLinePositions[index], 0.01, -40);
        scene.add(laneLine);
    }

    var fretGeometry = new THREE.BoxGeometry(4.3, 0.04, 0.08);
    var fretMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        metalness: 0.5,
        roughness: 1
    });

    for (var fretZ = -90; fretZ <= 10; fretZ += 4) {
        var fret = new THREE.Mesh(fretGeometry, fretMaterial);
        fret.position.set(0, 0.03, fretZ);
        scene.add(fret);
    }
}

function createHitButtons() {
    for (var laneIndex = 0; laneIndex < GAME_CONFIG.laneColors.length; laneIndex++) {
        var button = new THREE.Object3D();

        var ring = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 0.38, 32),
            new THREE.MeshBasicMaterial({
                color: GAME_CONFIG.laneColors[laneIndex]
            })
        );
        var center = new THREE.Mesh(
            new THREE.CircleGeometry(0.3, 32),
            new THREE.MeshPhongMaterial({
                color: GAME_CONFIG.darkButtonColor,
                emissive: 0x000000
            })
        );

        button.add(ring);
        button.add(center);
        button.rotation.x = -Math.PI / 2;
        button.position.set(GAME_CONFIG.lanePositions[laneIndex], 0.1, GAME_CONFIG.hitZoneZ - 0.75);
        scene.add(button);

        var laneLight = new THREE.PointLight(GAME_CONFIG.laneColors[laneIndex], 0, 4);
        laneLight.position.set(GAME_CONFIG.lanePositions[laneIndex], 0.6, GAME_CONFIG.hitZoneZ - 0.75);
        scene.add(laneLight);

        hitButtons.push({
            mesh: button,
            center: center,
            originalColor: GAME_CONFIG.laneColors[laneIndex],
            light: laneLight
        });
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// User input listeners
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function setupInput() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // remove focus from menu buttons
    window.addEventListener('mouseup', () => {
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
    });
}

function handleKeyDown(event) {
    if (audioListener && audioListener.context.state === 'suspended') {
        audioListener.context.resume();
    }

    if (event.code === 'Tab') {
        return; 
    }

    if (event.code === 'Space') {
        handleSpaceKey(event); // pause / unpause / restart
        return;
    }

    if (event.code === 'Delete' || event.code === 'Backspace') {
        restartGame();
    }

    // evaluate lane impacts only when game is running
    if (isPaused) {
        return;
    }

    var laneIndex = GAME_CONFIG.laneKeys.indexOf(event.code);
    if (laneIndex === -1) {
        return;
    }

    setLaneButtonPressed(laneIndex, true);
    checkLaneHit(laneIndex);
}

function handleSpaceKey(_event) {
    if (gameState === GAME_CONFIG.gameStates.start) {
        startGame();
    } else if (gameState === GAME_CONFIG.gameStates.playing ||
        gameState === GAME_CONFIG.gameStates.paused) {
        togglePause();
    } else if (gameState === GAME_CONFIG.gameStates.finished) {
        restartGame();
    }
}

function handleKeyUp(event) {
    var laneIndex = GAME_CONFIG.laneKeys.indexOf(event.code);
    if (laneIndex === -1) {
        return;
    }

    setLaneButtonPressed(laneIndex, false);
    checkHeldNoteRelease(laneIndex);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Play / Pause / Restart
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function startGame() {
    gameState = GAME_CONFIG.gameStates.playing;
    isPaused = false;
    guiStart.hide();
    guiSong.hide();
    guiHud.show();
    setBackgroundVideoPlaying(true);
    clock.start();

    playAudio();
}

function togglePause() {
    if (gameState !== GAME_CONFIG.gameStates.playing &&
        gameState !== GAME_CONFIG.gameStates.paused) {
        return;
    }

    isPaused = !isPaused;
    gameState = isPaused ? GAME_CONFIG.gameStates.paused : GAME_CONFIG.gameStates.playing;
    setPauseOverlayVisible(isPaused);
    setBackgroundVideoPlaying(!isPaused);

    if (isPaused) {
        clock.stop();
        if (audioElement) {
            audioElement.pause();
        }
        return;
    }

    clock.start();
   
    playAudio();
}

function restartGame() {
    setPauseOverlayVisible(false);
    clearActiveNotes();
    nextNoteIndex = 0;
    gameTime = 0;
    hitCount = 0;
    missCount = 0;
    heldLanes = [false, false, false, false];
    for (var laneIndex = 0; laneIndex < hitButtons.length; laneIndex++) {
        setLaneButtonPressed(laneIndex, false);
    }
    isMissLightAnimating = false;
    missLight.intensity = 0;
    guiHudControls.hitCount = 0;
    guiHudControls.missCount = 0;

    if (audioElement) {
        audioElement.currentTime = 0;
    }

    guiResults.hide();
    startGame();
}

function setPauseOverlayVisible(isVisible) {
    var overlay = document.getElementById(GAME_CONFIG.pauseOverlayId);
    if (overlay) {
        overlay.style.display = isVisible ? 'flex' : 'none';
    }
}

function setBackgroundVideoPlaying(isPlaying) {
    var backgroundVideo = document.getElementById(GAME_CONFIG.backgroundVideoId);
    if (!backgroundVideo) {
        return;
    }

    if (isPlaying) {
        backgroundVideo.play();
    } else {
        backgroundVideo.pause();
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Note hits and misses
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function setLaneButtonPressed(laneIndex, isPressed) {
    var button = hitButtons[laneIndex];
    var color = isPressed ? button.originalColor : GAME_CONFIG.darkButtonColor;
    button.center.material.color.setHex(color);
    button.center.material.emissive.setHex(isPressed ? button.originalColor : 0x000000);
    if (!isPressed) {
        button.light.intensity = 0;
    }
}

function checkLaneHit(laneIndex) {
    for (var index = 0; index < activeNotes.length; index++) {
        var note = activeNotes[index];
        if (note.laneIndex !== laneIndex || note.isMissed) {
            continue;
        }

        var frontZ = note.mesh.position.z + note.length / 2;
        if (Math.abs(frontZ - GAME_CONFIG.hitZoneZ) >= GAME_CONFIG.hitWindow) {
            continue;
        }

        if (note.isHeldNote) {
            heldLanes[laneIndex] = true;
            note.wasHeldSuccessfully = true;
        } else {
            registerHit();
            removeActiveNote(index);
        }
        break;
    }
}

// held down notes count points at the release time not the press
function checkHeldNoteRelease(laneIndex) {
    if (!heldLanes[laneIndex]) {
        return;
    }

    heldLanes[laneIndex] = false;
    for (var index = 0; index < activeNotes.length; index++) {
        var note = activeNotes[index];
        if (note.laneIndex !== laneIndex || !note.isHeldNote || !note.wasHeldSuccessfully) {
            continue;
        }

        var rearZ = note.mesh.position.z - note.length / 2;
        if (Math.abs(rearZ - GAME_CONFIG.hitZoneZ) < GAME_CONFIG.hitWindow) {
            registerHit();
            removeActiveNote(index);
        } else {
            markNoteMissed(note);
        }
        break;
    }
}

function registerHit() {
    hitCount++;
    guiHudControls.hitCount = hitCount;
}

function registerMiss() {
    missCount++;
    guiHudControls.missCount = missCount;
    triggerMissLight();
}

function markNoteMissed(note) {
    note.wasHeldSuccessfully = false;
    note.isMissed = true;
    note.mesh.material.color.setHex(GAME_CONFIG.missedNoteColor);
    note.mesh.material.emissive.setHex(0x000000);
    registerMiss();
}

function removeActiveNote(index) {
    scene.remove(activeNotes[index].mesh);
    activeNotes.splice(index, 1);
}

function clearActiveNotes() {
    for (var index = 0; index < activeNotes.length; index++) {
        scene.remove(activeNotes[index].mesh);
    }
    activeNotes = [];
}

function triggerMissLight() {
    if (isMissLightAnimating) {
        return;
    }

    isMissLightAnimating = true;
    missLightAnimationTime = 0;
    missLight.intensity = GAME_CONFIG.missLightIntensity;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Song and audio player
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// load song notes script and initialize audio player
function loadSongMap(songName) {
    var script = document.createElement('script');
    script.src = GAME_CONFIG.noteMapDirectory + songName + GAME_CONFIG.noteMapExtension;
    script.onload = onSongMapLoaded;
    script.onerror = onSongMapLoadError;
    script.dataset.songName = songName;
    document.head.appendChild(script);
}

function onSongMapLoaded(event) {
    if (!activeSong) {
        console.error('The song map did not define activeSong.');
        return;
    }
    songDuration = activeSong.duration || 'Unknown';
    noteSpeed = activeSong.noteSpeed || GAME_CONFIG.initialNoteSpeed;
    noteTravelTime = (GAME_CONFIG.hitZoneZ - GAME_CONFIG.noteStartZ) / noteSpeed;
    guiSongControls.speed = noteSpeed;
    loadAudio(event.target.dataset.songName);
    startRenderLoop();
}

function onSongMapLoadError(event) {
    console.error('Unable to load the song map: ' + event.target.src);
}

function loadAudio(songName) {
    audioElement = document.createElement('audio');
    audioElement.src = GAME_CONFIG.audioDirectory + songName + GAME_CONFIG.audioExtension;
    audioElement.load();
    gameAudio.setMediaElementSource(audioElement);
    gameAudio.setVolume(GAME_CONFIG.audioVolume);
    audioElement.onended = finishSong;
}

function finishSong() {
    gameState = GAME_CONFIG.gameStates.finished;
    isPaused = true;
    clock.stop();
    setPauseOverlayVisible(false);

    var totalNotes = hitCount + missCount;
    var accuracy = totalNotes > 0 ? ((hitCount / totalNotes) * 100).toFixed(1) + '%' : '0%';
    guiResultsControls.totalHits = hitCount;
    guiResultsControls.totalMisses = missCount;
    guiResultsControls.accuracy = accuracy;

    guiHud.hide();
    guiResults.show();
    guiSong.show();
}

function playAudio() {
    if (!audioElement) return;

    if (audioListener && audioListener.context.state === 'suspended') {
        audioListener.context.resume().then(function() {
            audioElement.play().catch(function(err) {
                console.error('Error al reproducir audio:', err);
            });
        });
    } else {
        audioElement.play().catch(function(err) {
            console.error('Error al reproducir audio:', err);
        });
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Update methods: create new notes and move existing
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function updateGame() {
    if (isPaused) {
        return;
    }

    var deltaTime = clock.getDelta();
    spawnNotes();
    updateActiveNotes();
    updateHeldLaneEffects();
    updateMissLight(deltaTime);
    synchronizeGameTime();
}


function spawnNotes() {
    if (!activeSong || !activeSong.notes) {
        return;
    }

    while (nextNoteIndex < activeSong.notes.length) {
        var noteData = activeSong.notes[nextNoteIndex];
        var hitTime = noteData[0];
        var appearanceTime = hitTime - noteTravelTime;
        if (gameTime < appearanceTime) {
            break;
        }

        createNote(noteData[1], noteData[2] || 0, hitTime);
        nextNoteIndex++;
    }
}

function createNote(laneIndex, duration, hitTime) {
    var isHeldNote = duration > 0;
    var noteLength = isHeldNote ? duration * noteSpeed : 0.7;
    var noteGeometry = isHeldNote
        ? new THREE.BoxGeometry(0.4, 0.1, noteLength)
        : new THREE.SphereGeometry(0.35, 32, 16);
    var noteMaterial = new THREE.MeshPhongMaterial({
        color: GAME_CONFIG.laneColors[laneIndex],
        emissive: 0x000000
    });
    var noteMesh = new THREE.Mesh(noteGeometry, noteMaterial);
    var frontZ = GAME_CONFIG.hitZoneZ - (hitTime - gameTime) * noteSpeed;

    noteMesh.position.set(
        GAME_CONFIG.lanePositions[laneIndex],
        isHeldNote ? 0.25 : 0.08,
        frontZ - noteLength / 2
    );
    scene.add(noteMesh);
    activeNotes.push({
        mesh: noteMesh,
        laneIndex: laneIndex,
        isHeldNote: isHeldNote,
        length: noteLength,
        hitTime: hitTime
    });
}

function updateActiveNotes() {
    for (var index = activeNotes.length - 1; index >= 0; index--) {
        var note = activeNotes[index];
        var frontZ = GAME_CONFIG.hitZoneZ - (note.hitTime - gameTime) * noteSpeed;
        note.mesh.position.z = frontZ - note.length / 2;

        var noteFrontZ = note.mesh.position.z + note.length / 2;
        var noteRearZ = note.mesh.position.z - note.length / 2;
        handleMissedHeldNote(note, noteFrontZ);

        if (completeHeldNoteAtTrackEnd(note, noteRearZ, index)) {
            continue;
        }

        removeNotePastTrack(note, noteRearZ, index);
    }
}

function handleMissedHeldNote(note, frontZ) {
    if (note.isHeldNote && !note.wasHeldSuccessfully && !note.isMissed &&
        frontZ > GAME_CONFIG.hitZoneZ + GAME_CONFIG.hitWindow) {
        markNoteMissed(note);
    }
}

function completeHeldNoteAtTrackEnd(note, rearZ, index) {
    if (!note.isHeldNote || !note.wasHeldSuccessfully || rearZ < GAME_CONFIG.hitZoneZ) {
        return false;
    }

    registerHit();
    heldLanes[note.laneIndex] = false;
    removeActiveNote(index);
    return true;
}

function removeNotePastTrack(note, rearZ, index) {
    if (rearZ <= GAME_CONFIG.missedNoteZ) {
        return;
    }

    if (!note.isHeldNote && !note.isMissed) {
        registerMiss();
    }
    removeActiveNote(index);
}

// Animates held lane buttons and the glow on successfully held notes.
function updateHeldLaneEffects() {
    var elapsedTime = clock.getElapsedTime();

    for (var laneIndex = 0; laneIndex < hitButtons.length; laneIndex++) {
        var button = hitButtons[laneIndex];
        if (!heldLanes[laneIndex]) {
            button.light.intensity = 0;
            continue;
        }

        button.center.material.color.setHex(button.originalColor);
        button.center.material.emissive.setHex(button.originalColor);
        button.light.intensity = GAME_CONFIG.holdLightIntensity + Math.sin(elapsedTime * 20);

        for (var noteIndex = 0; noteIndex < activeNotes.length; noteIndex++) {
            var note = activeNotes[noteIndex];
            if (note.laneIndex === laneIndex && note.isHeldNote && note.wasHeldSuccessfully) {
                note.mesh.material.emissive.setHex(button.originalColor);
            }
        }
    }
}

function updateMissLight(deltaTime) {
    if (!isMissLightAnimating) {
        return;
    }

    missLightAnimationTime += deltaTime;
    var progress = missLightAnimationTime / GAME_CONFIG.missLightDuration;
    if (progress >= 1) {
        missLight.intensity = 0;
        isMissLightAnimating = false;
        return;
    }

    missLight.intensity = GAME_CONFIG.missLightIntensity * (1 - progress);
}

function synchronizeGameTime() {
    if (audioElement && !audioElement.paused) {
        gameTime = audioElement.currentTime;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Render and main function
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function renderFrame() {
    requestAnimationFrame(renderFrame);
    updateGame();
    renderer.render(scene, camera);
}

function startRenderLoop() {
    renderFrame();
}

initializeGame();
