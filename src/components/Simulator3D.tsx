/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RobotState, SphereState, PhysicsParams, SimulationStats, CollectorState, SpecialCornerState, TileOverlay, Obstacle, BoxObstacle, CylindricalObstacle, RampObstacle, PlatformObstacle, SeesawObstacle, CheckpointObstacle, GreenMarkerObstacle } from '../types';
import { FIELD_WIDTH, FIELD_DEPTH, FIELD_HALF_W, FIELD_HALF_D, COLLECTOR_WALL_HEIGHT, sampleFieldFloor } from '../utils/physics';
import { Upload, HelpCircle, RefreshCw, Layers, ShieldCheck, Box, Activity, Clock } from 'lucide-react';
import { parseModelFile } from '../utils/modelLoader';

interface Simulator3DProps {
  robotState: RobotState;
  spheresState: SphereState[];
  stats: SimulationStats;
  collectors: CollectorState[];
  specialCorners?: SpecialCornerState[];
  onResetArena: () => void;
  onUploadCustomMesh: (mesh: THREE.Group | THREE.Mesh | null, name: string) => void;
  customMesh: THREE.Group | THREE.Mesh | null;
  customMeshName: string;
  showPhysics?: boolean;
  onTeleportRobot?: (x: number, z: number) => void;
  isDesignMode?: boolean;
  tileOverlays?: TileOverlay[];
  onTileClick?: (x: number, z: number) => void;
  obstacles?: Obstacle[];
  onRotateRobot?: (angleDelta: number) => void;
  countdownSeconds?: number;
}

export default function Simulator3D({
  robotState,
  spheresState,
  stats,
  collectors,
  specialCorners = [],
  showPhysics = false,
  onResetArena,
  onUploadCustomMesh,
  customMesh,
  customMeshName,
  onTeleportRobot,
  isDesignMode = false,
  tileOverlays = [],
  onTileClick,
  obstacles = [],
  onRotateRobot,
  countdownSeconds = 480,
}: Simulator3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const robotStateRef = useRef<RobotState>(robotState);
  const spheresStateRef = useRef<SphereState[]>(spheresState);
  const customMeshRef = useRef<THREE.Group | THREE.Mesh | null>(customMesh);
  const showPhysicsRef = useRef<boolean>(showPhysics);
  const onTeleportRobotRef = useRef<typeof onTeleportRobot>(onTeleportRobot);
  const onRotateRobotRef = useRef<typeof onRotateRobot>(onRotateRobot);
  const statsStatusRef = useRef<string>(stats.status);
  const isDesignModeRef = useRef<boolean>(isDesignMode);
  const onTileClickRef = useRef<typeof onTileClick>(onTileClick);
  const tileOverlaysRef = useRef<TileOverlay[]>(tileOverlays);
  const obstaclesRef = useRef<Obstacle[]>(obstacles);
  const collectorsRef = useRef<CollectorState[]>(collectors);
  const specialCornersRef = useRef<SpecialCornerState[]>(specialCorners || []);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'fpv' | 'top'>('orbit');
  const [loadError, setLoadError] = useState<string | null>(null);

  const cameraModeRef = useRef<'orbit' | 'fpv' | 'top'>(cameraMode);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Keep refs in sync for the animation loop
  useEffect(() => {
    robotStateRef.current = robotState;
  }, [robotState]);

  useEffect(() => {
    spheresStateRef.current = spheresState;
  }, [spheresState]);

  useEffect(() => {
    customMeshRef.current = customMesh;
  }, [customMesh]);

  useEffect(() => {
    showPhysicsRef.current = showPhysics;
  }, [showPhysics]);

  useEffect(() => {
    onTeleportRobotRef.current = onTeleportRobot;
  }, [onTeleportRobot]);

  useEffect(() => {
    statsStatusRef.current = stats.status;
  }, [stats.status]);

  useEffect(() => {
    isDesignModeRef.current = isDesignMode;
  }, [isDesignMode]);

  useEffect(() => {
    onTileClickRef.current = onTileClick;
  }, [onTileClick]);

  useEffect(() => {
    onRotateRobotRef.current = onRotateRobot;
  }, [onRotateRobot]);

  useEffect(() => {
    tileOverlaysRef.current = tileOverlays;
  }, [tileOverlays]);

  useEffect(() => {
    obstaclesRef.current = obstacles;
  }, [obstacles]);

  useEffect(() => {
    collectorsRef.current = collectors;
  }, [collectors]);

  useEffect(() => {
    specialCornersRef.current = specialCorners || [];
  }, [specialCorners]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    if (controlsRef.current && cameraRef.current) {
      if (cameraMode === 'top') {
        controlsRef.current.enableRotate = false;
        controlsRef.current.minPolarAngle = 0;
        controlsRef.current.maxPolarAngle = 0;
        // Fix camera to top-down but allow zoom by maintaining position
        const currentY = cameraRef.current.position.y;
        cameraRef.current.position.set(0.01, Math.max(currentY, 40), 0);
        controlsRef.current.target.set(0, 0, 0);
      } else if (cameraMode === 'orbit') {
        controlsRef.current.enableRotate = true;
        controlsRef.current.minPolarAngle = 0;
        controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.01;
      }
    }
  }, [cameraMode]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Restores a single clean container by clearing any stale duplicate canvases
    mountRef.current.innerHTML = '';

    // --- THREE.JS SETUP ---
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    // Warm tech dark scene background matching are studio slate theme
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.0035);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(110, 110, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    if (cameraModeRef.current === 'top') {
      controls.enableRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
      camera.position.set(0.01, 130, 0);
    } else {
      controls.maxPolarAngle = Math.PI / 2 - 0.01; // Can't go below floor
    }

    controls.minDistance = 20;
    controls.maxDistance = 500;

    // --- LIGHTS ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff3e0, 1.2);
    dirLight.position.set(50, 120, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 300;
    const dSide = 100;
    dirLight.shadow.camera.left = -dSide;
    dirLight.shadow.camera.right = dSide;
    dirLight.shadow.camera.top = dSide;
    dirLight.shadow.camera.bottom = -dSide;
    scene.add(dirLight);

    const accentLight = new THREE.PointLight(0x6366f1, 1.5, 120);
    accentLight.position.set(0, 40, 0);
    scene.add(accentLight);

    // --- ARENA FLOOR & GRID ---
    // Floor plane (Base background for areas not covered by tiles)
    const floorGeo = new THREE.PlaneGeometry(500, 500);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111827, // Darker base
      roughness: 0.9,
      metalness: 0.0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1; // Slightly below tiles
    floor.receiveShadow = true;
    scene.add(floor);

    const sharedWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const borderMat = new THREE.LineBasicMaterial({ color: 0x4f46e5, linewidth: 1.5 });

    const overlaysGroup = new THREE.Group();
    scene.add(overlaysGroup);

    const bordersGroup = new THREE.Group();
    scene.add(bordersGroup);

    const obstaclesGroup = new THREE.Group();
    scene.add(obstaclesGroup);

    const createTile = (tx: number, tz: number, size: number = 30) => {
      const tileGeo = new THREE.PlaneGeometry(size, size);
      const tile = new THREE.Mesh(tileGeo, sharedWhiteMat);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(tx, 0.012, tz);
      tile.receiveShadow = true;
      tile.userData = { isTile: true };
      scene.add(tile);

      const hw = size / 2;
      const hd = size / 2;
      const borderPoints = [
        new THREE.Vector3(tx - hw, 0.013, tz - hd),
        new THREE.Vector3(tx + hw, 0.013, tz - hd),
        new THREE.Vector3(tx + hw, 0.013, tz + hd),
        new THREE.Vector3(tx - hw, 0.013, tz + hd),
        new THREE.Vector3(tx - hw, 0.013, tz - hd),
      ];
      const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
      const borderLine = new THREE.Line(borderGeo, borderMat);
      bordersGroup.add(borderLine);
      return tile;
    };

    // Tiling the main arena (90x120 -> 3x4 tiles)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1.5; j <= 1.5; j++) {
        createTile(i * 30, j * 30);
      }
    }

    // Colored outline border for the 90x120 arena
    const arenaLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-FIELD_HALF_W, 0.1, -FIELD_HALF_D),
      new THREE.Vector3(FIELD_HALF_W, 0.1, -FIELD_HALF_D),
      new THREE.Vector3(FIELD_HALF_W, 0.1, FIELD_HALF_D),
      new THREE.Vector3(-FIELD_HALF_W, 0.1, FIELD_HALF_D),
      new THREE.Vector3(-FIELD_HALF_W, 0.1, -FIELD_HALF_D),
    ]);
    const arenaLineMat = new THREE.LineBasicMaterial({ color: 0x4f46e5, linewidth: 2 });
    const arenaLine = new THREE.Line(arenaLineGeo, arenaLineMat);
    scene.add(arenaLine);

    // --- CONTAINMENT WALLS (10cm tall) ---
    // User request: "Lo spessore delle pareti laterali è di 1 cm" (thickness = 1.0)
    // and "il campo e le pareti sono di colore bianco"
    const buildWall = (w: number, h: number, d: number, x: number, z: number) => {
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      const wall = new THREE.Mesh(wallGeo, sharedWhiteMat);
      wall.position.set(x, h / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
    };

    // Check which corners are missing walls for entrance/exit (fine-grained by axis)
    const nw_missing_x = specialCorners.some(sc => sc.xCorner === -45 && sc.zCorner === -60 && (!sc.missingWall || sc.missingWall === 'x'));
    const ne_missing_x = specialCorners.some(sc => sc.xCorner === 45 && sc.zCorner === -60 && (!sc.missingWall || sc.missingWall === 'x'));
    const sw_missing_x = specialCorners.some(sc => sc.xCorner === -45 && sc.zCorner === 60 && (!sc.missingWall || sc.missingWall === 'x'));
    const se_missing_x = specialCorners.some(sc => sc.xCorner === 45 && sc.zCorner === 60 && (!sc.missingWall || sc.missingWall === 'x'));

    const nw_missing_z = specialCorners.some(sc => sc.xCorner === -45 && sc.zCorner === -60 && (!sc.missingWall || sc.missingWall === 'z'));
    const ne_missing_z = specialCorners.some(sc => sc.xCorner === 45 && sc.zCorner === -60 && (!sc.missingWall || sc.missingWall === 'z'));
    const sw_missing_z = specialCorners.some(sc => sc.xCorner === -45 && sc.zCorner === 60 && (!sc.missingWall || sc.missingWall === 'z'));
    const se_missing_z = specialCorners.some(sc => sc.xCorner === 45 && sc.zCorner === 60 && (!sc.missingWall || sc.missingWall === 'z'));

    // North Wall: at Z = -FIELD_HALF_D - 0.5 (Normally spans X from -46 to 46 with thickness 1)
    if (nw_missing_x && ne_missing_x) {
      buildWall(30, 10, 1.0, 0, -FIELD_HALF_D - 0.5); // Spans [-15, 15]
    } else if (nw_missing_x) {
      buildWall(61, 10, 1.0, 15.5, -FIELD_HALF_D - 0.5); // Spans [-15, 46.5]
    } else if (ne_missing_x) {
      buildWall(61, 10, 1.0, -15.5, -FIELD_HALF_D - 0.5); // Spans [-46.5, 15]
    } else {
      buildWall(FIELD_WIDTH + 2, 10, 1.0, 0, -FIELD_HALF_D - 0.5); // Spans [-46, 46]
    }

    // South Wall: at Z = FIELD_HALF_D + 0.5 (Normally spans X from -46 to 46 with thickness 1)
    if (sw_missing_x && se_missing_x) {
      buildWall(30, 10, 1.0, 0, FIELD_HALF_D + 0.5); // Spans [-15, 15]
    } else if (sw_missing_x) {
      buildWall(61, 10, 1.0, 15.5, FIELD_HALF_D + 0.5); // Spans [-15, 46.5]
    } else if (se_missing_x) {
      buildWall(61, 10, 1.0, -15.5, FIELD_HALF_D + 0.5); // Spans [-46.5, 15]
    } else {
      buildWall(FIELD_WIDTH + 2, 10, 1.0, 0, FIELD_HALF_D + 0.5); // Spans [-46, 46]
    }

    // West Wall: at X = -FIELD_HALF_W - 0.5 (Normally spans Z from -60 to 60 with thickness 1)
    if (nw_missing_z && sw_missing_z) {
      buildWall(1.0, 10, 60, -FIELD_HALF_W - 0.5, 0); // Spans Z [-30, 30]
    } else if (nw_missing_z) {
      buildWall(1.0, 10, 90, -FIELD_HALF_W - 0.5, 15); // Spans Z [-30, 60]
    } else if (sw_missing_z) {
      buildWall(1.0, 10, 90, -FIELD_HALF_W - 0.5, -15); // Spans Z [-60, 30]
    } else {
      buildWall(1.0, 10, FIELD_DEPTH, -FIELD_HALF_W - 0.5, 0); // Spans Z [-60, 60]
    }

    // East Wall: at X = FIELD_HALF_W + 0.5 (Normally spans Z from -60 to 60 with thickness 1)
    if (ne_missing_z && se_missing_z) {
      buildWall(1.0, 10, 60, FIELD_HALF_W + 0.5, 0); // Spans Z [-30, 30]
    } else if (ne_missing_z) {
      buildWall(1.0, 10, 90, FIELD_HALF_W + 0.5, 15); // Spans Z [-30, 60]
    } else if (se_missing_z) {
      buildWall(1.0, 10, 90, FIELD_HALF_W + 0.5, -15); // Spans Z [-60, 30]
    } else {
      buildWall(1.0, 10, FIELD_DEPTH, FIELD_HALF_W + 0.5, 0); // Spans Z [-60, 60]
    }

    // --- SPECIAL CORNERS (ENTRANCE / EXIT) INDICATORS AND STRIPS ---
    const externalRooms: { x: number; z: number; w: number; d: number }[] = [];
    
    const addExternalRoomMesh = (x: number, z: number, w: number, d: number) => {
      // Divide the room into 30x30 tiles
      const tileSize = 30;
      const cols = Math.round(w / tileSize);
      const rows = Math.round(d / tileSize);
      
      const startX = x - w / 2 + tileSize / 2;
      const startZ = z - d / 2 + tileSize / 2;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const tx = startX + i * tileSize;
          const tz = startZ + j * tileSize;
          createTile(tx, tz, tileSize);
        }
      }
    };

    specialCorners.forEach(sc => {
      const signX = sc.xCorner < 0 ? 1 : -1;
      const signZ = sc.zCorner < 0 ? 1 : -1;
      const color = sc.type === 'entrance' ? 0x10b981 : 0xef4444;

      const isExit = sc.type === 'exit';
      const stripWidth = isExit ? 1.8 : 2.5; // 25 mm for entrance, 18 mm for exit

      const stripedMat = new THREE.MeshStandardMaterial({
        color: isExit ? 0x111111 : 0xffffff, // Black Matte for exit, Light Silver for entrance
        roughness: isExit ? 0.9 : 0.15,
        metalness: isExit ? 0.0 : 0.8,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });

      // Show strip ONLY on the wall that is actually open/missing
      if (!sc.missingWall || sc.missingWall === 'x') {
        // Strip 1: along the horizontal edge
        // Making it physically taller (0.12) and positioning it slightly higher (0.072)
        const strip1Geo = new THREE.BoxGeometry(sc.size, 0.12, stripWidth);
        const strip1 = new THREE.Mesh(strip1Geo, stripedMat);
        strip1.position.set(sc.xCorner + signX * (sc.size / 2), 0.072, sc.zCorner);
        strip1.receiveShadow = true;
        strip1.renderOrder = 10;
        scene.add(strip1);
      }

      if (!sc.missingWall || sc.missingWall === 'z') {
        // Strip 2: along the vertical edge
        // Making it physically taller (0.12) and positioning it slightly higher (0.072)
        const strip2Geo = new THREE.BoxGeometry(stripWidth, 0.12, sc.size);
        const strip2 = new THREE.Mesh(strip2Geo, stripedMat);
        strip2.position.set(sc.xCorner, 0.072, sc.zCorner + signZ * (sc.size / 2));
        strip2.receiveShadow = true;
        strip2.renderOrder = 10;
        scene.add(strip2);
      }

      // Elegant indicator on floor for entry/exit
      const indGeo = new THREE.PlaneGeometry(12, 12);
      const indMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      const ind = new THREE.Mesh(indGeo, indMat);
      ind.rotation.x = -Math.PI / 2;
      ind.renderOrder = 8;

      // Position shifted towards the opening, placed at Y = 0.018 to be above overlays
      if (sc.missingWall === 'x') {
        ind.position.set(sc.xCorner + signX * 15, 0.018, sc.zCorner + signZ * 4);
      } else if (sc.missingWall === 'z') {
        ind.position.set(sc.xCorner + signX * 4, 0.018, sc.zCorner + signZ * 15);
      } else {
        ind.position.set(sc.xCorner + signX * 12, 0.018, sc.zCorner + signZ * 12);
      }
      scene.add(ind);

      // Render 90x120 "Room" planes before both Entrance and Exit
      // To have the "same orientation as the room", we match the arena's Portrait (90x120) dimensions.
      let tileX = 0;
      let tileZ = 0;
      let tileW = 90;
      let tileD = 120;

      if (sc.missingWall === 'x') {
        // Plane is attached to a horizontal wall (North or South)
        // To align 90x120 room with 90x120 arena width, center X at 0
        tileX = 0; 
        // Plane sticks out along Z (Outside)
        tileZ = sc.zCorner - signZ * (tileD / 2);
      } else {
        // Plane is attached to a vertical wall (West or East)
        // To align 90x120 room with 90x120 arena depth, center Z at 0
        tileZ = 0;
        // Plane sticks out along X (Outside)
        tileX = sc.xCorner - signX * (tileW / 2);
      }

      externalRooms.push({ x: tileX, z: tileZ, w: tileW, d: tileD });
      addExternalRoomMesh(tileX, tileZ, tileW, tileD);

      // Rendering for Entrance specific features (starting tile marker)
      if (sc.type === 'entrance') {
        // Centerline removed by user request
      }
    });

    // Check if we need to close the "hole" at the corner between two added rooms
    if (externalRooms.length === 2) {
      const room1 = externalRooms[0];
      const room2 = externalRooms[1];
      
      // If one room is aligned in X (centered at 0) and the other is aligned in Z (centered at 0)
      // they potentially form an "L" shape with the central arena.
      if ((room1.x === 0 && room2.z === 0) || (room1.z === 0 && room2.x === 0)) {
        const cornerX = room1.x === 0 ? room2.x : room1.x;
        const cornerZ = room1.z === 0 ? room2.z : room1.z;
        addExternalRoomMesh(cornerX, cornerZ, 90, 120);
      }
    }


    // --- TRIANGULAR COLLECTORS BINS (6cm tall walls) ---
    // User request: "i raccoglitori sono a forma triangolare con le pareti su tutti i lati ed il fondo... lo spessore delle pareti dei raccoglitori è di 5 millimetri."
    const collectorWallThick = 0.5; // 5 mm thickness
    const collectorWallHeight = COLLECTOR_WALL_HEIGHT; // 6cm tall
    const diagLen = 30 * Math.sqrt(2);

    collectors.forEach(col => {
      const colorHex = col.color === 'green' ? 0x10b981 : 0xef4444;
      const xc = col.xCorner;
      const zc = col.zCorner;
      const size = col.size; // 30 cm

      const signX = xc < 0 ? 1 : -1;
      const signZ = zc < 0 ? 1 : -1;

      // 1. Bottom shape inside the corner
      const shape = new THREE.Shape();
      shape.moveTo(xc, zc);
      shape.lineTo(xc + signX * size, zc);
      shape.lineTo(xc, zc + signZ * size);
      shape.lineTo(xc, zc);

      const extrudeSettings = {
        depth: 0.5, // 5 mm thick bottom base
        bevelEnabled: false,
      };
      const indicatorGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.4,
        metalness: 0.1,
      });
      const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
      indicator.rotation.x = Math.PI / 2;
      indicator.position.set(0, 0.51, 0);
      indicator.receiveShadow = true;
      scene.add(indicator);

      // Walls Material
      const wallMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.2,
        roughness: 0.3,
      });

      // 2. Straight wall along X axis
      const wallXGeo = new THREE.BoxGeometry(size, collectorWallHeight, collectorWallThick);
      const wallX = new THREE.Mesh(wallXGeo, wallMat);
      const wallX_X = xc + signX * (size / 2);
      const wallX_Z = zc + (signZ * collectorWallThick / 2);
      wallX.position.set(wallX_X, collectorWallHeight / 2, wallX_Z);
      wallX.castShadow = true;
      wallX.receiveShadow = true;
      scene.add(wallX);

      // 3. Straight wall along Z axis
      const wallZGeo = new THREE.BoxGeometry(collectorWallThick, collectorWallHeight, size);
      const wallZ = new THREE.Mesh(wallZGeo, wallMat);
      const wallZ_X = xc + (signX * collectorWallThick / 2);
      const wallZ_Z = zc + signZ * (size / 2);
      wallZ.position.set(wallZ_X, collectorWallHeight / 2, wallZ_Z);
      wallZ.castShadow = true;
      wallZ.receiveShadow = true;
      scene.add(wallZ);

      // 4. Diagonal wall
      const diagCX = xc + signX * (size / 2);
      const diagCZ = zc + signZ * (size / 2);
      const diagWallGeo = new THREE.BoxGeometry(collectorWallThick, collectorWallHeight, diagLen);
      const diagWall = new THREE.Mesh(diagWallGeo, wallMat);
      diagWall.position.set(diagCX, collectorWallHeight / 2, diagCZ);

      // Rotation determination:
      let rotY = Math.PI / 4;
      if (xc < 0 && zc < 0) rotY = -Math.PI / 4;
      if (xc > 0 && zc > 0) rotY = -Math.PI / 4;
      diagWall.rotation.y = rotY;

      diagWall.castShadow = true;
      diagWall.receiveShadow = true;
      scene.add(diagWall);


    });

    // --- PROCEDURAL DEFAULT ROBOT PARTS ---
    const robotGroup = new THREE.Group();
    robotGroup.rotation.order = 'YXZ';
    scene.add(robotGroup);

    // Visual model containers
    let chassiMesh: THREE.Object3D | null = null;
    const defaultChassis = new THREE.Group();

    // Default procedural robot chassis - Scaled down and rounded vertical corners
    const upperCelesteMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa, // Celeste (Light Blue)
      roughness: 0.2,
      metalness: 0.8,
    });

    const whiteBottomMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White bottom face
      roughness: 0.3,
      metalness: 0.5,
    });

    // We build a composite rounded body:
    // Total Width = 16, Total Height = 8 (Upper: 7.5, Lower White: 0.5), Total Length = 16
    // Corner radius R = 1.0. 
    // Thus: Central boxes are width 14, depth 16. Transverse boxes are width 16, depth 14.
    // Four vertical cylinders at (+-7, +-7).

    // 1. White bottom layer (Height 0.5, Y center at 2.25)
    const botBox1Geo = new THREE.BoxGeometry(14, 0.5, 16);
    const botBox1 = new THREE.Mesh(botBox1Geo, whiteBottomMat);
    botBox1.position.y = 2.25;
    botBox1.castShadow = true;
    botBox1.receiveShadow = true;
    defaultChassis.add(botBox1);

    const botBox2Geo = new THREE.BoxGeometry(16, 0.5, 14);
    const botBox2 = new THREE.Mesh(botBox2Geo, whiteBottomMat);
    botBox2.position.y = 2.25;
    botBox2.castShadow = true;
    botBox2.receiveShadow = true;
    defaultChassis.add(botBox2);

    const botCylGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.5, 16);
    const corners = [
      { x: 7, z: 7 },
      { x: -7, z: 7 },
      { x: 7, z: -7 },
      { x: -7, z: -7 }
    ];
    corners.forEach(pos => {
      const cyl = new THREE.Mesh(botCylGeo, whiteBottomMat);
      cyl.position.set(pos.x, 2.25, pos.z);
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      defaultChassis.add(cyl);
    });

    // 2. Upper Celeste body (Height 7.5, Y center at 6.25)
    const topBox1Geo = new THREE.BoxGeometry(14, 7.5, 16);
    const topBox1 = new THREE.Mesh(topBox1Geo, upperCelesteMat);
    topBox1.position.y = 6.25;
    topBox1.castShadow = true;
    topBox1.receiveShadow = true;
    defaultChassis.add(topBox1);

    const topBox2Geo = new THREE.BoxGeometry(16, 7.5, 14);
    const topBox2 = new THREE.Mesh(topBox2Geo, upperCelesteMat);
    topBox2.position.y = 6.25;
    topBox2.castShadow = true;
    topBox2.receiveShadow = true;
    defaultChassis.add(topBox2);

    const topCylGeo = new THREE.CylinderGeometry(1.0, 1.0, 7.5, 16);
    corners.forEach(pos => {
      const cyl = new THREE.Mesh(topCylGeo, upperCelesteMat);
      cyl.position.set(pos.x, 6.25, pos.z);
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      defaultChassis.add(cyl);
    });

    // Add 2 styled yellow/orange hazard decals on the sides of the smaller chassis
    const stripeGeo = new THREE.PlaneGeometry(8, 0.8);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide });
    const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
    stripe1.rotation.y = Math.PI / 2;
    stripe1.position.set(8.02, 6.25, 0);
    defaultChassis.add(stripe1);
    const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
    stripe2.rotation.y = -Math.PI / 2;
    stripe2.position.set(-8.02, 6.25, 0);
    defaultChassis.add(stripe2);

    // 4 wheels - Scaled down
    const wheelGeo = new THREE.CylinderGeometry(3.2, 3.2, 1.6, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.1 }); // Vibrant yellow wheels
    const wheels: THREE.Group[] = [];

    // Dark red notch near the circumference
    const notchGeo = new THREE.BoxGeometry(0.2, 1.0, 0.4);
    const notchMat = new THREE.MeshBasicMaterial({ color: 0x991b1b }); // Darker red

    const addWheel = (x: number, y: number, z: number) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, y, z);

      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2; // Orient cylinder axle along local X of the group
      wheel.castShadow = true;
      wheelGroup.add(wheel);

      // The outer flat circular face is at local X = 0.81 or X = -0.81 (just outside the 1.6-wide cylinder)
      const outerX = x > 0 ? 0.81 : -0.81;

      // Add a black central hub near the axle (perno) on the outer face
      const hubGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.1, 12);
      const hubMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7, metalness: 0.1 }); // Matte black/zinc color
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      const hubX = x > 0 ? 0.82 : -0.82;
      hub.position.set(hubX, 0, 0);
      wheelGroup.add(hub);

      // Add a single notch near the circumference on the outer face
      const notch = new THREE.Mesh(notchGeo, notchMat);
      // Position it near the edge: cylinder radius is 3.2, so place it at Y = 2.4
      notch.position.set(outerX, 2.4, 0);
      wheelGroup.add(notch);

      defaultChassis.add(wheelGroup);
      wheels.push(wheelGroup);
    };

    addWheel(9.0, 3.2, 5.0);  // Front right
    addWheel(-9.0, 3.2, 5.0); // Front left
    addWheel(9.0, 3.2, -5.0); // Back right
    addWheel(-9.0, 3.2, -5.0);// Back left

    // Set default chassis to contain all default visual items
    chassiMesh = defaultChassis;
    robotGroup.add(chassiMesh);

    // --- DISTANCE SENSOR (RED 3D SYMBOL) ---
    const sensorGroup = new THREE.Group();
    sensorGroup.position.set(0, 3.0, 8.1); // Front center, scaled position
    
    // Main red sensor body
    const sensorBaseGeo = new THREE.BoxGeometry(3.2, 1.2, 1.2);
    const sensorBaseMat = new THREE.MeshStandardMaterial({ 
      color: 0xff0000, 
      metalness: 0.3, 
      roughness: 0.4, 
      emissive: 0xaa0000, 
      emissiveIntensity: 0.4 
    });
    const sensorBase = new THREE.Mesh(sensorBaseGeo, sensorBaseMat);
    sensorGroup.add(sensorBase);

    // Black "eyes" typical of ultrasonic sensors to make it recognizable
    const eyeGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.9 });
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.rotation.x = Math.PI / 2;
    leftEye.position.set(-0.8, 0, 0.5);
    sensorGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.rotation.x = Math.PI / 2;
    rightEye.position.set(0.8, 0, 0.5);
    sensorGroup.add(rightEye);

    robotGroup.add(sensorGroup);

    // --- COLOR SENSOR 1 (Front Forward Color Sensor) ---
    const colorSensorGeo = new THREE.BoxGeometry(1.2, 1.2, 0.4);
    const colorSensorMat = new THREE.MeshStandardMaterial({ 
      color: 0x10b981, 
      emissive: 0x10b981,
      emissiveIntensity: 0.1
    });
    const colorSensorLED = new THREE.Mesh(colorSensorGeo, colorSensorMat);
    colorSensorLED.position.set(0, 4.6, 8.1); 
    robotGroup.add(colorSensorLED);

    const fwdBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    });
    const fwdBeamGeo = new THREE.CylinderGeometry(0.15, 0.4, 10.0, 8);
    fwdBeamGeo.translate(0, 5.0, 0); // Position base at 0, extends to 10cm
    const fwdBeam = new THREE.Mesh(fwdBeamGeo, fwdBeamMat);
    fwdBeam.rotation.x = Math.PI / 2; // Point forward
    fwdBeam.position.set(0, 0, 0.2); // slight offset from block face
    colorSensorLED.add(fwdBeam);

    // --- DUAL-PURPOSE NOSE SENSORS: LuceColSx & LuceColDx ---
    const luceColSxLensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      roughness: 0.1
    });
    const luceColDxLensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      roughness: 0.1
    });

    const sensorHolderGeo = new THREE.BoxGeometry(1.0, 4.0, 1.0);
    const sensorHolderMat = new THREE.MeshStandardMaterial({ color: 0xd946ef, roughness: 0.3, metalness: 0.1 }); // Fuchsia body
    const sensorLensGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 8);

    const sxBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const dxBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const sensorBeamGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8);
    sensorBeamGeo.translate(0, -0.6, 0); // Position the top of cylinder at Y=0

    // Left Sensor (LuceColSx)
    const sxHolder = new THREE.Mesh(sensorHolderGeo, sensorHolderMat);
    sxHolder.position.set(-1.8, 3.2, 5.5); // 1.8cm left, tucked slightly behind front bumper under chassis
    const sxLens = new THREE.Mesh(sensorLensGeo, luceColSxLensMat);
    sxLens.position.set(0, -2.0, 0); 
    sxHolder.add(sxLens);
    const sxBeam = new THREE.Mesh(sensorBeamGeo, sxBeamMat);
    sxBeam.position.set(0, -2.0, 0); // pointing downwards from lens center to ground
    sxHolder.add(sxBeam);
    robotGroup.add(sxHolder);

    // Right Sensor (LuceColDx)
    const dxHolder = new THREE.Mesh(sensorHolderGeo, sensorHolderMat);
    dxHolder.position.set(1.8, 3.2, 5.5); // 1.8cm right, tucked slightly behind front bumper under chassis
    const dxLens = new THREE.Mesh(sensorLensGeo, luceColDxLensMat);
    dxLens.position.set(0, -2.0, 0); 
    dxHolder.add(dxLens);
    const dxBeam = new THREE.Mesh(sensorBeamGeo, dxBeamMat);
    dxBeam.position.set(0, -2.0, 0); // pointing downwards from lens center to ground
    dxHolder.add(dxBeam);
    robotGroup.add(dxHolder);

    // --- LED ROSSO IN CIMA AL ROBOT ---
    const ledRedLensMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d, // Start with a darker red (off state)
      emissive: 0xef4444,
      emissiveIntensity: 0.0, // Off state
      roughness: 0.1,
      metalness: 0.8
    });

    const ledBaseGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8);
    const ledBaseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.5 });
    const ledBase = new THREE.Mesh(ledBaseGeo, ledBaseMat);
    // Put on top of the chassis. Since robot height is 12, putting it at Y = 10.1 (recessed slightly) or Y = 12.1 is perfect.
    // The chassis upper celeste block Y center represents its height.
    // Let's position it at Y = 10.35, Z = -3.5 (rear section) for a very visible placement.
    ledBase.position.set(0, 10.35, -3.5);
    ledBase.castShadow = true;

    const ledDomeGeo = new THREE.SphereGeometry(0.35, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2); // Capsule/Dome dome shape
    const ledDome = new THREE.Mesh(ledDomeGeo, ledRedLensMat);
    ledDome.position.set(0, 0.15, 0);
    ledDome.castShadow = true;
    ledBase.add(ledDome);

    const ledRedLight = new THREE.PointLight(0xff0000, 0, 20); // Range increased to 20 for wider visual impact
    ledRedLight.position.set(0, 0.5, 0);
    ledDome.add(ledRedLight);
    
    robotGroup.add(ledBase);

    // --- ARTICULATED MOVING ROBOT EXTRA PARTS (Elevator Arm and Pinza Claw) ---
    // These must overlay on top of any custom or default loaded model so the gripping action remains totally animated and visible!
    const armatureGroup = new THREE.Group();
    robotGroup.add(armatureGroup);

    // Elevator track vertically
    const trackGeo = new THREE.BoxGeometry(2, 17.0, 2);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.1 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, 11.5, 5.9); // Spans from Y=3 to Y=20.0 (Raised by 3cm from base Y=0, and aligned with requested height)
    armatureGroup.add(track);

    // Arm carriage block that slides up and down on the track
    const carriageGroup = new THREE.Group();
    armatureGroup.add(carriageGroup);

    const carriageGeo = new THREE.BoxGeometry(4, 3, 4);
    const carriageMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.1 });
    const carriage = new THREE.Mesh(carriageGeo, carriageMat);
    carriage.castShadow = true;
    carriageGroup.add(carriage);

    // Two forks/prongs extending forward from carriage to support claw fingers
    const prongMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, metalness: 0.9 });

    // Left finger arm
    const lFingerGeo = new THREE.BoxGeometry(1, 1.5, 8);
    const lFinger = new THREE.Mesh(lFingerGeo, prongMat);
    lFinger.position.set(-3, 0, 4); // offset from center, forward length
    lFinger.castShadow = true;
    carriageGroup.add(lFinger);

    // Right finger arm
    const rFingerGeo = new THREE.BoxGeometry(1, 1.5, 8);
    const rFinger = new THREE.Mesh(rFingerGeo, prongMat);
    rFinger.position.set(3, 0, 4);
    rFinger.castShadow = true;
    carriageGroup.add(rFinger);

    // Gripper paddle pads
    const paddleGeo = new THREE.BoxGeometry(2.5, 1.5, 0.5);
    const paddleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1 });

    const lPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    lPaddle.position.set(0.75, 0, 4);
    lPaddle.rotation.y = -Math.PI / 6;
    lFinger.add(lPaddle);

    const rPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    rPaddle.position.set(-0.75, 0, 4);
    rPaddle.rotation.y = Math.PI / 6;
    rFinger.add(rPaddle);

    // --- SPHERES (3 physical objects) ---
    const sphereMeshes: THREE.Mesh[] = [];

    // Materials
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.8,
      roughness: 0.15,
      name: 'silver',
    });

    const blackMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.7,
      metalness: 0.1,
      name: 'black',
    });

    // Create 3 sphere meshes
    const createSphereMesh = (id: number, colorStyle: 'silver' | 'black') => {
      const geo = new THREE.SphereGeometry(2.5, 32, 32);
      const mat = colorStyle === 'silver' ? silverMat : blackMat;
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      sphereMeshes.push(m);
    };

    // --- DEBUG PHYSICS VISUALIZERS ---
    const debugGroup = new THREE.Group();
    debugGroup.visible = false;
    scene.add(debugGroup);

    // Robot Bounding Box Helper
    const robotBB = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.8 })
    );
    debugGroup.add(robotBB);

    // Bounding Box Helper for special corners (just generic obstacles)
    const obstGeos: THREE.Mesh[] = [];
    specialCorners?.forEach(sc => {
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(sc.size || 30, 6, sc.size || 30),
        new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
      );
      debugGroup.add(g);
      obstGeos.push(g);
    });

    // Sensor ray line
    const sensorGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1)]);
    const sensorLine = new THREE.Line(sensorGeo, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    debugGroup.add(sensorLine);

    // Sphere velocity arrows
    const velArrows: THREE.ArrowHelper[] = [];
    for (let i = 0; i < 3; i++) {
        const h = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 0, 0x00ff00, 2, 1);
        debugGroup.add(h);
        velArrows.push(h);
    }

    createSphereMesh(1, 'silver');
    createSphereMesh(2, 'silver');
    createSphereMesh(3, 'black');

    const updateOverlays = () => {
      overlaysGroup.clear();
      const loader = new THREE.TextureLoader();
      
      tileOverlaysRef.current.forEach(overlay => {
        const texture = loader.load(overlay.imageUrl);
        const geo = new THREE.PlaneGeometry(29.8, 29.8); // slight margin
        const mat = new THREE.MeshStandardMaterial({ 
          map: texture, 
          roughness: 0.8,
          metalness: 0.0,
          transparent: true,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = overlay.rotation || 0;
        mesh.position.set(overlay.x, 0.015, overlay.z);
        mesh.receiveShadow = true;
        overlaysGroup.add(mesh);
      });

      // Track current state to detect changes in the animation loop
      overlaysGroup.userData.hash = JSON.stringify(tileOverlaysRef.current);
    };

    const updateObstaclesVisibility = () => {
      obstaclesGroup.clear();
      const obstaclesList = obstaclesRef.current;
      const numSegments = 250;
      
      // Materials
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.2 });
      const blackMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.8, metalness: 0.1 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9, metalness: 0.05 });
      
      // Create text texture for the box label
      const createTextTexture = (text: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Wood background base
          ctx.fillStyle = '#8b4513';
          ctx.fillRect(0, 0, 256, 256);
          
          // Text settings
          ctx.fillStyle = '#000000'; // Black text
          ctx.font = 'bold 52px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Draw vertical text
          const chars = text.split('');
          const spacing = 40;
          const startY = (256 - (chars.length - 1) * spacing) / 2;
          
          chars.forEach((char, i) => {
            ctx.save();
            ctx.translate(128, startY + i * spacing);
            ctx.scale(1.5, 1.0); // Expand horizontally by 50%
            ctx.fillText(char, 0, 0);
            ctx.restore();
          });
        }
        return new THREE.CanvasTexture(canvas);
      };
      
      const staarrTexture = createTextTexture('STAARR');
      const boxMaterials = [
        new THREE.MeshStandardMaterial({ map: staarrTexture }), // +X
        new THREE.MeshStandardMaterial({ map: staarrTexture }), // -X
        woodMat, // +Y
        woodMat, // -Y
        new THREE.MeshStandardMaterial({ map: staarrTexture }), // +Z
        new THREE.MeshStandardMaterial({ map: staarrTexture })  // -Z
      ];
      
      obstaclesList.forEach(obs => {
        if (!obs.type || obs.type === 'cylinder') {
          const cObs = obs as CylindricalObstacle;
          const totalLength = cObs.height || 25;
          const radius = cObs.radius || 0.5;
          const rot = cObs.rotation || 0;
          const segLength = totalLength / numSegments;
          
          const bumperGroup = new THREE.Group();
          bumperGroup.position.set(cObs.x, radius, cObs.z);
          bumperGroup.rotation.y = rot;
          
          const segGeo = new THREE.CylinderGeometry(radius, radius, segLength, 8);
          
          for (let i = 0; i < numSegments; i++) {
            const offset = -totalLength / 2 + (i + 0.5) * segLength;
            const worldX = cObs.x + Math.cos(rot) * offset;
            const worldZ = cObs.z + Math.sin(rot) * offset;
            
            const sample = sampleFieldFloor(
              worldX, 
              worldZ, 
              collectorsRef.current, 
              specialCornersRef.current, 
              tileOverlaysRef.current,
              []
            );
            
            const isBlack = sample.color === 'black';
            const segment = new THREE.Mesh(segGeo, isBlack ? blackMat : whiteMat);
            segment.rotation.z = Math.PI / 2;
            segment.position.set(offset, 0, 0);
            segment.castShadow = true;
            segment.receiveShadow = true;
            bumperGroup.add(segment);
          }
          obstaclesGroup.add(bumperGroup);
        } else if (obs.type === 'box') {
          const bObs = obs as BoxObstacle;
          const geo = new THREE.BoxGeometry(bObs.width, bObs.height, bObs.depth);
          const mesh = new THREE.Mesh(geo, boxMaterials);
          mesh.position.set(bObs.x, bObs.height / 2, bObs.z);
          mesh.rotation.y = bObs.rotation || 0;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          obstaclesGroup.add(mesh);
        } else if (obs.type === 'ramp') {
          const rObs = obs as RampObstacle;
          // Triangle shape for the ramp's side profile (depth along X, height along Y)
          const shape = new THREE.Shape();
          shape.moveTo(-rObs.depth / 2, 0);
          shape.lineTo(rObs.depth / 2, rObs.height);
          shape.lineTo(rObs.depth / 2, 0);
          shape.lineTo(-rObs.depth / 2, 0);

          const extrudeSettings = {
            depth: rObs.width,
            bevelEnabled: false
          };

          const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          geo.center(); // Perfect built-in centering along all 3 axes!
          const rampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0 });
          const mesh = new THREE.Mesh(geo, rampMat);

          // Rotate to align width with X and depth with Z
          mesh.rotation.y = -Math.PI / 2;
          mesh.position.set(0, rObs.height / 2, 0); // Position it to sit perfectly on the floor

          const rampGroup = new THREE.Group();
          rampGroup.position.set(rObs.x, 0, rObs.z);
          rampGroup.rotation.y = rObs.rotation || 0;
          rampGroup.add(mesh);
          
          // Add centered black line 18 mm wide
          const slopeLength = Math.sqrt(rObs.depth * rObs.depth + rObs.height * rObs.height);
          const slopeAngle = Math.atan2(rObs.height, rObs.depth);
          const lineGeo = new THREE.BoxGeometry(1.8, 0.05, slopeLength);
          const lineMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.9,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
          });
          const lineMesh = new THREE.Mesh(lineGeo, lineMat);
          lineMesh.position.set(0, rObs.height / 2 + 0.03, 0);
          lineMesh.rotation.x = -slopeAngle;
          rampGroup.add(lineMesh);
          
          obstaclesGroup.add(rampGroup);
        } else if (obs.type === 'platform') {
          const pObs = obs as PlatformObstacle;
          const platformGroup = new THREE.Group();
          platformGroup.position.set(pObs.x, 0, pObs.z);
          platformGroup.rotation.y = pObs.rotation || 0;

          const geo = new THREE.BoxGeometry(pObs.width, pObs.height, pObs.depth);
          const platformMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0 });
          const mesh = new THREE.Mesh(geo, platformMat);
          mesh.position.set(0, pObs.height / 2, 0);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          platformGroup.add(mesh);
          
          // Aggiungiamo bordi neri per rendere chiaro dove inizia/finisce il pianerottolo rispetto alla rampa
          const edges = new THREE.EdgesGeometry(geo);
          const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
          line.position.set(0, pObs.height / 2, 0);
          platformGroup.add(line);
          
          // Aggiungiamo linea nera centrale da 18 mm (1.8 cm) come richiesto
          const pLineGeo = new THREE.BoxGeometry(1.8, 0.06, pObs.depth);
          const pLineMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.9,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
          });
          const pLineMesh = new THREE.Mesh(pLineGeo, pLineMat);
          pLineMesh.position.set(0, pObs.height + 0.03, 0);
          pLineMesh.castShadow = true;
          pLineMesh.receiveShadow = true;
          platformGroup.add(pLineMesh);

          obstaclesGroup.add(platformGroup);
        } else if (obs.type === 'seesaw') {
          const sObs = obs as SeesawObstacle;
          const seesawGroup = new THREE.Group();
          seesawGroup.position.set(sObs.x, 0, sObs.z);
          seesawGroup.rotation.y = sObs.rotation || 0;
          seesawGroup.name = `seesaw_${sObs.id}`;

          // Support Pillars (Colonnine) - placed centered on the sides of the tile (which is 30x30 cm)
          const colGeo = new THREE.CylinderGeometry(0.5, 0.5, 5.5, 8);
          const colMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });

          const leftCol = new THREE.Mesh(colGeo, colMat);
          leftCol.position.set(-15, 5.5 / 2, 0); // 30cm wide tile, placed at -15cm
          leftCol.castShadow = true;
          leftCol.receiveShadow = true;
          seesawGroup.add(leftCol);

          const rightCol = new THREE.Mesh(colGeo, colMat);
          rightCol.position.set(15, 5.5 / 2, 0); // and +15cm
          rightCol.castShadow = true;
          rightCol.receiveShadow = true;
          seesawGroup.add(rightCol);

          // Support bar / axle at height 5.5cm running through the center
          const axGeo = new THREE.CylinderGeometry(0.25, 0.25, 30, 8);
          const axMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
          const axle = new THREE.Mesh(axGeo, axMat);
          axle.rotation.z = Math.PI / 2;
          axle.position.set(0, 5.5, 0);
          axle.castShadow = true;
          axle.receiveShadow = true;
          seesawGroup.add(axle);

          // Rotating Platform (same size as a normal tile: 30x30 cm)
          const rotatingPart = new THREE.Group();
          rotatingPart.name = "rotatingPart";
          rotatingPart.position.set(0, 5.5, 0); 

          const boardThickness = 0.4;
          const boardGeo = new THREE.BoxGeometry(30, boardThickness, 30);
          const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0 });
          const boardMesh = new THREE.Mesh(boardGeo, boardMat);
          boardMesh.position.set(0, 0, 0);
          boardMesh.castShadow = true;
          boardMesh.receiveShadow = true;
          rotatingPart.add(boardMesh);

          // Central guide line 1.8 cm wide, matching normal lines
          const lineGeo = new THREE.BoxGeometry(1.8, 0.05, 30);
          const lineMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.9,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
          });
          const lineMesh = new THREE.Mesh(lineGeo, lineMat);
          lineMesh.position.set(0, boardThickness / 2 + 0.02, 0);
          lineMesh.castShadow = true;
          lineMesh.receiveShadow = true;
          rotatingPart.add(lineMesh);

          seesawGroup.add(rotatingPart);
          obstaclesGroup.add(seesawGroup);
        } else if (obs.type === 'checkpoint') {
          const cp = obs as CheckpointObstacle;
          const radius = cp.radius || 2.5;
          const height = cp.height || 0.7;
          
          const checkpointGeo = new THREE.CylinderGeometry(radius, radius, height, 32);
          const checkpointMat = new THREE.MeshStandardMaterial({
            color: 0xff7f00, // beautiful orange
            roughness: 0.5,
            metalness: 0.1
          });
          const checkpointMesh = new THREE.Mesh(checkpointGeo, checkpointMat);
          checkpointMesh.position.set(cp.x, height / 2, cp.z);
          checkpointMesh.castShadow = true;
          checkpointMesh.receiveShadow = true;
          
          obstaclesGroup.add(checkpointMesh);
        } else if (obs.type === 'green_marker') {
          const gm = obs as GreenMarkerObstacle;
          const w = gm.width || 2.5;
          const d = gm.depth || 2.5;
          const h = gm.height || 0.2;
          
          const markerGeo = new THREE.BoxGeometry(w, h, d);
          const markerMat = new THREE.MeshStandardMaterial({
            color: 0x22c55e, // beautiful green
            roughness: 0.6,
            metalness: 0.1
          });
          const markerMesh = new THREE.Mesh(markerGeo, markerMat);
          markerMesh.position.set(gm.x, h / 2, gm.z);
          markerMesh.rotation.y = gm.rotation || 0;
          markerMesh.castShadow = true;
          markerMesh.receiveShadow = true;
          
          obstaclesGroup.add(markerMesh);
        }
      });
      // Hash ignores dynamic angles
      obstaclesGroup.userData.hash = JSON.stringify(obstaclesList, (key, val) => {
        if (key === 'currentAngle') return undefined;
        return val;
      }) + JSON.stringify(tileOverlaysRef.current);
    };

    // Initial update
    updateOverlays();
    updateObstaclesVisibility();

    // --- ANIMATION FRAME ENGINE TICK ---
    let animFrameId: number;
    let lastTime = performance.now();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const frameDt = Math.min(0.1, (now - lastTime) / 1000); // capped at 100ms
      lastTime = now;

      // Check if overlays need update
      const currentOverlayHash = JSON.stringify(tileOverlaysRef.current);
      if (overlaysGroup.userData.hash !== currentOverlayHash) {
        updateOverlays();
      }

      // Check if obstacles need update
      const currentObstacleHash = JSON.stringify(obstaclesRef.current, (key, value) => {
        if (key === 'currentAngle') return undefined;
        return value;
      }) + currentOverlayHash;
      if (obstaclesGroup.userData.hash !== currentObstacleHash) {
        updateObstaclesVisibility();
      }

      // Smoothly update visual rotations of seesaw platforms
      if (obstaclesRef.current) {
        obstaclesRef.current.forEach(obs => {
          if (obs.type === 'seesaw') {
            const seesawMesh = obstaclesGroup.getObjectByName(`seesaw_${obs.id}`);
            if (seesawMesh) {
              const rotPart = seesawMesh.getObjectByName("rotatingPart");
              if (rotPart) {
                // Pitch rotating component about the pivot axis (local X-axis)
                rotPart.rotation.x = -(obs.currentAngle ?? Math.asin(5.5 / 15));
              }
            }
          }
        });
      }

      const rState = robotStateRef.current;
      const sStateList = spheresStateRef.current;

      // 1. Update Robot 3D Position and Visibility
      robotGroup.visible = !isDesignModeRef.current;
      bordersGroup.visible = isDesignModeRef.current;
      robotGroup.position.set(rState.x, rState.y, rState.z);
      robotGroup.rotation.y = rState.angle;
      robotGroup.rotation.x = rState.pitch ?? 0;
      robotGroup.rotation.z = rState.roll ?? 0;

      // Spin wheels based on differential speeds (incorporating both linear speed and angular turning speed)
      // trackWidth = 18.0 inside chassis space. Right wheels represent IDX 0 and 2. Left wheels represent IDX 1 and 3.
      const vRight = rState.speed + (rState.angularSpeed ?? 0) * 9.0;
      const vLeft = rState.speed - (rState.angularSpeed ?? 0) * 9.0;

      // Wheel radius in cylinder size is 3.2. Angular velocity is rad_s = linearSpeed / radius.
      const spinRight = (vRight / 3.2) * frameDt;
      const spinLeft = (vLeft / 3.2) * frameDt;

      wheels.forEach((w, idx) => {
        const spinAngle = (idx === 0 || idx === 2) ? spinRight : spinLeft;
        w.rotation.x = (w.rotation.x + spinAngle) % (Math.PI * 2);
      });

      // Update arm Carriage Lift
      // Height Y varies based on armHeight (0 to 1) 
      const liftY = 3.0 + rState.armHeight * 15.0;
      carriageGroup.position.set(0, liftY, 5.9);

      // Update Pinza Claw Width (opening and closing)
      // clawOpen is 0 (closed) to 1 (fully open)
      // Adjust fingers X-offset: when closed, finger prongs pinch closer
      const fingerShift = 1 + rState.clawOpen * 5.0;
      lFinger.position.x = -fingerShift;
      rFinger.position.x = fingerShift;

      // Update LuceColSx and LuceColDx lateral positions
      const lateralOff = rState.sensorLateralOffset || 1.8;
      sxHolder.position.x = -lateralOff;
      dxHolder.position.x = lateralOff;

      // Update Color Sensor 1 visual feedback (Front Forward Sensor)
      const fwdCol = rState.detectedColor;
      let fwdHex = 0xffffff;
      let intensity = 0.1;
      let showBeam = false;

      if (fwdCol === 'green') { fwdHex = 0x10b981; intensity = 1.5; showBeam = true; }
      else if (fwdCol === 'red') { fwdHex = 0xef4444; intensity = 1.5; showBeam = true; }
      else if (fwdCol === 'silver') { fwdHex = 0xe2e8f0; intensity = 1.2; showBeam = true; }
      else if (fwdCol === 'black') { fwdHex = 0x1e293b; intensity = 0.05; showBeam = false; }
      else { fwdHex = 0xffffff; intensity = 0.2; showBeam = true; }

      colorSensorMat.color.setHex(fwdHex);
      colorSensorMat.emissive.setHex(fwdHex);
      colorSensorMat.emissiveIntensity = intensity;
      
      fwdBeamMat.color.setHex(fwdHex);
      fwdBeamMat.opacity = showBeam ? (fwdCol === 'white' ? 0.05 : 0.4) : 0;

      // Update LuceColSx (Left Sensor) lens visual feedback
      const sxColVal = rState.luceColSxColor;
      let sxHex = 0xffffff;
      if (sxColVal === 'green') sxHex = 0x10b981;
      else if (sxColVal === 'red') sxHex = 0xef4444;
      else if (sxColVal === 'black') sxHex = 0x1e293b;
      else if (sxColVal === 'silver') sxHex = 0xe2e8f0;
      
      luceColSxLensMat.color.setHex(sxHex);
      luceColSxLensMat.emissive.setHex(sxHex);
      luceColSxLensMat.emissiveIntensity = sxColVal === 'black' ? 0.05 : (sxColVal === 'white' ? 0.3 : 2.5);

      // Update Left Beam
      sxBeamMat.color.setHex(sxHex);
      sxBeamMat.opacity = sxColVal === 'black' ? 0.05 : (sxColVal === 'white' ? 0.25 : 0.85);

      // Update LuceColDx (Right Sensor) lens visual feedback
      const dxColVal = rState.luceColDxColor;
      let dxHex = 0xffffff;
      if (dxColVal === 'green') dxHex = 0x10b981;
      else if (dxColVal === 'red') dxHex = 0xef4444;
      else if (dxColVal === 'black') dxHex = 0x1e293b;
      else if (dxColVal === 'silver') dxHex = 0xe2e8f0;
      
      luceColDxLensMat.color.setHex(dxHex);
      luceColDxLensMat.emissive.setHex(dxHex);
      luceColDxLensMat.emissiveIntensity = dxColVal === 'black' ? 0.05 : (dxColVal === 'white' ? 0.3 : 2.5);

      // Update Right Beam
      dxBeamMat.color.setHex(dxHex);
      dxBeamMat.opacity = dxColVal === 'black' ? 0.05 : (dxColVal === 'white' ? 0.25 : 0.85);

      // --- ANIMATE RED LED STATE ON/OFF ---
      let isRedLedOn = !!rState.ledRed;

      // Check if robot is on the "partenza" tile
      let isRobotOnPartenza = false;
      const robotX = rState.x;
      const robotZ = rState.z;
      
      if (tileOverlaysRef.current && tileOverlaysRef.current.length > 0) {
        isRobotOnPartenza = tileOverlaysRef.current.some(overlay => {
          const isPartenza = overlay.tileId === 'partenza' || 
                             (overlay.imageUrl && overlay.imageUrl.toLowerCase().includes('partenza')) ||
                             (overlay.name && overlay.name.toLowerCase() === 'partenza');
          if (!isPartenza) return false;
          
          const dx = robotX - overlay.x;
          const dz = robotZ - overlay.z;
          return Math.abs(dx) <= 15 && Math.abs(dz) <= 15;
        });
      }

      // Override with 5Hz blink if on the Partenza tile
      if (isRobotOnPartenza) {
        isRedLedOn = Math.floor(now / 100) % 2 === 0;
      }

      ledRedLensMat.emissiveIntensity = isRedLedOn ? 25.0 : 0.0; // Emissive intensity boosted to 25.0 (much brighter)
      ledRedLensMat.color.setHex(isRedLedOn ? 0xff3333 : 0x7f1d1d); // Shifting slightly towards vibrant red-white core when hot
      ledRedLight.intensity = isRedLedOn ? 40.0 : 0.0; // Point light intensity raised to 40.0 for strong surrounding red illumination

      // 2. Update Spheres 3D Positions
      sStateList.forEach((sVal) => {
        const matchingMesh = sphereMeshes[sVal.id - 1];
        if (matchingMesh) {
          matchingMesh.position.set(sVal.x, sVal.y, sVal.z);

          // Give realistic rolling visual rotation to moving spheres!
          if (!sVal.isHeld && (Math.abs(sVal.vx) > 0.1 || Math.abs(sVal.vz) > 0.1)) {
            const rotSpeedX = sVal.vz * 0.4;
            const rotSpeedZ = -sVal.vx * 0.4;
            matchingMesh.rotation.x = (matchingMesh.rotation.x + rotSpeedX * 0.05) % (Math.PI * 2);
            matchingMesh.rotation.z = (matchingMesh.rotation.z + rotSpeedZ * 0.05) % (Math.PI * 2);
          }
        }
      });

      // 3. Handle model updates on-the-fly dynamically
      const loadedMesh = customMeshRef.current;
      if (loadedMesh && chassiMesh === defaultChassis) {
        // Switch to loaded mesh!
        robotGroup.remove(defaultChassis);
        chassiMesh = loadedMesh;
        robotGroup.add(chassiMesh);
      } else if (!loadedMesh && chassiMesh !== defaultChassis) {
        // Revert back to default
        if (chassiMesh) robotGroup.remove(chassiMesh);
        chassiMesh = defaultChassis;
        robotGroup.add(chassiMesh);
      }

      // 4. Update camera mode locks
      const mode = cameraModeRef.current;
      if (mode === 'fpv') {
        // Lock camera directly looking forward from the robot carriage
        const forwardOffset = new THREE.Vector3(0, 16, 20);
        forwardOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rState.angle);
        camera.position.set(rState.x - forwardOffset.x * 0.6, rState.y + 20, rState.z - forwardOffset.z * 0.6);

        const lookAtTarget = new THREE.Vector3(
          rState.x + 50 * Math.sin(rState.angle),
          rState.y + 6,
          rState.z + 50 * Math.cos(rState.angle)
        );
        camera.lookAt(lookAtTarget);
      } else {
        // Both orbit and top mode use controls. Top mode is restricted via controls configuration.
        controls.update();
      }

      // 5. Debug physics overlay
      const showingPhysics = showPhysicsRef.current;
      debugGroup.visible = showingPhysics;
      if (showingPhysics) {
        // Update robot bounding box
        robotBB.scale.set(rState.width, 14, rState.length); // approximate 14cm height
        robotBB.position.set(rState.x, 7, rState.z);
        robotBB.rotation.y = rState.angle;

        // Ensure Obstacles (specialCorners) are correctly positioned
        specialCorners?.forEach((sc, i) => {
          if (obstGeos[i]) {
            obstGeos[i].position.set(sc.xCorner, 3, sc.zCorner);
          }
        });

        // Update sensor ray (pointing straight ahead from robot)
        const sensorDist = rState.sensorDistance < 1000 ? rState.sensorDistance : 0;
        const dirX = Math.sin(rState.angle);
        const dirZ = Math.cos(rState.angle);
        
        // Sensor start point: slightly ahead of the robot center
        const startX = rState.x + dirX * (rState.length / 2);
        const startZ = rState.z + dirZ * (rState.length / 2);
        const endX = startX + dirX * sensorDist;
        const endZ = startZ + dirZ * sensorDist;
        
        sensorGeo.setFromPoints([
          new THREE.Vector3(startX, 6, startZ),
          new THREE.Vector3(endX, 6, endZ)
        ]);
        (sensorLine.material as THREE.LineBasicMaterial).color.setHex(sensorDist > 0 && sensorDist < 1000 ? 0xff0000 : 0x00ff00);

        // Update spheres velocity vectors
        sStateList.forEach((s, idx) => {
          if (velArrows[idx]) {
             const velX = s.vx;
             const velZ = s.vz;
             const len = Math.sqrt(velX * velX + velZ * velZ);
             
             if (len > 0.1 && s.y < 3) { // Only show running velocities on the ground
               velArrows[idx].visible = true;
               velArrows[idx].position.set(s.x, s.y, s.z);
               const dir = new THREE.Vector3(velX/len, 0, velZ/len);
               velArrows[idx].setDirection(dir);
               velArrows[idx].setLength(len * 0.1, len > 5 ? 2 : 0, 1); // Scale visuals down by 0.1
             } else {
               velArrows[idx].visible = false;
             }
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Click/Pointer events for Teleporting Robot when simulation is not running
    let pointerStart = { x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: PointerEvent) => {
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate NDC
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      if (dist < 10) {
        if (isDesignModeRef.current) {
          // In design mode, click triggers tile selection
          // To be robust against clicking on top of obstacles/ramps, we intersect everything
          // and find the hit coordinates closest to the arena floor, mapping them to the nearest tile center.
          const intersects = raycaster.intersectObjects(scene.children, true);
          const arenaHit = intersects.find(intersect => {
            const p = intersect.point;
            // Look for any intersection point within the fully extended paved arena and room boundaries
            return p.x >= -250 && p.x <= 250 && p.z >= -250 && p.z <= 250;
          });

          if (arenaHit && onTileClickRef.current) {
            const pt = arenaHit.point;
            
            // X tile centers can extend to outer room centers
            const tx = Math.round(pt.x / 30) * 30;
            const clampedTx = Math.max(-240, Math.min(240, tx));
            
            // Z tile centers can extend to outer room centers
            const tz = Math.round((pt.z - 15) / 30) * 30 + 15;
            const clampedTz = Math.max(-255, Math.min(255, tz));

            onTileClickRef.current(clampedTx, clampedTz);
          }
        } else if (event.button === 2) {
          // Right click teleport in regular mode
          // To be robust against obstacles, we intersect everything and select any valid board surface click
          const intersects = raycaster.intersectObjects(scene.children, true);
          const arenaHit = intersects.find(intersect => {
            const p = intersect.point;
            return p.x >= -250 && p.x <= 250 && p.z >= -250 && p.z <= 250;
          });

          if (arenaHit && onTeleportRobotRef.current && statsStatusRef.current !== 'running') {
            const point = arenaHit.point;
            onTeleportRobotRef.current(point.x, point.z);
          }
        } else if (event.button === 0 && !isDesignModeRef.current) {
          if (statsStatusRef.current !== 'running' && onRotateRobotRef.current) {
            const intersects = raycaster.intersectObjects([robotGroup], true);
            if (intersects.length > 0) {
              onRotateRobotRef.current(Math.PI / 2);
            }
          }
        }
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      if (statsStatusRef.current !== 'running') {
        event.preventDefault();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      cameraRef.current = null;
      controlsRef.current = null;
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [collectors, specialCorners]);

  // Handle Drag-and-drop file upload events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setLoadError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      try {
        const loaded = await parseModelFile(file);
        onUploadCustomMesh(loaded.mesh, loaded.name);
      } catch (err: any) {
        setLoadError(err?.message || "Impossibile caricare il file.");
      }
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoadError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        onUploadCustomMesh(null, ""); // Clear previous first
        const loaded = await parseModelFile(file);
        onUploadCustomMesh(loaded.mesh, loaded.name);
      } catch (err: any) {
        setLoadError(err?.message || "Impossibile caricare il file.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden group">
      {/* 3D Simulation Controls overlay */}
      <div className="absolute bottom-6 left-3 z-10 flex gap-2 select-none">
        <button
          onClick={() => setCameraMode('orbit')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow ${
            cameraMode === 'orbit'
              ? 'bg-white text-black border-2 border-slate-900 shadow-md scale-105'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200 opacity-80 hover:opacity-100'
          }`}
        >
          Vista 3D
        </button>
        <button
          onClick={() => setCameraMode('fpv')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow ${
            cameraMode === 'fpv'
              ? 'bg-white text-black border-2 border-slate-900 shadow-md scale-105'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200 opacity-80 hover:opacity-100'
          } ${isDesignMode ? 'hidden' : ''}`}
        >
          Robot
        </button>
        <button
          onClick={() => setCameraMode('top')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow ${
            cameraMode === 'top'
              ? 'bg-white text-black border-2 border-slate-900 shadow-md scale-105'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200 opacity-80 hover:opacity-100'
          }`}
        >
          Dall'alto
        </button>
      </div>

      {/* Sensor/Timer HUD Column Stack */}
      {!isDesignMode && (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2.5 w-56 pointer-events-auto select-none">
          {/* Time Countdown Window "Tempo" */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2 text-xs text-white shadow-lg">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase border-b border-slate-900 pb-1">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              Tempo
            </div>
            <div className="flex justify-between items-center rounded text-[11px] bg-slate-900/80 px-2.5 py-1.5 shadow-inner">
              <span className="text-slate-400 font-medium">Conto alla rovescia:</span>
              <span className="font-bold text-emerald-300 font-mono text-sm leading-none">
                {(() => {
                  const m = Math.floor(countdownSeconds / 60);
                  const s = Math.floor(countdownSeconds % 60);
                  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                })()}
              </span>
            </div>
          </div>

          {/* On-board Sensors Window "Sensori di Bordo" */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2 text-xs text-white shadow-lg">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase border-b border-slate-900 pb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              Sensori di Bordo
            </div>
            <div className="flex justify-between items-center rounded text-[11px] bg-slate-900/80 px-2 py-1 shadow-inner">
              <span className="text-slate-400 font-medium">Distanza Frontale:</span>
              <span className="font-bold text-emerald-300 font-mono text-xs">{robotState.sensorDistance ? robotState.sensorDistance.toFixed(1) : '255.0'} cm</span>
            </div>
            <div className="flex justify-between items-center rounded text-[11px] bg-slate-900/80 px-2 py-1 shadow-inner">
              <span className="text-slate-400 font-medium">Sensore Colore 1:</span>
              <span className={`font-bold font-mono text-xs uppercase ${
                robotState.detectedColor === 'green' ? 'text-emerald-400' : 
                robotState.detectedColor === 'red' ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {robotState.detectedColor}
              </span>
            </div>
            <div className="flex justify-between items-center rounded text-[11px] bg-slate-900/80 px-2 py-1 shadow-inner">
              <span className="text-slate-400 font-medium">Inclinazione Z:</span>
              <span className={`font-bold font-mono text-xs ${
                Math.abs(robotState.pitch || 0) > 0.05 ? 'text-amber-400' : 'text-amber-300/75'
              }`}>
                {((robotState.pitch || 0) * 180 / Math.PI).toFixed(1)}°
              </span>
            </div>
            <div className="flex justify-between items-center rounded text-[11px] bg-slate-900/80 px-2 py-1 shadow-inner">
              <span className="text-slate-400 font-medium">Orientamento Bussola:</span>
              <span className="font-bold text-sky-400 font-mono text-xs">
                {((robotState.angle * 180) / Math.PI).toFixed(0)}°
              </span>
            </div>

            <div className="flex flex-col gap-1 mt-1 border-t border-slate-900 pt-1.5">
              <div className="text-[9px] font-bold text-sky-400 uppercase tracking-wider mb-1">
                Sensori Luce & Linea
              </div>

              {/* Left Sensor (LuceColSx) */}
              <div className="flex justify-between items-center bg-slate-900/80 rounded px-2 py-1 shadow-inner gap-2">
                <span className="text-slate-400 text-[10px] font-medium grow text-left">LuceColSx (SX):</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className={`px-1 py-0.5 rounded text-[9px] uppercase font-extrabold ${
                    robotState.luceColSxColor === 'green' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40' :
                    robotState.luceColSxColor === 'red' ? 'bg-red-950/80 text-red-500 border border-red-800/40' :
                    robotState.luceColSxColor === 'black' ? 'bg-slate-950 text-slate-400 border border-slate-800' :
                    robotState.luceColSxColor === 'silver' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' :
                    'bg-slate-900 text-slate-300 border border-slate-800/60'
                  }`}>
                    {robotState.luceColSxColor || 'white'}
                  </span>
                  <span className="font-bold text-sky-300 text-[11px]">{(robotState.luceColSxLight || 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Right Sensor (LuceColDx) */}
              <div className="flex justify-between items-center bg-slate-900/80 rounded px-2 py-1 shadow-inner gap-2">
                <span className="text-slate-400 text-[10px] font-medium grow text-left">LuceColDx (DX):</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className={`px-1 py-0.5 rounded text-[9px] uppercase font-extrabold ${
                    robotState.luceColDxColor === 'green' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40' :
                    robotState.luceColDxColor === 'red' ? 'bg-red-950/80 text-red-500 border border-red-800/40' :
                    robotState.luceColDxColor === 'black' ? 'bg-slate-950 text-slate-400 border border-slate-800' :
                    robotState.luceColDxColor === 'silver' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' :
                    'bg-slate-900 text-slate-300 border border-slate-800/60'
                  }`}>
                    {robotState.luceColDxColor || 'white'}
                  </span>
                  <span className="font-bold text-sky-300 text-[11px]">{(robotState.luceColDxLight || 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Drag & Drop File Blocking Overlay */}
      {dragActive && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className="absolute inset-0 bg-indigo-950/85 border-4 border-dashed border-indigo-500 z-50 flex flex-col items-center justify-center p-8 text-center text-white"
        >
          <Upload className="w-16 h-16 text-indigo-400 animate-bounce mb-3" />
          <h3 className="text-lg font-bold">Rilascia il tuo modello robot 3D</h3>
          <p className="text-sm text-indigo-200 mt-1">Rilascia il file .glb, .stl o .obj per l'importazione immediata nel telaio del simulatore.</p>
        </div>
      )}

      {/* Mounting Node for 3D Renderer Canvas */}
      <div
        ref={mountRef}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        className="flex-1 w-full h-full bg-slate-950"
      />
    </div>
  );
}
