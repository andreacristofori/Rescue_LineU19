/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SphereColor = 'silver' | 'black';

export interface SphereState {
  id: number;
  x: number; // in cm, relative to field center (0,0) resulting in X: -45 to +45
  z: number; // in cm, Z: -60 to +60
  y: number; // in cm
  vx: number;
  vz: number;
  vy: number;
  radius: number; // 2.5 cm
  color: SphereColor;
  isConductive: boolean;
  isHeld: boolean;
  scoreStatus?: 'none' | 'green' | 'red';
}

export interface RobotState {
  x: number;
  z: number;
  y: number;
  angle: number; // in radians
  speed: number; // cm/s
  angularSpeed: number; // rad/s
  armHeight: number; // 0 (low) to 1 (high)
  clawOpen: number; // 0 (closed) to 1 (open)
  prevClawOpen?: number;
  isGrippingId: number | null; // ID of held sphere
  width: number; // ~20 cm
  length: number; // ~25 cm
  height: number; // ~15 cm
  sensorDistance: number; // cm distance to nearest obstacle straight ahead
  sensorLateralOffset: number; // cm distance from center for LuceColSx/Dx
  detectedColor: 'none' | 'green' | 'red' | 'white' | 'silver' | 'black'; // front color sensor (now forward looking)
  luceColDxColor: 'none' | 'green' | 'red' | 'white' | 'silver' | 'black';
  luceColDxLight: number; // 0 to 100 percentage
  luceColSxColor: 'none' | 'green' | 'red' | 'white' | 'silver' | 'black';
  luceColSxLight: number; // 0 to 100 percentage
  ledRed: boolean;
  pitch?: number; // in radians
  roll?: number;  // in radians
  rampClimbBlocked?: boolean;
  clawWallHit?: boolean;
  sphereSqueezeHit?: boolean;
}

export interface CollectorState {
  color: 'green' | 'red';
  xCorner: number; // corner X
  zCorner: number; // corner Z
  size: number; // 30 cm
  wallHeight: number; // 6 cm
}

export interface SpecialCornerState {
  type: 'entrance' | 'exit';
  xCorner: number;
  zCorner: number;
  size: number;
  missingWall?: 'x' | 'z';
}

export interface PhysicsParams {
  friction: number;   // Field surface sliding friction
  sphereFriction: number; // Friction specific to spheres
  restitution: number; // Elasticity of collisions
  massRobot: number;   // Mass to calculate inertia (kg)
  massSphere: number;  // Mass of sphere (kg)
  motorPower: number;  // Multiplier for torque/speed limit
  wheelFriction: number; // Traction/grip capability of robot wheels on ramps (0 to 1)
}

export interface TileOverlay {
  x: number;
  z: number;
  imageUrl: string;
  rotation?: number; // radians
  tileId?: string;   // the asset's ID (e.g. 'straight', 'curve', 'custom-1234')
  name?: string;     // the asset's name (e.g. 'Rettilineo', 'Curva', or custom filename)
}

export interface BoxObstacle {
  id: string;
  type: 'box';
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  rotation?: number;
  label?: string;
}

export interface CylindricalObstacle {
  id: string;
  type?: 'cylinder'; // Optional for backward compatibility
  x: number;
  z: number;
  radius: number;
  height: number; // Length of the cylinder
  color: string;
  rotation?: number; // Rotation in the XZ plane (radians)
}

export interface RampObstacle {
  id: string;
  type: 'ramp';
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  rotation?: number;
}

export interface PlatformObstacle {
  id: string;
  type: 'platform';
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  rotation?: number;
}

export interface SeesawObstacle {
  id: string;
  type: 'seesaw';
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number; // Pivot axis height, e.g. 5.5 cm
  color: string;
  rotation?: number;
  currentAngle?: number; // Dynamic tilt angle (in radians)
}

export interface CheckpointObstacle {
  id: string;
  type: 'checkpoint';
  x: number;
  z: number;
  radius: number; // in cm, 2.5 cm (diameter 5 cm)
  height: number; // in cm, 0.7 cm (height 7 mm)
  color: string;  // orange, e.g., '#ff7f00'
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface GreenMarkerObstacle {
  id: string;
  type: 'green_marker';
  x: number;
  z: number;
  width: number;  // in cm, 2.5 cm
  depth: number;  // in cm, 2.5 cm
  height: number; // in cm, 0.2 cm
  color: string;  // e.g., '#22c55e' (green)
  rotation?: number;
}

export type Obstacle = CylindricalObstacle | BoxObstacle | RampObstacle | PlatformObstacle | SeesawObstacle | CheckpointObstacle | GreenMarkerObstacle;

export interface SimulationStats {
  scoreGreen: number; // correct silver items inside green
  scoreRed: number;   // correct black items inside red
  incorrectDeposits: number; // wrong colors in wrong bins
  timeSeconds: number;
  status: 'idle' | 'running' | 'paused' | 'reset';
}
