/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RobotState, SphereState, PhysicsParams, SimulationStats, CollectorState, SpecialCornerState, TileOverlay, Obstacle, BoxObstacle, CylindricalObstacle, RampObstacle, PlatformObstacle, SeesawObstacle, CheckpointObstacle, GreenMarkerObstacle } from './types';
import { updatePhysics, FIELD_WIDTH, FIELD_DEPTH, FIELD_HALF_W, FIELD_HALF_D, isInsideGreenCollector, isInsideRedCollector, getRobotEntrancePosition } from './utils/physics';
import Simulator3D from './components/Simulator3D';
import BlocklyEditor from './components/BlocklyEditor';
import { Sliders, RefreshCw, BarChart2, Activity, Play, Square, CircleHelp, AlertCircle, Info, ChevronRight, CheckCircle2, Navigation, Trash2, ShieldAlert, Code, Eye, Upload, Box, Download, Save, FolderOpen, Edit, FilePlus, Triangle } from 'lucide-react';
import { parseModelFile } from './utils/modelLoader';
import { AVAILABLE_TILES } from './tiles';

const INITIAL_ROBOT_STATE: RobotState = {
  x: -30,
  z: -75, // Start on the outer starting tile in front of the entrance
  y: 0,
  angle: 0, // Facing South (inwards, towards +Z)
  speed: 0,
  angularSpeed: 0,
  armHeight: 0,
  clawOpen: 1, // Start open
  isGrippingId: null,
  width: 16,
  length: 16,
  height: 12,
  sensorDistance: 255, // Defaults to 255cm / out of range
  sensorLateralOffset: 1.8, // cm distance from center for LuceColSx/Dx
  detectedColor: 'white',
  luceColDxColor: 'white',
  luceColDxLight: 100, // Starts on white floor
  luceColSxColor: 'white',
  luceColSxLight: 100, // Starts on white floor
  ledRed: false,
  pitch: 0,
  roll: 0,
  rampClimbBlocked: false,
};

const INITIAL_SPHERES_STATE = (): SphereState[] => [
  { id: 1, x: -20, z: 10, y: 2.5, vx: 0, vz: 0, vy: 0, radius: 2.5, color: 'silver', isConductive: true, isHeld: false },
  { id: 2, x: 20, z: -10, y: 2.5, vx: 0, vz: 0, vy: 0, radius: 2.5, color: 'silver', isConductive: true, isHeld: false },
  { id: 3, x: 0, z: 25, y: 2.5, vx: 0, vz: 0, vy: 0, radius: 2.5, color: 'black', isConductive: false, isHeld: false },
];

const INITIAL_PHYSICS_PARAMS: PhysicsParams = {
  friction: 0.04,   // Sliding friction
  sphereFriction: 2.0, // Default sphere friction (high for sand)
  restitution: 0.55, // Bounce factor
  massRobot: 5.0,
  massSphere: 0.2,
  motorPower: 100,
  wheelFriction: 0.55, // Default traction/friction for robot wheels
};

const legacyAssets = [
  { id: 'none', name: 'Vuoto', url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=' },
  { id: 'straight', name: 'Rettilineo', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iNDciIHdpZHRoPSI2IiBoZWlnaHQ9IjEwMCIgZmlsbD0iYmxhY2siLz48L3N2Zz4=' },
  { id: 'curve', name: 'Curva', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTSAwIDUwIEEgNTAgNTAgMCAwIDEgNTAgMTAwIiBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjYiLz48L3N2Zz4=' },
  { id: 'cross', name: 'Incrocio', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iNDciIHdpZHRoPSI2IiBoZWlnaHQ9IjEwMCIgZmlsbD0iYmxhY2siLz48cmVjdCB5PSI0NyIgd2lkdGg9IjEwMCIgaGVpZ2h0PSI2IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==' },
  { id: 't-junction', name: 'T-Incrocio', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iNDciIHdpZHRoPSI2IiBoZWlnaHQ9IjEwMCIgZmlsbD0iYmxhY2siLz48cmVjdCB5PSI0NyIgeD0iNDciIHdpZHRoPSI1MyIgaGVpZ2h0PSI2IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==' },
];

const newTiles = AVAILABLE_TILES.map((filename, index) => {
  const name = filename.replace('.png', '').replace(/([A-Z])/g, ' $1').trim();
  return {
    id: `new-tile-${index}`,
    name,
    url: `/tiles/${filename}`
  };
});

const markers = [
  { id: 'green-marker', name: 'Marcatore Verde', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiMxMGI5ODEiLz48L3N2Zz4=' },
  { id: 'red-marker', name: 'Marcatore Rosso', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNlZjQ0NDQiLz48L3N2Zz4=' },
];

const TILE_ASSETS = [...legacyAssets, ...newTiles, ...markers];

export default function App() {
  // Navigation layout state
  const [activeView, setActiveView] = useState<'simulation' | 'programming' | 'design'>('simulation');
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(false);
  const [showPhysics, setShowPhysics] = useState<boolean>(false);

  // Simulator states
  const [robotState, setRobotState] = useState<RobotState>(INITIAL_ROBOT_STATE);
  const [spheresState, setSpheresState] = useState<SphereState[]>(INITIAL_SPHERES_STATE());
  const [physicsParams, setPhysicsParams] = useState<PhysicsParams>(INITIAL_PHYSICS_PARAMS);
  const [collectors, setCollectors] = useState<CollectorState[]>(() => {
    const saved = localStorage.getItem('rescue-line-collectors');
    return saved ? JSON.parse(saved) : [
      { color: 'green', xCorner: -45, zCorner: 60, size: 30, wallHeight: 6 },
      { color: 'red', xCorner: 45, zCorner: 60, size: 30, wallHeight: 6 },
    ];
  });
  const [specialCorners, setSpecialCorners] = useState<SpecialCornerState[]>(() => {
    const saved = localStorage.getItem('rescue-line-special-corners');
    return saved ? JSON.parse(saved) : [
      { type: 'entrance', xCorner: -45, zCorner: -60, size: 30, missingWall: 'x' },
      { type: 'exit', xCorner: 45, zCorner: -60, size: 30, missingWall: 'z' },
    ];
  });
  const [obstacles, setObstacles] = useState<Obstacle[]>(() => {
    const saved = localStorage.getItem('rescue-line-obstacles');
    const list: Obstacle[] = saved ? JSON.parse(saved) : [];
    // Filter out obstacles that might be outside the field due to previous bugs
    return list.filter(o => 
      o.x >= -50 && o.x <= 50 && o.z >= -75 && o.z <= 75
    );
  });
  const [stats, setStats] = useState<SimulationStats>({
    scoreGreen: 0,
    scoreRed: 0,
    incorrectDeposits: 0,
    timeSeconds: 0,
    status: 'idle',
  });
  const [countdownSeconds, setCountdownSeconds] = useState<number>(480);

  const [tileOverlays, setTileOverlays] = useState<TileOverlay[]>(() => {
    const saved = localStorage.getItem('rescue-line-tiles');
    return saved ? JSON.parse(saved) : [];
  });
  const [customTileAssets, setCustomTileAssets] = useState<{ id: string, name: string, url: string }[]>(() => {
    const saved = localStorage.getItem('rescue-line-custom-assets');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedTile, setSelectedTile] = useState<{ x: number, z: number } | null>(null);

  // Slots management
  const [activeSlot, setActiveSlot] = useState<number>(0);

  // Refs
  const tileFileInputRef = useRef<HTMLInputElement>(null);
  const configImportInputRef = useRef<HTMLInputElement>(null);

  // Modal Dragging Refs
  const modalDivRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, posX: 0, posY: 0 });

  // Custom 3D mesh elements loaded from .glb / .stl etc.
  const [customMesh, setCustomMesh] = useState<THREE.Group | THREE.Mesh | null>(null);
  const [customMeshName, setCustomMeshName] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Blockly interpreter and commands variables
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>(["Simulatore inizializzato.", "Caricato programma Blockly predefinito."]);
  const [initialBlocklyXml, setInitialBlocklyXml] = useState<string>("");

  // Command Execution Refs for async control
  const activeRunIdRef = useRef<number>(0);
  const latestCodeRef = useRef<string>('');
  const robotRef = useRef<RobotState>(robotState);
  const spheresRef = useRef<SphereState[]>(spheresState);
  const statsRef = useRef<SimulationStats>(stats);
  const lastManualPositionRef = useRef<{ x: number; z: number; angle: number }>({
    x: INITIAL_ROBOT_STATE.x,
    z: INITIAL_ROBOT_STATE.z,
    angle: INITIAL_ROBOT_STATE.angle
  });

  // Targets for active movement and actions
  const activeMoveTargetRef = useRef<{
    startX: number;
    startZ: number;
    distance: number;
    direction: 'FORWARD' | 'BACKWARD';
    resolve: () => void;
    timeoutId: NodeJS.Timeout;
    accumulatedDistance: number;
  } | null>(null);

  const activeTurnTargetRef = useRef<{
    startAngle: number;
    targetAngleDiff: number; // in radians
    resolve: () => void;
    timeoutId: NodeJS.Timeout;
    lastAngle: number;
    accumulatedAngle: number;
  } | null>(null);

  const activeArmTargetRef = useRef<{
    targetHeight: number;
    resolve: () => void;
    timer: number;
  } | null>(null);

  const activeClawTargetRef = useRef<{
    targetOpen: number;
    resolve: () => void;
    timer: number;
  } | null>(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('rescue-line-tiles', JSON.stringify(tileOverlays));
  }, [tileOverlays]);

  useEffect(() => {
    localStorage.setItem('rescue-line-custom-assets', JSON.stringify(customTileAssets));
  }, [customTileAssets]);

  useEffect(() => {
    localStorage.setItem('rescue-line-collectors', JSON.stringify(collectors));
  }, [collectors]);

  useEffect(() => {
    localStorage.setItem('rescue-line-special-corners', JSON.stringify(specialCorners));
  }, [specialCorners]);

  useEffect(() => {
    localStorage.setItem('rescue-line-obstacles', JSON.stringify(obstacles));
  }, [obstacles]);

  // Initial load is now handled directly matching other useState initializers to prevent mount overwrites
  useEffect(() => {
    // Redundant on-mount localStorage overrides removed
  }, []);

  useEffect(() => {
    if (!isRunning) {
      spheresRef.current = spheresState;
    }
  }, [spheresState, isRunning]);

  const physicsParamsRef = useRef<PhysicsParams>(physicsParams);
  const collectorsRef = useRef<CollectorState[]>(collectors);
  const specialCornersRef = useRef<SpecialCornerState[]>(specialCorners);
  const tileOverlaysRef = useRef<TileOverlay[]>(tileOverlays);
  const obstaclesRef = useRef<Obstacle[]>(obstacles);

  useEffect(() => {
    physicsParamsRef.current = physicsParams;
  }, [physicsParams]);

  useEffect(() => {
    collectorsRef.current = collectors;
  }, [collectors]);

  useEffect(() => {
    specialCornersRef.current = specialCorners;
  }, [specialCorners]);

  useEffect(() => {
    tileOverlaysRef.current = tileOverlays;
  }, [tileOverlays]);

  useEffect(() => {
    obstaclesRef.current = obstacles;
  }, [obstacles]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // Reset selected tile when switching views to ensure design mode always starts with tile choice first
  useEffect(() => {
    setSelectedTile(null);
  }, [activeView]);

  // Log writers
  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev.slice(0, 39)]); // Keep last 40 logs
  };

  // --- SCORE CALCULATOR ENGINE CHECK ---
  const checkScores = (spheres: SphereState[]) => {
    let updateNeeded = false;
    let newScoreGreen = 0;
    let newScoreRed = 0;
    let newIncorrect = 0;

    const nextSpheres = spheres.map((s) => {
      const nextS = { ...s };

      // Determine correct scoring condition
      const inGreen = isInsideGreenCollector(s.x, s.z, collectors);
      const inRed = isInsideRedCollector(s.x, s.z, collectors);

      if (inGreen && !s.isHeld && s.y <= 2.6) {
        if (s.color === 'silver') {
          newScoreGreen++;
          if (s.scoreStatus !== 'green') {
            nextS.scoreStatus = 'green';
            updateNeeded = true;
            addLog(`🟢 Sfera ARGENTATA (Conduttiva) depositata nel raccoglitore VERDE! (+1 punto)`);
          }
        } else if (s.color === 'black') {
          newIncorrect++;
          if (s.scoreStatus !== 'green') {
            nextS.scoreStatus = 'green';
            updateNeeded = true;
            addLog(`⚠️ Errore! Sfera NERA depositata nel raccoglitore VERDE.`);
          }
        }
      } else if (inRed && !s.isHeld && s.y <= 2.6) {
        if (s.color === 'black') {
          newScoreRed++;
          if (s.scoreStatus !== 'red') {
            nextS.scoreStatus = 'red';
            updateNeeded = true;
            addLog(`🔴 Sfera NERA (Isolata) depositata nel raccoglitore ROSSO! (+1 punto)`);
          }
        } else if (s.color === 'silver') {
          newIncorrect++;
          if (s.scoreStatus !== 'red') {
            nextS.scoreStatus = 'red';
            updateNeeded = true;
            addLog(`⚠️ Errore! Sfera ARGENTATA depositata nel raccoglitore ROSSO.`);
          }
        }
      } else {
        // Outside bins
        if (s.scoreStatus && s.scoreStatus !== 'none') {
          addLog(`ℹ️ Sfera rimossa da un raccoglitore.`);
          nextS.scoreStatus = 'none';
          updateNeeded = true;
        }
      }

      return nextS;
    });

    // Re-tally static score lines in case of multiple state rolls
    let finalScoreG = 0;
    let finalScoreR = 0;
    let finalIncorrect = 0;
    nextSpheres.forEach(s => {
      const inG = isInsideGreenCollector(s.x, s.z, collectors);
      const inR = isInsideRedCollector(s.x, s.z, collectors);
      if (inG && !s.isHeld && s.y <= 2.6) {
        if (s.color === 'silver') finalScoreG++;
        else finalIncorrect++;
      } else if (inR && !s.isHeld && s.y <= 2.6) {
        if (s.color === 'black') finalScoreR++;
        else finalIncorrect++;
      }
    });

    if (
      updateNeeded ||
      statsRef.current.scoreGreen !== finalScoreG ||
      statsRef.current.scoreRed !== finalScoreR ||
      statsRef.current.incorrectDeposits !== finalIncorrect
    ) {
      setStats((prev) => ({
        ...prev,
        scoreGreen: finalScoreG,
        scoreRed: finalScoreR,
        incorrectDeposits: finalIncorrect,
      }));
      setSpheresState(nextSpheres);
    }
  };

  // --- PHYSICS SIMULATION TICK HEARTBEAT (60 FPS) ---
  useEffect(() => {
    const dt = 1 / 60; // Tick timestep in seconds
    const interval = setInterval(() => {
      const activePhysicsParams = physicsParamsRef.current;
      const activeCollectors = collectorsRef.current;
      const activeSpecialCorners = specialCornersRef.current;
      const activeTileOverlays = tileOverlaysRef.current;
      const activeObstacles = obstaclesRef.current;

      if (!isRunning) {
        // Continuous sensor sampling even when paused/idle
        let robot = { ...robotRef.current };
        let spheres = spheresRef.current.map(s => ({ ...s }));

        // Align robot perfectly if placed on a "partenza" tile while simulation is idle/paused
        if (activeTileOverlays && activeTileOverlays.length > 0) {
          const partenzaTile = activeTileOverlays.find(overlay => {
            const isPartenza = overlay.tileId === 'partenza' || 
                               (overlay.imageUrl && overlay.imageUrl.toLowerCase().includes('partenza')) ||
                               (overlay.name && overlay.name.toLowerCase() === 'partenza');
            if (!isPartenza) return false;
            const dx = robot.x - overlay.x;
            const dz = robot.z - overlay.z;
            return Math.abs(dx) <= 15 && Math.abs(dz) <= 15;
          });
          if (partenzaTile) {
            const targetRot = (partenzaTile.rotation || 0) + Math.PI;
            if (
              Math.abs(robot.x - partenzaTile.x) > 0.05 ||
              Math.abs(robot.z - partenzaTile.z) > 0.05 ||
              Math.abs(robot.angle - targetRot) > 0.05
            ) {
              robot.x = partenzaTile.x;
              robot.z = partenzaTile.z;
              robot.angle = targetRot;
              lastManualPositionRef.current = {
                x: robot.x,
                z: robot.z,
                angle: robot.angle,
              };
              addLog(`📍 Robot allineato perfettamente al centro della piastrella Partenza.`);
            }
          }
        }

        const { nextRobot } = updatePhysics(
          robot,
          spheres,
          activePhysicsParams,
          0,
          activeCollectors,
          activeSpecialCorners,
          activeTileOverlays,
          activeObstacles
        );
        
        if (
          nextRobot.x !== robotRef.current.x ||
          nextRobot.z !== robotRef.current.z ||
          nextRobot.angle !== robotRef.current.angle ||
          nextRobot.detectedColor !== robotRef.current.detectedColor ||
          nextRobot.luceColSxColor !== robotRef.current.luceColSxColor ||
          nextRobot.luceColDxColor !== robotRef.current.luceColDxColor ||
          nextRobot.luceColSxLight !== robotRef.current.luceColSxLight ||
          nextRobot.luceColDxLight !== robotRef.current.luceColDxLight ||
          nextRobot.sensorDistance !== robotRef.current.sensorDistance
        ) {
          setRobotState(nextRobot);
          robotRef.current = nextRobot;
        }
        return;
      }

      // 1. Collect current states
      let robot = { ...robotRef.current };
      robot.prevClawOpen = robotRef.current.clawOpen;
      let spheres = spheresRef.current.map(s => ({ ...s }));

      // 2. Perform command interpolation inside physics loop to allow smooth motor tracking
      // Arm Height Interpolation (Smooth raise/lower arm)
      if (activeArmTargetRef.current) {
        const target = activeArmTargetRef.current.targetHeight;
        const diffHeight = target - robot.armHeight;
        if (Math.abs(diffHeight) > 0.05) {
          robot.armHeight += Math.sign(diffHeight) * 2.0 * dt; // speed 2 units/sec
        } else {
          robot.armHeight = target;
          // Action completed, resolve waiting thread
          const r = activeArmTargetRef.current.resolve;
          activeArmTargetRef.current = null;
          r();
        }
      }

      // Claw Closed/Open Interpolation
      if (activeClawTargetRef.current) {
        const target = activeClawTargetRef.current.targetOpen;
        const diffClaw = target - robot.clawOpen;
        if (Math.abs(diffClaw) > 0.08) {
          robot.clawOpen += Math.sign(diffClaw) * 3.5 * dt;
        } else {
          robot.clawOpen = target;
          const r = activeClawTargetRef.current.resolve;
          activeClawTargetRef.current = null;
          r();
        }
      }

      // Base Motor Movement Target Tracker
      if (activeMoveTargetRef.current) {
        const t = activeMoveTargetRef.current;
        
        // Drive motors with speed
        const speedFactor = (activePhysicsParams.motorPower / 100) * 45; // Max 45 cm/s
        robot.speed = t.direction === 'FORWARD' ? speedFactor : -speedFactor;

        // Accumulate distance based on wheel speed (wheels spin and slip on walls, encoders still count distance)
        t.accumulatedDistance += Math.abs(robot.speed) * dt;

        if (t.accumulatedDistance >= t.distance) {
          // Target hit!
          robot.speed = 0;
          clearTimeout(t.timeoutId);
          activeMoveTargetRef.current = null;
          t.resolve();
        }
      }

      // Steering Target Tracker
      if (activeTurnTargetRef.current) {
        const t = activeTurnTargetRef.current;
        
        let delta = robot.angle - t.lastAngle;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        
        t.accumulatedAngle += delta;
        t.lastAngle = robot.angle;

        if (Math.abs(t.accumulatedAngle) < Math.abs(t.targetAngleDiff)) {
          // Drive steering motor
          const turnSign = Math.sign(t.targetAngleDiff);
          const maxTurn = 2.4; // 2.4 rad/s
          robot.angularSpeed = turnSign * maxTurn;
        } else {
          // Rotation finished! Correct overshoot
          robot.angle = t.startAngle + t.targetAngleDiff;
          while (robot.angle > Math.PI) robot.angle -= 2 * Math.PI;
          while (robot.angle < -Math.PI) robot.angle += 2 * Math.PI;

          robot.angularSpeed = 0;
          clearTimeout(t.timeoutId);
          activeTurnTargetRef.current = null;
          t.resolve();
        }
      }

      // 3. Compute next physics position matrices
      const { nextRobot, nextSpheres } = updatePhysics(
        robot,
        spheres,
        activePhysicsParams,
        dt,
        activeCollectors,
        activeSpecialCorners,
        activeTileOverlays,
        activeObstacles
      );

      if (nextRobot.clawWallHit) {
        addLog("⚠️ La pinza abbassata urta una parete (ruote in slittamento).");
        nextRobot.clawWallHit = false;
      }

      if (nextRobot.sphereSqueezeHit) {
        addLog("⚠️ Sferetta incastrata! (ruote in slittamento).");
        nextRobot.sphereSqueezeHit = false;
      }

      // 4. Update stats timers
      if (isRunning) {
        setStats((prev) => ({ ...prev, timeSeconds: prev.timeSeconds + dt }));
        setCountdownSeconds((prev) => Math.max(0, prev - dt));
      }

      // 5. Commit states
      setRobotState(nextRobot);
      setSpheresState(nextSpheres);
      robotRef.current = nextRobot;
      spheresRef.current = nextSpheres;

      // 6. Tally sorting scores
      checkScores(nextSpheres);

    }, 1000 * dt);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Auto-resize viewport when switching tabs or toggling telemetry sidebar panel
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 120);
    return () => clearTimeout(timer);
  }, [activeView, isTelemetryOpen]);

  // --- ASSEMBLY OF ROBOT ASYNC API CONTROLLERS FOR BLOCKLY CODE ---
  const stopAllMotors = () => {
    // Drive speeds to 0 immediately
    const stoppedState = { ...robotRef.current, speed: 0, angularSpeed: 0 };
    setRobotState(stoppedState);
    robotRef.current = stoppedState;

    // Clear targets
    if (activeMoveTargetRef.current) {
      clearTimeout(activeMoveTargetRef.current.timeoutId);
      activeMoveTargetRef.current = null;
    }
    if (activeTurnTargetRef.current) {
      clearTimeout(activeTurnTargetRef.current.timeoutId);
      activeTurnTargetRef.current = null;
    }
    if (activeArmTargetRef.current) activeArmTargetRef.current = null;
    if (activeClawTargetRef.current) activeClawTargetRef.current = null;
  };

  const buildRobotAPI = (runId: number) => {
    // Guards execution matching the active Run session
    const guardSession = () => {
      if (runId !== activeRunIdRef.current) {
        throw new Error("PROCESSO ANNULLATO: Sessione cambiata.");
      }
    };

    return {
      move: async (direction: 'FORWARD' | 'BACKWARD', distance: number) => {
        guardSession();
        stopAllMotors();
        addLog(`🤖 Comando: Muovi ${direction === 'FORWARD' ? 'avanti' : 'indietro'} di ${distance} cm.`);

        return new Promise<void>((resolve, reject) => {
          // Safety timeout in case robot gets wedged on a wall
          const timeoutId = setTimeout(() => {
            console.log("Movement timeout triggered.");
            stopAllMotors();
            resolve();
          }, 6000); // Max 6 seconds wait time limit

          activeMoveTargetRef.current = {
            startX: robotRef.current.x,
            startZ: robotRef.current.z,
            distance: distance,
            direction: direction,
            resolve: () => {
              try { guardSession(); resolve(); } catch(e) { reject(e); }
            },
            timeoutId,
            accumulatedDistance: 0,
          };
        });
      },

      turn: async (direction: 'LEFT' | 'RIGHT', angleDegrees: number) => {
        guardSession();
        stopAllMotors();
        addLog(`🤖 Comando: Ruota ${direction === 'LEFT' ? 'sinistra' : 'destra'} di ${angleDegrees}°`);

        const angleRad = (angleDegrees * Math.PI) / 180;
        const targetDiff = direction === 'LEFT' ? angleRad : -angleRad;

        return new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            console.log("Turn timeout triggered.");
            stopAllMotors();
            resolve();
          }, 4500); // Max 4.5 seconds

          activeTurnTargetRef.current = {
            startAngle: robotRef.current.angle,
            targetAngleDiff: targetDiff,
            resolve: () => {
              try { guardSession(); resolve(); } catch(e) { reject(e); }
            },
            timeoutId,
            lastAngle: robotRef.current.angle,
            accumulatedAngle: 0,
          };
        });
      },

      stop: async () => {
        guardSession();
        stopAllMotors();
        addLog(`🤖 Comando: Arresto motori.`);
      },

      setSpeed: async (percentage: number) => {
        guardSession();
        // Limit to bounds 5 to 100
        const power = Math.max(5, Math.min(100, percentage));
        setPhysicsParams((prev) => ({ ...prev, motorPower: power }));
        addLog(`🤖 Motori: Regolata potenza limitata al ${percentage}%.`);
      },

      setArm: async (action: 'UP' | 'DOWN') => {
        guardSession();
        addLog(`🤖 Braccio: Avvio corsa a livello ${action === 'UP' ? 'ALTO (Sopra 10cm)' : 'BASSO'}.`);
        const targetHeight = action === 'UP' ? 1.0 : 0.0;

        return new Promise<void>((resolve, reject) => {
          activeArmTargetRef.current = {
            targetHeight,
            resolve: () => {
              try {
                guardSession();
                addLog(`🤖 Braccio: Raggiunto livello ${action === 'UP' ? 'ALTO' : 'BASSO'}.`);
                resolve();
              } catch(e) {
                reject(e);
              }
            },
            timer: 0,
          };
        });
      },

      setClaw: async (action: 'OPEN' | 'CLOSE') => {
        guardSession();
        addLog(`🤖 Pinza: Azione di ${action === 'OPEN' ? 'APERTURA' : 'CHIUSURA / PRESA'}.`);
        const targetOpen = action === 'OPEN' ? 1.0 : 0.0;

        return new Promise<void>((resolve, reject) => {
          activeClawTargetRef.current = {
            targetOpen,
            resolve: () => {
              try { guardSession(); } catch(e) { reject(e); return; }
              addLog(`🤖 Pinza: Fine azione di ${action === 'OPEN' ? 'apertura' : 'serraggio'}.`);
              resolve();
            },
            timer: 0,
          };
        });
      },

      getDistance: async () => {
        guardSession();
        const r = robotRef.current;
        return Math.round(r.sensorDistance);
      },

      getPitch: async () => {
        guardSession();
        const r = robotRef.current;
        return Math.round((r.pitch || 0) * (180 / Math.PI));
      },

      getGroundColor: async () => {
        guardSession();
        return robotRef.current.detectedColor;
      },

      getLuceColSxColor: async () => {
        guardSession();
        return robotRef.current.luceColSxColor;
      },

      getLuceColSxLight: async () => {
        guardSession();
        return Math.round(robotRef.current.luceColSxLight);
      },

      getLuceColDxColor: async () => {
        guardSession();
        return robotRef.current.luceColDxColor;
      },

      getLuceColDxLight: async () => {
        guardSession();
        return Math.round(robotRef.current.luceColDxLight);
      },

      getSphereDistance: async () => {
        guardSession();
        const r = robotRef.current;
        const spheres = spheresRef.current;

        let minDist = 999;
        spheres.forEach((s) => {
          if (!s.isHeld) {
            const dx = s.x - r.x;
            const dz = s.z - r.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < minDist) minDist = d;
          }
        });

        return Math.round(minDist);
      },

      isSphereConductive: async () => {
        guardSession();
        const r = robotRef.current;
        const spheres = spheresRef.current;

        // If currently carrying a sphere, return its properties
        if (r.isGrippingId !== null) {
          const held = spheres.find(s => s.id === r.isGrippingId);
          return held ? held.isConductive : false;
        }

        // Else, find the closest sphere and return its conductivity
        let closest: SphereState | null = null;
        let minDist = 999;
        spheres.forEach((s) => {
          if (!s.isHeld) {
            const dx = s.x - r.x;
            const dz = s.z - r.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < minDist) {
              minDist = d;
              closest = s;
            }
          }
        });

        return closest ? (closest as SphereState).isConductive : false;
      },

      getSphereColor: async () => {
        guardSession();
        const r = robotRef.current;
        const spheres = spheresRef.current;

        if (r.isGrippingId !== null) {
          const held = spheres.find(s => s.id === r.isGrippingId);
          return held ? held.color : 'nessuno';
        }

        let closest: SphereState | null = null;
        let minDist = 999;
        spheres.forEach((s) => {
          if (!s.isHeld) {
            const dx = s.x - r.x;
            const dz = s.z - r.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < minDist) {
              minDist = d;
              closest = s;
            }
          }
        });

        return closest ? (closest as SphereState).color : 'nessuno';
      },

      wait: async (seconds: number) => {
        guardSession();
        addLog(`⏱️ Attesa: Messa in pausa cicli per ${seconds}s.`);
        return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            try { guardSession(); } catch(e) { reject(e); return; }
            resolve();
          }, seconds * 1000);
        });
      },
      setLedRed: async (state: 'ON' | 'OFF') => {
        guardSession();
        addLog(`🤖 LED Rosso: Impostazione su ${state === 'ON' ? 'ACCESO' : 'SPENTO'}.`);
        const ledOn = state === 'ON';
        setRobotState((prev) => ({ ...prev, ledRed: ledOn }));
        robotRef.current.ledRed = ledOn;
      },
    };
  };

  // --- PROGRAM INITIALIZER AND COMPILER EXECUTION SYSTEM ---
  const handleRunCode = async (jsCode: string) => {
    if (isRunning) return;

    if (!jsCode || jsCode.trim().startsWith('// Trascina un blocco')) {
      addLog("⚠️ Errore: Per eseguire, trascina un blocco 'All'avvio 🚀' nel foglio di lavoro.");
      setActiveView('programming');
      return;
    }

    // Create session token ID
    activeRunIdRef.current += 1;
    const currentSessionId = activeRunIdRef.current;

    // Halt any active motors and reset targets
    stopAllMotors();

    // Ensure the robot starts executing the code from its actual current position on the field
    const currentRobot = {
      ...robotRef.current,
      speed: 0,
      angularSpeed: 0,
    };
    robotRef.current = currentRobot;
    setRobotState(currentRobot);

    // Keep existing scores/spheres and just update the simulation status to running
    setStats((prev) => ({
      ...prev,
      status: 'running',
    }));

    setCountdownSeconds(480);
    setIsRunning(true);
    addLog(`🚀 Avvio programma dalla posizione attuale: (${Math.round(currentRobot.x)}, ${Math.round(currentRobot.z)})`);

    // Immediately return focus back to simulation screen to see the run live!
    setActiveView('simulation');

    // Build the async robot driving interface
    const robotAPI = buildRobotAPI(currentSessionId);

    // Build execution environment function
    const sandboxRunner = async (robot: typeof robotAPI) => {
      try {
        // Enclose custom code block inside sandbox async runner
        // The compiled javascript code uses `await robot.xxx`
        const userRoutine = new Function('robot', `return (async () => { 
          ${jsCode} 
        })();`);

        await userRoutine(robot);

        // Code finished!
        if (currentSessionId === activeRunIdRef.current) {
          addLog("🏁 Programma terminato con successo.");
          setIsRunning(false);
          setStats((prev) => ({ ...prev, status: 'idle' }));
          stopAllMotors();
        }
      } catch (err: any) {
        if (err?.message !== "PROCESSO ANNULLATO: Sessione cambiata.") {
          console.error("Interpreter crash:", err);
          addLog(`❌ Errore runtime: ${err?.message || err}`);
        }
        setIsRunning(false);
        setStats((prev) => ({ ...prev, status: 'idle' }));
        stopAllMotors();
      }
    };

    // Run custom code!
    sandboxRunner(robotAPI);
  };

  const handleStopCode = () => {
    activeRunIdRef.current += 1; // invalidate current session promises
    setIsRunning(false);
    setStats((prev) => ({ ...prev, status: 'paused' }));
    stopAllMotors();
    addLog("⏹️ Programma interrotto dall'utente.");
  };

  const handleResetArena = () => {
    // Halt any active runner
    activeRunIdRef.current += 1;
    setIsRunning(false);

    const defaultSpecialCorners: SpecialCornerState[] = [
      { type: 'entrance', xCorner: -45, zCorner: -60, size: 30, missingWall: Math.random() < 0.5 ? 'x' : 'z' },
      { type: 'exit', xCorner: 45, zCorner: -60, size: 30, missingWall: Math.random() < 0.5 ? 'x' : 'z' },
    ];
    setSpecialCorners(defaultSpecialCorners);

    const robotPlacement = getRobotEntrancePosition(defaultSpecialCorners);
    const newRobotState = {
      ...INITIAL_ROBOT_STATE,
      x: robotPlacement.x,
      z: robotPlacement.z,
      angle: robotPlacement.angle,
    };
    setRobotState(newRobotState);
    robotRef.current = newRobotState;
    lastManualPositionRef.current = {
      x: robotPlacement.x,
      z: robotPlacement.z,
      angle: robotPlacement.angle,
    };

    const initialSpheres = INITIAL_SPHERES_STATE();
    setSpheresState(initialSpheres);
    spheresRef.current = initialSpheres;
    setCollectors([
      { color: 'green', xCorner: -45, zCorner: 60, size: 30, wallHeight: 6 },
      { color: 'red', xCorner: 45, zCorner: 60, size: 30, wallHeight: 6 },
    ]);
    setStats({
      scoreGreen: 0,
      scoreRed: 0,
      incorrectDeposits: 0,
      timeSeconds: 0,
      status: 'idle',
    });
    setCountdownSeconds(480);
    setPhysicsParams(INITIAL_PHYSICS_PARAMS);
    stopAllMotors();
    setLogs(["Simulazione e punteggi azzerati correttamente."]);
  };

  const handleRandomizeArena = () => {
    // Halt any active runner
    activeRunIdRef.current += 1;
    setIsRunning(false);

    // Clear all tile drawings, selections and bumpers before regenerating layout
    setTileOverlays([]);
    setObstacles([]);
    setSelectedTile(null);

    // 1. Shuffle and pick 2 corners for the collectors
    const corners = [
      { xc: -45, zc: 60 },
      { xc: 45, zc: 60 },
      { xc: -45, zc: -60 },
      { xc: 45, zc: -60 },
    ];
    const shuffledCorners = [...corners].sort(() => Math.random() - 0.5);
    const newCollectors: CollectorState[] = [
      { color: 'green', xCorner: shuffledCorners[0].xc, zCorner: shuffledCorners[0].zc, size: 30, wallHeight: 6 },
      { color: 'red', xCorner: shuffledCorners[1].xc, zCorner: shuffledCorners[1].zc, size: 30, wallHeight: 6 },
    ];
    setCollectors(newCollectors);

    const newSpecialCorners: SpecialCornerState[] = [
      { type: 'entrance', xCorner: shuffledCorners[2].xc, zCorner: shuffledCorners[2].zc, size: 30, missingWall: Math.random() < 0.5 ? 'x' : 'z' },
      { type: 'exit', xCorner: shuffledCorners[3].xc, zCorner: shuffledCorners[3].zc, size: 30, missingWall: Math.random() < 0.5 ? 'x' : 'z' },
    ];
    setSpecialCorners(newSpecialCorners);

    // 2. Randomize starting position for spheres/balls
    const robotPlacement = getRobotEntrancePosition(newSpecialCorners);
    const newRobotState = {
      ...INITIAL_ROBOT_STATE,
      x: robotPlacement.x,
      z: robotPlacement.z,
      angle: robotPlacement.angle,
    };
    setRobotState(newRobotState);
    robotRef.current = newRobotState;
    lastManualPositionRef.current = {
      x: robotPlacement.x,
      z: robotPlacement.z,
      angle: robotPlacement.angle,
    };

    const startingRobotX = robotPlacement.x;
    const startingRobotZ = robotPlacement.z;

    const isInsideCollectorCornerLocal = (x: number, z: number, xc: number, zc: number, size: number = 30): boolean => {
      const signX = xc < 0 ? 1 : -1;
      const signZ = zc < 0 ? 1 : -1;
      const dx = (x - xc) * signX;
      const dz = (z - zc) * signZ;
      return dx >= 0 && dz >= 0 && dx < size && dz < size && (dx + dz) < size;
    };

    const isPositionInvalidLocal = (x: number, z: number, otherSpheres: {x: number, z: number}[]) => {
      for (const col of newCollectors) {
        if (isInsideCollectorCornerLocal(x, z, col.xCorner, col.zCorner, col.size + 4.0)) {
          return true;
        }
      }
      const robotDist = Math.sqrt((x - startingRobotX)**2 + (z - startingRobotZ)**2);
      if (robotDist < 22.0) {
        return true;
      }
      for (const other of otherSpheres) {
        const sphereDist = Math.sqrt((x - other.x)**2 + (z - other.z)**2);
        if (sphereDist < 8.0) {
          return true;
        }
      }
      return false;
    };

    const generatedSpheres: { x: number, z: number }[] = [];
    const newSpheres = [
      { id: 1, color: 'silver' as const, isConductive: true },
      { id: 2, color: 'silver' as const, isConductive: true },
      { id: 3, color: 'black' as const, isConductive: false },
    ].map((sBase) => {
      let x = 0;
      let z = 0;
      let attempts = 0;
      while (attempts < 500) {
        const candidateX = -41.5 + Math.random() * 83;
        const candidateZ = -56.5 + Math.random() * 113;
        if (!isPositionInvalidLocal(candidateX, candidateZ, generatedSpheres)) {
          x = candidateX;
          z = candidateZ;
          break;
        }
        attempts++;
      }
      if (attempts >= 500) {
        x = sBase.id === 1 ? -20 : sBase.id === 2 ? 20 : 0;
        z = sBase.id === 1 ? 10 : sBase.id === 2 ? -10 : 25;
      }
      generatedSpheres.push({ x, z });
      
      return {
        id: sBase.id,
        x,
        z,
        y: 2.5,
        vx: 0,
        vz: 0,
        vy: 0,
        radius: 2.5,
        color: sBase.color,
        isConductive: sBase.isConductive,
        isHeld: false,
        scoreStatus: 'none' as const,
      };
    });

    setSpheresState(newSpheres);
    spheresRef.current = newSpheres;
    setStats({
      scoreGreen: 0,
      scoreRed: 0,
      incorrectDeposits: 0,
      timeSeconds: 0,
      status: 'idle',
    });
    setCountdownSeconds(480);
    setPhysicsParams(INITIAL_PHYSICS_PARAMS);
    stopAllMotors();
    addLog("🎲 Nuovo layout arena generato casualmente con successo!");
  };

  const handleCustomMeshLoaded = (mesh: THREE.Group | THREE.Mesh | null, name: string) => {
    setCustomMesh(mesh);
    setCustomMeshName(name);
    setLoadError(null);
    if (name) {
      addLog(`🤖 Modello CAD caricato con successo: ${name}`);
    } else {
      addLog(`🤖 Modello CAD dismesso. Ripristinata scocca standard.`);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoadError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        handleCustomMeshLoaded(null, ""); // Clear previous first
        const loaded = await parseModelFile(file);
        handleCustomMeshLoaded(loaded.mesh, loaded.name);
      } catch (err: any) {
        setLoadError(err?.message || "Impossibile caricare il file.");
      }
    }
  };

  const handleTeleportRobot = (x: number, z: number) => {
    if (isRunning) return;

    // 1. Halt any active motors and reset command targets
    stopAllMotors();

    const prevGrippingId = robotRef.current.isGrippingId;

    // 2. Release any gripped spheres and completely reset the physical velocities/moments of ALL spheres
    // to zero so that no kinetic residual forces persist during or after the teleport.
    const updatedSpheres = spheresRef.current.map(s => ({
      ...s,
      isHeld: false,
      vx: 0,
      vy: 0,
      vz: 0,
    }));

    // 3. Reposition the robot at the new coordinate
    let targetX = x;
    let targetZ = z;
    let targetAngle = robotRef.current.angle;
    const activeTileOverlays = tileOverlaysRef.current;
    if (activeTileOverlays && activeTileOverlays.length > 0) {
      const partenzaTile = activeTileOverlays.find(overlay => {
        const isPartenza = overlay.tileId === 'partenza' || 
                           (overlay.imageUrl && overlay.imageUrl.toLowerCase().includes('partenza')) ||
                           (overlay.name && overlay.name.toLowerCase() === 'partenza');
        if (!isPartenza) return false;
        const dx = x - overlay.x;
        const dz = z - overlay.z;
        return Math.abs(dx) <= 15 && Math.abs(dz) <= 15;
      });
      if (partenzaTile) {
        targetX = partenzaTile.x;
        targetZ = partenzaTile.z;
        targetAngle = (partenzaTile.rotation || 0) + Math.PI;
      }
    }

    const updatedRobot = {
      ...robotRef.current,
      x: targetX,
      z: targetZ,
      angle: targetAngle,
      speed: 0,
      angularSpeed: 0,
      isGrippingId: null, // Reset grip state on manual teleport
    };

    lastManualPositionRef.current = {
      x: targetX,
      z: targetZ,
      angle: targetAngle,
    };

    // 4. Run a static physics collision resolution step at dt = 0 so that if the robot
    // is placed overlapping any other spheres at the new position, those spheres are
    // immediately pushed out of the robot's collision boundaries cleanly before code start.
    const activePhysicsParams = physicsParamsRef.current;
    const activeCollectors = collectorsRef.current;
    const activeSpecialCorners = specialCornersRef.current;
    const activeObstacles = obstaclesRef.current;

    const { nextRobot, nextSpheres } = updatePhysics(
      updatedRobot,
      updatedSpheres,
      activePhysicsParams,
      0, // dt = 0, resolves static positions only
      activeCollectors,
      activeSpecialCorners,
      activeTileOverlays,
      activeObstacles
    );

    // Instantly commit to refs to prevent continuous physics loop overwrite
    robotRef.current = nextRobot;
    spheresRef.current = nextSpheres;

    // Trigger state refreshes
    setRobotState(nextRobot);
    setSpheresState(nextSpheres);

    if (prevGrippingId !== null) {
      addLog(`📍 Robot riposizionato. Sfera rilasciata a terra. Nuova posizione: X: ${x.toFixed(1)} cm, Z: ${z.toFixed(1)} cm (Fisica resettata).`);
    } else {
      addLog(`📍 Robot riposizionato a: X: ${x.toFixed(1)} cm, Z: ${z.toFixed(1)} cm (Fisica resettata).`);
    }
  };

  const handleRotateRobot = (angleDelta: number) => {
    if (isRunning) return;

    stopAllMotors();

    const newAngle = robotRef.current.angle + angleDelta;
    const updatedRobot = { ...robotRef.current, angle: newAngle };

    lastManualPositionRef.current = {
      x: updatedRobot.x,
      z: updatedRobot.z,
      angle: updatedRobot.angle,
    };

    robotRef.current = updatedRobot;
    setRobotState(updatedRobot);

    const degrees = Math.round((newAngle * 180) / Math.PI) % 360;
    addLog(`🔄 Robot ruotato manualmente. Nuovo angolo: ${degrees}°`);
  };

  const handleTileFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const newAsset = {
          id: `custom-${Date.now()}`,
          name: file.name.split('.')[0],
          url: url
        };
        setCustomTileAssets(prev => [newAsset, ...prev]);
        addLog(`🖼️ Caricata immagine piastrella: ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportConfig = () => {
    const config = {
      tileOverlays,
      customTileAssets,
      collectors,
      specialCorners,
      obstacles,
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rescue-line-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog(`💾 Configurazione salvata con successo su disco.`);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const config = JSON.parse(event.target?.result as string);
          if (config.tileOverlays) setTileOverlays(config.tileOverlays);
          if (config.customTileAssets) setCustomTileAssets(config.customTileAssets);
          if (config.collectors) setCollectors(config.collectors);
          if (config.specialCorners) setSpecialCorners(config.specialCorners);
          if (config.obstacles) setObstacles(config.obstacles);
          addLog(`📂 Configurazione caricata correttamente: ${file.name}`);
        } catch (err) {
          addLog(`❌ Errore durante il caricamento del file JSON.`);
        }
      };
      reader.readAsText(file);
    }
    // Clean target value to allow uploading the same file multiple times
    e.target.value = '';
  };

  const handleSaveToSlot = (index: number) => {
    try {
      const config = {
        tileOverlays,
        customTileAssets,
        collectors,
        specialCorners,
        timestamp: Date.now()
      };
      localStorage.setItem(`rescue-line-slot-${index}`, JSON.stringify(config));
      setActiveSlot(index);
      addLog(`💾 Disegno salvato correttamente nello Slot ${index + 1}.`);
    } catch (e) {
      addLog(`⚠️ Errore durante il salvataggio: memoria locale piena?`);
    }
  };

  const handleLoadFromSlot = (index: number) => {
    const saved = localStorage.getItem(`rescue-line-slot-${index}`);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.tileOverlays) setTileOverlays(config.tileOverlays);
        if (config.customTileAssets) setCustomTileAssets(config.customTileAssets);
        if (config.collectors) setCollectors(config.collectors);
        if (config.specialCorners) setSpecialCorners(config.specialCorners);
        setActiveSlot(index);
        addLog(`📂 Caricato disegno salvato (Slot ${index + 1}).`);
      } catch (e) {
        addLog(`❌ Errore nel caricamento dei dati salvati.`);
      }
    } else {
      addLog(`ℹ️ Lo Slot ${index + 1} è ancora vuoto.`);
    }
  };

  const handleDeleteCustomAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const assetToDelete = customTileAssets.find(a => a.id === id);
    if (!assetToDelete) return;
    
    setCustomTileAssets(prev => prev.filter(a => a.id !== id));
    // Reset any tiles that were using this image to 'none'
    setTileOverlays(prev => prev.map(o => o.imageUrl === assetToDelete.url ? { ...o, imageUrl: TILE_ASSETS[0].url } : o));
    addLog(`🗑️ Immagine "${assetToDelete.name}" rimossa dalla libreria.`);
  };

  useEffect(() => {
    // Reset modal drag position when switching tiles
    dragRef.current = { isDragging: false, startX: 0, startY: 0, posX: 0, posY: 0 };
    if (modalDivRef.current) {
      modalDivRef.current.style.transform = 'translate(0px, 0px)';
    }
  }, [selectedTile]);

  const handlePointerDownModal = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, div.overflow-y-auto')) return;
    
    dragRef.current.isDragging = true;
    dragRef.current.startX = e.clientX - dragRef.current.posX;
    dragRef.current.startY = e.clientY - dragRef.current.posY;
    
    if (modalDivRef.current) {
      modalDivRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMoveModal = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    
    const newX = e.clientX - dragRef.current.startX;
    const newY = e.clientY - dragRef.current.startY;
    
    dragRef.current.posX = newX;
    dragRef.current.posY = newY;
    
    if (modalDivRef.current) {
      modalDivRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    }
  };

  const handlePointerUpModal = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.isDragging = false;
    if (modalDivRef.current) {
      modalDivRef.current.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white relative overflow-hidden">
      
      {/* Telemetry/Constants Left Sidebar Drawer */}
      {isTelemetryOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 transition-opacity backdrop-blur-xs cursor-pointer"
          onClick={() => setIsTelemetryOpen(false)}
        />
      )}
      <div 
        className={`fixed inset-y-0 left-0 w-80 sm:w-96 bg-[#121a2f] border-r border-slate-800 p-5 shadow-2xl z-45 transform transition-transform duration-300 ease-out flex flex-col gap-5 overflow-y-auto ${
          isTelemetryOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Parametri
          </h2>
          <button 
            onClick={() => setIsTelemetryOpen(false)}
            className="px-3 py-1.5 bg-[#00965e] hover:bg-[#008251] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition"
          >
            Torna alla Simulazione
          </button>
        </div>



        {/* Environmental Physics constants */}
        <div className="bg-slate-950 border border-slate-900/60 rounded-xl p-4 shadow-md flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            Parametri della simulazione
          </h3>

          <div className="space-y-3.5">
            {/* Coefficient of Friction */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Resistenza Attrito Sponde/Piano:</span>
                <span className="font-semibold text-yellow-400 font-mono">{(physicsParams.friction * 100).toFixed(0)} %</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.15"
                step="0.01"
                value={physicsParams.friction}
                onChange={(e) => setPhysicsParams({ ...physicsParams, friction: parseFloat(e.target.value) })}
                className="w-full accent-yellow-400"
              />
              <span className="text-[9px] text-slate-500">Un attrito maggiore simula tappeti abrasivi; valori bassi riducono il grip dei pneumatici.</span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Attrito palline sul pavimento:</span>
                <span className="font-semibold text-yellow-400 font-mono">{(physicsParams.sphereFriction * 10).toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="0.05"
                value={physicsParams.sphereFriction}
                onChange={(e) => setPhysicsParams({ ...physicsParams, sphereFriction: parseFloat(e.target.value) })}
                className="w-full accent-yellow-400"
              />
            </div>

            {/* Elasticity of impacts */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Elasticità Collisioni (Restituzione):</span>
                <span className="font-semibold text-yellow-400 font-mono">{(physicsParams.restitution * 100).toFixed(0)} %</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={physicsParams.restitution}
                onChange={(e) => setPhysicsParams({ ...physicsParams, restitution: parseFloat(e.target.value) })}
                className="w-full accent-yellow-400"
              />
            </div>

            {/* Motor speed adjustment directly */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Velocità Massima Motori:</span>
                <span className="font-semibold text-yellow-400 font-mono">{physicsParams.motorPower} %</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                step="10"
                value={physicsParams.motorPower}
                onChange={(e) => setPhysicsParams({ ...physicsParams, motorPower: parseInt(e.target.value) })}
                className="w-full accent-yellow-400"
              />
            </div>

            {/* Robot Wheel Friction slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Attrito Ruote (Rampa & Altalena):</span>
                <span className="font-semibold text-yellow-400 font-mono">
                  {physicsParams.wheelFriction === 1.0 ? "MAX (100%)" : `${(physicsParams.wheelFriction * 100).toFixed(0)} %`}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={physicsParams.wheelFriction}
                onChange={(e) => setPhysicsParams({ ...physicsParams, wheelFriction: parseFloat(e.target.value) })}
                className="w-full accent-yellow-400"
              />
              <span className="text-[9px] text-slate-500">
                Determina l'aderenza delle ruote robot. Di default (55%) sale solo veloce. Al massimo (&gt;95%) supera sempre la rampa e il basculante senza blocchi, anche partendo da fermo.
              </span>
            </div>

            {/* Sensor Lateral Offset adjustment */}
            <div className="flex flex-col gap-1 border-t border-slate-900 pt-3 mt-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Distanza Inter-Sensore:</span>
                <span className="font-semibold text-yellow-400 font-mono">{(robotState.sensorLateralOffset * 2 * 10).toFixed(0)} mm</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={robotState.sensorLateralOffset}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setRobotState(prev => ({ ...prev, sensorLateralOffset: val }));
                  robotRef.current.sensorLateralOffset = val;
                }}
                className="w-full accent-yellow-400"
              />
              <span className="text-[9px] text-slate-500">Regola la larghezza tra i sensori LuceColSx e LuceColDx (Range: 20-60 mm).</span>
            </div>
          </div>
        </div>



      </div>

      {/* Upper Navigation Header */}
      {activeView !== 'programming' && (
        <header className="bg-white border-b border-slate-200 py-1 px-4 shrink-0 flex flex-col lg:flex-row justify-between items-center gap-2 shadow-sm relative z-20 h-12">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center bg-transparent rounded-xl">
            <img src="/LogoStaarr.png" alt="S.T.A.A.R.R. Logo" className="h-[44px] object-contain -my-1" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Simulazione Rescue Line V1.2
            </h1>
          </div>
        </div>

        {/* Central Segmented View Control to toggle views */}
        <div className="flex p-1 gap-2 select-none">
          <button
            onClick={() => {
              setActiveView('simulation');
              setIsTelemetryOpen(prev => activeView === 'simulation' ? !prev : true);
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all outline-none cursor-pointer border bg-white text-slate-900 border-slate-300 hover:bg-slate-50 shadow-sm"
          >
            Parametri
          </button>
          <button
            onClick={() => {
              setActiveView('design');
              setIsTelemetryOpen(false);
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all outline-none cursor-pointer border bg-white text-slate-900 border-slate-300 hover:bg-slate-50 shadow-sm"
          >
            Genera campo
          </button>
          <button
            onClick={() => {
              setActiveView('programming');
              //setIsTelemetryOpen(false); // Auto-hide sidebar when editing is full-screen
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all outline-none cursor-pointer border bg-white text-slate-900 border-slate-300 hover:bg-slate-50 shadow-sm"
          >
            Crea Codice
          </button>
        </div>

        {/* Global Execution Toolbar at Top Right */}
        <div className="flex justify-end select-none w-auto min-w-[150px] lg:w-[300px]">
          {activeView === 'simulation' && (
            <>
              {isRunning ? (
                <button
                  onClick={handleStopCode}
                  className="px-4 py-1.5 bg-red-650 hover:bg-red-600 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition shadow-sm hover:scale-[1.02] border border-red-500/20 active:scale-95 cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  <span>Arresta Codice</span>
                </button>
              ) : (
                <button
                  onClick={() => handleRunCode(latestCodeRef.current)}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition shadow-sm hover:scale-[1.02] border border-red-500/30 active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Esegui Codice</span>
                </button>
              )}
            </>
          )}
        </div>
        </header>
      )}

      {/* Main Single-View Component Content */}
      <main className={`flex-1 overflow-hidden w-full relative flex flex-col h-full ${activeView === 'programming' ? 'p-0' : 'p-0 max-w-none'}`}>
        {(activeView === 'simulation' || activeView === 'design') ? (
          <div className="flex-1 flex flex-col relative h-full">
            <Simulator3D
              robotState={robotState}
              spheresState={spheresState}
              stats={stats}
              collectors={collectors}
              specialCorners={specialCorners}
              showPhysics={showPhysics}
              obstacles={obstacles}
              onResetArena={handleResetArena}
              onUploadCustomMesh={handleCustomMeshLoaded}
              customMesh={customMesh}
              customMeshName={customMeshName}
              onTeleportRobot={handleTeleportRobot}
              onRotateRobot={handleRotateRobot}
              isDesignMode={activeView === 'design'}
              tileOverlays={tileOverlays}
              onTileClick={(x, z) => setSelectedTile({ x, z })}
              countdownSeconds={countdownSeconds}
            />

            {/* Tile Asset Picker Modal (Design Mode) */}
            {activeView === 'design' && selectedTile && (
              <div 
                className="absolute inset-0 z-50 flex items-center justify-center bg-transparent cursor-pointer select-none"
                onClick={() => setSelectedTile(null)}
              >
                <div 
                  ref={modalDivRef}
                  className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200 cursor-move"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={handlePointerDownModal}
                  onPointerMove={handlePointerMoveModal}
                  onPointerUp={handlePointerUpModal}
                  onPointerCancel={handlePointerUpModal}
                >
                  <button 
                    onClick={() => setSelectedTile(null)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
                  >
                    ×
                  </button>

                  <div className="flex flex-col gap-4 mb-6">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      
                      {/* I 4 pulsanti gialli */}
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        <button 
                          onClick={() => {
                            const newObs: BoxObstacle = {
                              id: `box-${Date.now()}`,
                              type: 'box',
                              x: selectedTile.x,
                              z: selectedTile.z,
                              width: 10,
                              depth: 10,
                              height: 20,
                              color: '#8b4513', // Wood color
                              label: 'STAARR'
                            };
                            setObstacles(prev => [...prev, newObs]);
                            setSelectedTile(null);
                          }}
                          className="py-1.5 px-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap text-ellipsis overflow-hidden"
                          title="+ Ostacolo"
                        >
                          + Ostacolo
                        </button>
                        <button 
                          onClick={() => {
                            const newObs: RampObstacle = {
                              id: `ramp-${Date.now()}`,
                              type: 'ramp',
                              x: selectedTile.x,
                              z: selectedTile.z,
                              width: 30, // Tile width
                              depth: 30, // Tile depth
                              height: 30 * Math.tan(20 * Math.PI / 180), // Height for 20 deg slope over 30cm depth (~10.9cm)
                              color: '#ffffff',
                              rotation: 0
                            };
                            setObstacles(prev => [...prev, newObs]);
                            setSelectedTile(null);
                          }}
                          className="py-1.5 px-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap text-ellipsis overflow-hidden"
                          title="+ Rampa"
                        >
                          + Rampa
                        </button>
                        <button 
                          onClick={() => {
                            const newObs: PlatformObstacle = {
                              id: `platform-${Date.now()}`,
                              type: 'platform',
                              x: selectedTile.x,
                              z: selectedTile.z,
                              width: 30, // Tile width
                              depth: 30, // Tile depth
                              height: 30 * Math.tan(20 * Math.PI / 180), // Same height as ramp (~10.9cm)
                              color: '#ffffff',
                              rotation: 0
                            };
                            setObstacles(prev => [...prev, newObs]);
                            setSelectedTile(null);
                          }}
                          className="py-1.5 px-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap text-ellipsis overflow-hidden"
                          title="+ Pianerottolo"
                        >
                          + Pianerottolo
                        </button>
                        <button 
                          onClick={() => {
                            const newObs: SeesawObstacle = {
                              id: `seesaw-${Date.now()}`,
                              type: 'seesaw',
                              x: selectedTile.x,
                              z: selectedTile.z,
                              width: 30, // Tile width
                              depth: 30, // Tile depth
                              height: 5.5, // Hinge pivot height
                              color: '#ffffff',
                              rotation: 0,
                              currentAngle: Math.asin(5.5 / 15) // starts on tilted floor
                            };
                            setObstacles(prev => [...prev, newObs]);
                            setSelectedTile(null);
                          }}
                          className="py-1.5 px-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap text-ellipsis overflow-hidden"
                          title="+ Basculante"
                        >
                          + Basculante
                        </button>
                      </div>

                      {/* Checkpoint e Verde posizionati sopra ruolo e rimuovi in un'unica riga */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <button 
                          onClick={() => {
                            const newObs: CheckpointObstacle = {
                              id: `checkpoint-br-${Date.now()}`,
                              type: 'checkpoint',
                              x: selectedTile.x + 12.5,
                              z: selectedTile.z + 12.5,
                              radius: 2.5,
                              height: 0.7,
                              color: '#ff7f00',
                              corner: 'bottom-right'
                            };
                            setObstacles(prev => [...prev, newObs]);
                            setSelectedTile(null);
                          }}
                          className="py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[11px] font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98]"
                        >
                          +Checkpoint
                        </button>
                        <button 
                          onClick={() => {
                            const newObs: CylindricalObstacle = {
                              id: `obs-0-${Date.now()}`,
                              type: 'cylinder',
                              x: selectedTile.x,
                              z: selectedTile.z,
                              radius: 0.5,
                              height: 25,
                              color: '#ffffff',
                              rotation: 0
                            };
                            setObstacles(prev => [...prev, newObs]);
                            setSelectedTile(null);
                          }}
                          className="py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[11px] font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98]"
                        >
                          +Bumper
                        </button>
                        <button 
                          onClick={() => {
                            const newObs: GreenMarkerObstacle = {
                              id: `greenmarker-${Date.now()}`,
                              type: 'green_marker',
                              x: selectedTile.x + 2.2,
                              z: selectedTile.z - 2.2,
                              width: 2.5,
                              height: 0.2,
                              depth: 2.5,
                              color: '#22c55e'
                            };
                            setObstacles(prev => [...prev, newObs]);
                            setSelectedTile(null);
                          }}
                          className="py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[11px] font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98]"
                        >
                          +Verde
                        </button>
                      </div>

                      {/* Ruota 90° e Rimuovi posizionati subito sotto i pulsanti gialli */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <button 
                          onClick={() => {
                            setObstacles(prev => prev.map(o => {
                              if (Math.abs(o.x - selectedTile.x) < 20 && Math.abs(o.z - selectedTile.z) < 20) {
                                if (o.type === 'ramp' || o.type === 'platform' || o.type === 'seesaw' || o.type === 'cylinder') {
                                  return { ...o, rotation: (o.rotation || 0) + Math.PI / 2 };
                                }
                                if (o.type === 'green_marker') {
                                  // Rotate relative position to tile center by 90 degrees
                                  const dx = o.x - selectedTile.x;
                                  const dz = o.z - selectedTile.z;
                                  const newX = selectedTile.x - dz;
                                  const newZ = selectedTile.z + dx;
                                  return {
                                    ...o,
                                    x: newX,
                                    z: newZ,
                                    rotation: (o.rotation || 0) + Math.PI / 2
                                  };
                                }
                              }
                              return o;
                            }));
                          }}
                          className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <RefreshCw className="w-4 h-4" />
                          RUOTA 90°
                        </button>
                        <button 
                          onClick={() => {
                            setObstacles(prev => prev.map(o => {
                              if (Math.abs(o.x - selectedTile.x) < 20 && Math.abs(o.z - selectedTile.z) < 20) {
                                if (o.type === 'cylinder') {
                                  return { ...o, rotation: (o.rotation || 0) + Math.PI / 4 };
                                }
                              }
                              return o;
                            }));
                          }}
                          className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <RefreshCw className="w-4 h-4" />
                          RUOTA 45°
                        </button>
                        <button 
                          onClick={() => {
                            setObstacles(prev => prev.filter(o => !(Math.abs(o.x - selectedTile.x) < 20 && Math.abs(o.z - selectedTile.z) < 20)));
                            setTileOverlays(prev => prev.filter(o => !(Math.abs(o.x - selectedTile.x) < 20 && Math.abs(o.z - selectedTile.z) < 20)));
                            setSelectedTile(null);
                          }}
                          className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          RIMUOVI
                        </button>
                      </div>

                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 h-64 overflow-y-auto pr-2 custom-scrollbar pb-2">
                    {/* Add Custom Asset Upload Trigger */}
                    <button
                      onClick={() => tileFileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 hover:border-indigo-500 rounded-xl transition group cursor-pointer"
                    >
                      <div className="w-16 h-16 rounded-lg flex items-center justify-center border border-slate-800 group-hover:bg-slate-900 transition-colors">
                        <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-400" />
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 group-hover:text-white">Carica Disegno</span>
                    </button>
                    <input 
                      type="file" 
                      ref={tileFileInputRef} 
                      onChange={handleTileFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />

                    {[...TILE_ASSETS, ...customTileAssets].map((asset) => {
                      const isActive = tileOverlays.find(o => o.x === selectedTile.x && o.z === selectedTile.z)?.imageUrl === asset.url;
                      const isNoneSelected = asset.id === 'none' && !tileOverlays.find(o => o.x === selectedTile.x && o.z === selectedTile.z);
                      const isCustom = asset.id.toString().startsWith('custom-');

                      return (
                        <div
                          key={asset.id}
                          onClick={() => {
                            setTileOverlays(prev => {
                              const existing = prev.find(o => o.x === selectedTile.x && o.z === selectedTile.z);
                              const filtered = prev.filter(o => o.x !== selectedTile.x || o.z !== selectedTile.z);
                              if (asset.id === 'none') return filtered;
                              // Preserve rotation if switching images
                              return [...filtered, { 
                                x: selectedTile.x, 
                                z: selectedTile.z, 
                                imageUrl: asset.url, 
                                rotation: existing?.rotation || 0,
                                tileId: asset.id.toString(),
                                name: asset.name
                              }];
                            });
                            setSelectedTile(null);
                          }}
                          className={`flex flex-col items-center gap-2 p-3 border rounded-xl transition group relative cursor-pointer ${
                            isActive || isNoneSelected
                              ? 'bg-indigo-600/30 border-indigo-500 ring-2 ring-indigo-500/20' 
                              : 'bg-slate-800 border-slate-700 hover:bg-indigo-600/10 hover:border-indigo-500/50'
                          }`}
                          role="button"
                          tabIndex={0}
                        >
                          {isCustom && (
                            <button
                              onClick={(e) => handleDeleteCustomAsset(asset.id, e)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-md hover:bg-rose-500"
                              title="Rimuovi dalla libreria"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          <div className={`w-16 h-16 bg-white rounded-lg overflow-hidden flex items-center justify-center p-1 border ${
                            isActive || isNoneSelected ? 'border-indigo-400' : 'border-slate-600 group-hover:border-indigo-400'
                          }`}>
                            <img src={asset.url} alt={asset.name} className="w-full h-full object-contain" />
                          </div>
                          <span className={`text-[10px] truncate w-full text-center font-medium ${isActive || isNoneSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                            {asset.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Orientamento Piastrella</span>
                    <div className="flex gap-2">
                       {[0, 90, 180, 270].map(deg => {
                         const currentRotRad = tileOverlays.find(o => o.x === selectedTile.x && o.z === selectedTile.z)?.rotation || 0;
                         const targetRotRad = (deg * Math.PI) / 180;
                         // Handle floating point comparison (roughly)
                         const isCurrent = Math.abs(currentRotRad - targetRotRad) < 0.01;

                         return (
                           <button 
                             key={deg}
                             onClick={() => {
                               setTileOverlays(prev => {
                                 const existing = prev.find(o => o.x === selectedTile.x && o.z === selectedTile.z);
                                 if (!existing) return prev;
                                 return prev.map(o => (o.x === selectedTile.x && o.z === selectedTile.z) ? { ...o, rotation: targetRotRad } : o);
                               });
                             }}
                             className={`flex-1 py-1.5 text-[10px] rounded-lg border transition-all cursor-pointer font-bold ${isCurrent ? 'bg-slate-200 border-slate-300 text-slate-900 shadow-inner' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm'}`}
                           >
                             {deg}°
                           </button>
                         );
                       })}
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                    <button 
                      onClick={() => setSelectedTile(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition cursor-pointer font-sans"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Design Mode Overlay - Instruction */}
            {activeView === 'design' && (
              <div className="absolute top-3 left-3 z-10 bg-slate-900/80 border border-slate-700 p-4 rounded-xl backdrop-blur-md shadow-xl w-64">
                <h3 className="text-emerald-400 font-bold flex items-center gap-2 mb-2">
                  <Box className="w-5 h-5" />
                  Editor Percorso
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  In questa modalità puoi configurare le caratteristiche del campo. 
                  Il robot è nascosto per facilitare la visione d'insieme.
                </p>

                <input 
                  type="file" 
                  ref={configImportInputRef} 
                  onChange={handleImportConfig} 
                  accept=".json" 
                  className="hidden" 
                />

                <div className="pt-4 border-t border-slate-800 flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => configImportInputRef.current?.click()}
                      className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer font-sans"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Carica
                    </button>
                    <button
                      onClick={handleExportConfig}
                      className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer font-sans"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Salva
                    </button>
                  </div>
                  <button 
                    onClick={handleRandomizeArena}
                    className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Rigenera Layout Campo
                  </button>
                  <button 
                    onClick={() => setActiveView('simulation')}
                    className="w-full py-2 bg-[#00965e] hover:bg-[#008251] text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    Torna alla Simulazione
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <BlocklyEditor
            onRunCode={handleRunCode}
            onStopCode={handleStopCode}
            isRunning={isRunning}
            logs={logs}
            simulationState={stats.status.toUpperCase()}
            onBackToSimulation={() => setActiveView('simulation')}
            onCodeChange={(code) => { latestCodeRef.current = code; }}
            initialXml={initialBlocklyXml}
            onXmlChange={setInitialBlocklyXml}
          />
        )}
      </main>
    </div>
  );
}
