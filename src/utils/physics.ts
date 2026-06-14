/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RobotState, SphereState, PhysicsParams, CollectorState, SpecialCornerState, TileOverlay, Obstacle, BoxObstacle, CylindricalObstacle, RampObstacle, PlatformObstacle, SeesawObstacle, GreenMarkerObstacle } from '../types';

// Field boundaries
export const FIELD_WIDTH = 90; // X goes from -45 to +45
export const FIELD_DEPTH = 120; // Z goes from -60 to +60
export const WALL_HEIGHT = 10;
export const COLLECTOR_WALL_HEIGHT = 6;
export const FIELD_HALF_W = FIELD_WIDTH / 2;
export const FIELD_HALF_D = FIELD_DEPTH / 2;

export const FLOOR_WIDTH = 500;
export const FLOOR_DEPTH = 500;
export const FLOOR_HALF_W = FLOOR_WIDTH / 2;
export const FLOOR_HALF_D = FLOOR_DEPTH / 2;

export interface Room {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function getTiledRooms(specialCorners: SpecialCornerState[]): Room[] {
  const rooms: Room[] = [
    { minX: -45, maxX: 45, minZ: -60, maxZ: 60 } // Main Arena
  ];

  const externalRooms: Room[] = [];
  specialCorners.forEach(sc => {
    const signX = sc.xCorner < 0 ? 1 : -1;
    const signZ = sc.zCorner < 0 ? 1 : -1;
    let tileX = 0;
    let tileZ = 0;
    const tileW = 90;
    const tileD = 120;

    if (sc.missingWall === 'x') {
      tileX = 0;
      tileZ = sc.zCorner - signZ * (tileD / 2);
    } else {
      tileZ = 0;
      tileX = sc.xCorner - signX * (tileW / 2);
    }

    const room = {
      minX: tileX - 45,
      maxX: tileX + 45,
      minZ: tileZ - 60,
      maxZ: tileZ + 60
    };
    rooms.push(room);
    externalRooms.push(room);
  });

  if (externalRooms.length === 2) {
    const r1 = externalRooms[0];
    const r2 = externalRooms[1];
    if ((r1.minX === -45 && r2.minZ === -60) || (r1.minZ === -60 && r2.minX === -45) ||
        (r1.minX === -45 && r2.minZ === -180) || (r1.minZ === -180 && r2.minX === -45)) {
      const sc0 = specialCorners[0];
      const sc1 = specialCorners[1];
      const rx1 = sc0.missingWall === 'x' ? 0 : sc0.xCorner - (sc0.xCorner < 0 ? 1 : -1) * 45;
      const rz1 = sc0.missingWall === 'x' ? sc0.zCorner - (sc0.zCorner < 0 ? 1 : -1) * 60 : 0;

      const rx2 = sc1.missingWall === 'x' ? 0 : sc1.xCorner - (sc1.xCorner < 0 ? 1 : -1) * 45;
      const rz2 = sc1.missingWall === 'x' ? sc1.zCorner - (sc1.zCorner < 0 ? 1 : -1) * 60 : 0;

      if ((rx1 === 0 && rz2 === 0) || (rz1 === 0 && rx2 === 0)) {
        const cornerX = rx1 === 0 ? rx2 : rx1;
        const cornerZ = rz1 === 0 ? rz2 : rz1;
        rooms.push({
          minX: cornerX - 45,
          maxX: cornerX + 45,
          minZ: cornerZ - 60,
          maxZ: cornerZ + 60
        });
      }
    }
  }

  return rooms;
}

export function isInsideAnyRoom(x: number, z: number, rooms: Room[], margin: number = 0): boolean {
  return rooms.some(r => 
    x >= r.minX - margin && x <= r.maxX + margin &&
    z >= r.minZ - margin && z <= r.maxZ + margin
  );
}

export function getRoomForPoint(x: number, z: number, rooms: Room[]): Room {
  for (const r of rooms) {
    if (x >= r.minX - 0.1 && x <= r.maxX + 0.1 && z >= r.minZ - 0.1 && z <= r.maxZ + 0.1) {
      return r;
    }
  }
  let bestRoom = rooms[0];
  let minDist = Infinity;
  for (const r of rooms) {
    const dx = Math.max(0, r.minX - x, x - r.maxX);
    const dz = Math.max(0, r.minZ - z, z - r.maxZ);
    const dist = dx * dx + dz * dz;
    if (dist < minDist) {
      minDist = dist;
      bestRoom = r;
    }
  }
  return bestRoom;
}

/**
 * Returns the correct robot position and angle to start at the entrance corner facing inwards.
 */
export function getRobotEntrancePosition(specialCorners: SpecialCornerState[]): { x: number; z: number; angle: number } {
  const entrance = specialCorners.find(sc => sc.type === 'entrance') || {
    xCorner: -45, zCorner: -60, size: 30, missingWall: 'x'
  };

  const signX = entrance.xCorner < 0 ? 1 : -1;
  const signZ = entrance.zCorner < 0 ? 1 : -1;

  let x = 0;
  let z = 0;
  let angle = 0;

  if (entrance.missingWall === 'x') {
    // Horizontal (North/South) wall is open
    // Midpoint X of the corner size is the tile center X
    x = entrance.xCorner + signX * (entrance.size / 2);
    // Tile center Z is 15 units outside the wall
    z = entrance.zCorner - signZ * 15;
    // Facing inwards (towards center) means moving along Z away from the wall
    angle = signZ > 0 ? 0 : Math.PI;
  } else {
    // Vertical (West/East) wall is open
    // Tile center X is 15 units outside the wall
    x = entrance.xCorner - signX * 15;
    // Midpoint Z of the corner size is the tile center Z
    z = entrance.zCorner + signZ * (entrance.size / 2);
    // Facing inwards (towards center) means moving along X away from the wall
    angle = signX > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  return { x, z, angle };
}

/**
 * Returns true if there's a perimeter wall at X coordinate (boundary boundary).
 * It's missing if inside an entrance/exit of size 30.
 */
export function hasWallAtX(x: number, z: number, specialCorners: SpecialCornerState[]): boolean {
  for (const sc of specialCorners) {
    if (sc.missingWall && sc.missingWall !== 'z') {
      continue;
    }
    if (Math.abs(sc.xCorner - x) < 0.1) {
      const zMin = Math.min(sc.zCorner, sc.zCorner + (sc.zCorner < 0 ? 1 : -1) * sc.size);
      const zMax = Math.max(sc.zCorner, sc.zCorner + (sc.zCorner < 0 ? 1 : -1) * sc.size);
      if (z >= zMin && z <= zMax) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Returns true if there's a perimeter wall at Z coordinate (boundary boundary).
 * It's missing if inside an entrance/exit of size 30.
 */
export function hasWallAtZ(x: number, z: number, specialCorners: SpecialCornerState[]): boolean {
  for (const sc of specialCorners) {
    if (sc.missingWall && sc.missingWall !== 'x') {
      continue;
    }
    if (Math.abs(sc.zCorner - z) < 0.1) {
      const xMin = Math.min(sc.xCorner, sc.xCorner + (sc.xCorner < 0 ? 1 : -1) * sc.size);
      const xMax = Math.max(sc.xCorner, sc.xCorner + (sc.xCorner < 0 ? 1 : -1) * sc.size);
      if (x >= xMin && x <= xMax) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Returns true if the coordinate (x, z) is inside a corner defined by xc, zc.
 */
export function isInsideCollectorCorner(x: number, z: number, xc: number, zc: number, size: number = 30): boolean {
  const signX = xc < 0 ? 1 : -1;
  const signZ = zc < 0 ? 1 : -1;
  const dx = (x - xc) * signX;
  const dz = (z - zc) * signZ;
  return dx >= 0 && dz >= 0 && dx < size && dz < size && (dx + dz) < size;
}

/**
 * Returns the segment start/end coordinates for the diagonal wall of a collector corner
 */
export function getCollectorDiagonal(xc: number, zc: number, size: number = 30) {
  const signX = xc < 0 ? -1 : 1;
  const signZ = zc < 0 ? -1 : 1;
  return {
    ax: xc - signX * size,
    az: zc,
    bx: xc,
    bz: zc - signZ * size,
  };
}

/**
 * Returns true if the sphere's 2D position is inside the Green collector corner.
 */
export function isInsideGreenCollector(x: number, z: number, collectors: CollectorState[] = [
  { color: 'green', xCorner: -45, zCorner: 60, size: 30, wallHeight: 6 },
  { color: 'red', xCorner: 45, zCorner: 60, size: 30, wallHeight: 6 }
]): boolean {
  const c = collectors.find(col => col.color === 'green');
  if (!c) return false;
  return isInsideCollectorCorner(x, z, c.xCorner, c.zCorner, c.size);
}

/**
 * Returns true if the sphere's 2D position is inside the Red collector corner.
 */
export function isInsideRedCollector(x: number, z: number, collectors: CollectorState[] = [
  { color: 'green', xCorner: -45, zCorner: 60, size: 30, wallHeight: 6 },
  { color: 'red', xCorner: 45, zCorner: 60, size: 30, wallHeight: 6 }
]): boolean {
  const c = collectors.find(col => col.color === 'red');
  if (!c) return false;
  return isInsideCollectorCorner(x, z, c.xCorner, c.zCorner, c.size);
}

/**
 * Distance from point (x, z) to line segment A-B
 */
function distanceToSegment(
  px: number, pz: number, 
  ax: number, az: number, 
  bx: number, bz: number
): { distance: number; closestX: number; closestZ: number } {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;

  const ab_lensq = abx * abx + abz * abz;
  let t = 0;
  if (ab_lensq > 0) {
    t = (apx * abx + apz * abz) / ab_lensq;
    t = Math.max(0, Math.min(1, t));
  }

  const closestX = ax + t * abx;
  const closestZ = az + t * abz;

  const dx = px - closestX;
  const dz = pz - closestZ;
  const distance = Math.sqrt(dx * dx + dz * dz);

  return { distance, closestX, closestZ };
}

function alignRobotToNormal(robot: RobotState, nx: number, nz: number, dt: number, speedThreshold: number = 2) {
  if (Math.abs(robot.speed) < speedThreshold) return;
  
  const nAng = Math.atan2(nx, nz);
  let diff = robot.angle - nAng;
  
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  
  const targetDiff = Math.round(diff / (Math.PI / 2)) * (Math.PI / 2);
  const targetAngle = nAng + targetDiff;
  
  let angleError = targetAngle - robot.angle;
  while (angleError > Math.PI) angleError -= 2 * Math.PI;
  while (angleError < -Math.PI) angleError += 2 * Math.PI;

  const strength = 15.0; // Alignment strength increased for snappier response
  robot.angle += angleError * strength * dt;
}

function getPointToSegmentDist(px: number, pz: number, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  if (dx === 0 && dz === 0) {
    const d = Math.sqrt((px - x1) * (px - x1) + (pz - z1) * (pz - z1));
    return { dist: d, closestX: x1, closestZ: z1 };
  }
  let t = ((px - x1) * dx + (pz - z1) * dz) / (dx * dx + dz * dz);
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx;
  const nz = z1 + t * dz;
  const d = Math.sqrt((px - nx) * (px - nx) + (pz - nz) * (pz - nz));
  return { dist: d, closestX: nx, closestZ: nz };
}

/**
 * Checks if a sphere of radius r at (x, z) with height y is colliding with any walls, collectors, or obstacles.
 */
function isSphereCollidingWithEnvironment(
  x: number,
  z: number,
  y: number,
  r: number,
  specialCorners: SpecialCornerState[],
  collectors: CollectorState[],
  obstacles: Obstacle[]
): boolean {
  // 1. Outer bounds
  if (x < -FLOOR_HALF_W + r) return true;
  if (x > FLOOR_HALF_W - r) return true;
  if (z < -FLOOR_HALF_D + r) return true;
  if (z > FLOOR_HALF_D - r) return true;

  // 2. Perimeter walls of Room 0
  if (z >= -FIELD_HALF_D && z <= FIELD_HALF_D) {
    if (hasWallAtX(-FIELD_HALF_W, z, specialCorners)) {
      if (x < -FIELD_HALF_W + r) return true;
    }
    if (hasWallAtX(FIELD_HALF_W, z, specialCorners)) {
      if (x > FIELD_HALF_W - r) return true;
    }
  }
  if (x >= -FIELD_HALF_W && x <= FIELD_HALF_W) {
    if (hasWallAtZ(x, -FIELD_HALF_D, specialCorners)) {
      if (z < -FIELD_HALF_D + r) return true;
    }
    if (hasWallAtZ(x, FIELD_HALF_D, specialCorners)) {
      if (z > FIELD_HALF_D - r) return true;
    }
  }

  // 3. Collector Walls
  if (y < COLLECTOR_WALL_HEIGHT) {
    for (const col of collectors) {
      const diag = getCollectorDiagonal(col.xCorner, col.zCorner, col.size);
      const segment = distanceToSegment(x, z, diag.ax, diag.az, diag.bx, diag.bz);
      if (segment.distance < r) return true;

      const signX = col.xCorner < 0 ? -1 : 1;
      const signZ = col.zCorner < 0 ? -1 : 1;
      const seg1 = distanceToSegment(x, z, col.xCorner, col.zCorner, col.xCorner - signX * col.size, col.zCorner);
      const seg2 = distanceToSegment(x, z, col.xCorner, col.zCorner, col.xCorner, col.zCorner - signZ * col.size);
      if (seg1.distance < r || seg2.distance < r) return true;
    }
  }

  // 4. Obstacles
  for (const obs of obstacles) {
    if (!obs.type || obs.type === 'cylinder') {
      const cObs = obs as CylindricalObstacle;
      const rot = cObs.rotation || 0;
      const halfLen = (cObs.height || 25) / 2;
      const x1 = cObs.x - Math.cos(rot) * halfLen;
      const z1 = cObs.z - Math.sin(rot) * halfLen;
      const x2 = cObs.x + Math.cos(rot) * halfLen;
      const z2 = cObs.z + Math.sin(rot) * halfLen;

      const res = getPointToSegmentDist(x, z, x1, z1, x2, z2);
      const minDist = r + (cObs.radius || 0.5);
      if (res.dist < minDist) return true;
    } else if (obs.type === 'box') {
      const bObs = obs as BoxObstacle;
      const halfW = bObs.width / 2;
      const halfD = bObs.depth / 2;
      const rot = bObs.rotation || 0;

      const dx = x - bObs.x;
      const dz = z - bObs.z;
      const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
      const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);

      if (Math.abs(localX) < halfW + r && Math.abs(localZ) < halfD + r) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Updates the physical state of spheres and the robot for a single timestep dt.
 */
export function updatePhysics(
  robot: RobotState,
  spheres: SphereState[],
  params: PhysicsParams,
  dt: number, // in seconds
  collectors: CollectorState[] = [],
  specialCorners: SpecialCornerState[] = [],
  tileOverlays: TileOverlay[] = [],
  obstacles: Obstacle[] = []
): { nextRobot: RobotState; nextSpheres: SphereState[] } {
  const nextRobot = { ...robot };
  const nextSpheres = spheres.map(s => ({ ...s }));

  // Robot collision with obstacles
  nextRobot.y = 0; // Default floor height
  let climbResistFactor = 1.0;
  let targetPitch = 0;
  let targetRoll = 0;

  if (dt > 0) {
    const rRadius = Math.max(nextRobot.width, nextRobot.length) / 2;
    let onAnyRamp = false;
    for (const obs of obstacles) {
      if (!obs.type || obs.type === 'cylinder') {
        const cObs = obs as CylindricalObstacle;
        const rot = cObs.rotation || 0;
        const halfLen = (cObs.height || 25) / 2;
        const x1 = cObs.x - Math.cos(rot) * halfLen;
        const z1 = cObs.z - Math.sin(rot) * halfLen;
        const x2 = cObs.x + Math.cos(rot) * halfLen;
        const z2 = cObs.z + Math.sin(rot) * halfLen;

        const collisionRes = getPointToSegmentDist(nextRobot.x, nextRobot.z, x1, z1, x2, z2);
        
        const climbRadius = Math.min(nextRobot.width, nextRobot.length) / 2;
        if (collisionRes.dist < climbRadius) {
          const factor = Math.max(0, 1 - collisionRes.dist / climbRadius);
          const obstacleHeight = cObs.radius * 2;
          nextRobot.y = Math.max(nextRobot.y, obstacleHeight * factor);
          climbResistFactor = Math.min(climbResistFactor, 1.0 - (factor * 0.75));
        }
      } else if (obs.type === 'box') {
        const bObs = obs as BoxObstacle;
        const halfW = bObs.width / 2;
        const halfD = bObs.depth / 2;
        const rot = bObs.rotation || 0;
        
        // Transform robot position into box local space
        const dx = nextRobot.x - bObs.x;
        const dz = nextRobot.z - bObs.z;
        const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
        const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);
        
        // Distance to box boundaries in local space
        const distX = Math.abs(localX) - (halfW + rRadius);
        const distZ = Math.abs(localZ) - (halfD + rRadius);
        
        if (distX < 0 && distZ < 0) {
          // Collision! Push back along the shallowest axis
          if (distX > distZ) {
            const push = distX;
            const nx = localX > 0 ? 1 : -1;
            // Back to world space
            const worldNx = nx * Math.cos(rot);
            const worldNz = nx * Math.sin(rot);
            nextRobot.x -= worldNx * push;
            nextRobot.z -= worldNz * push;
            alignRobotToNormal(nextRobot, -worldNx, -worldNz, dt);
          } else {
            const push = distZ;
            const nz = localZ > 0 ? 1 : -1;
            // Back to world space
            const worldNx = -nz * Math.sin(rot);
            const worldNz = nz * Math.cos(rot);
            nextRobot.x -= worldNx * push;
            nextRobot.z -= worldNz * push;
            alignRobotToNormal(nextRobot, -worldNx, -worldNz, dt);
          }
        }
      } else if (obs.type === 'ramp') {
        const rObs = obs as RampObstacle;
        const halfW = rObs.width / 2;
        const halfD = rObs.depth / 2;
        const rot = rObs.rotation || 0;
        
        // Transform robot position into ramp local space
        const dx = nextRobot.x - rObs.x;
        const dz = nextRobot.z - rObs.z;
        const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
        const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);
        
        // Approximate robot footprint
        const rW = nextRobot.width / 2;
        const rL = nextRobot.length / 2;
        
        // Check if robot is within the ramp boundaries
        if (Math.abs(localX) < halfW + rW && Math.abs(localZ) < halfD + rL) {
          onAnyRamp = true;
          // Linear height based on local Z
          // From -halfD (0 height) to +halfD (rObs.height)
          const factor = Math.max(0, Math.min(1, (localZ + halfD) / (halfD * 2)));
          const rampHeightAtCenter = rObs.height * (factor + 0.05); // Small boost at start
          
          nextRobot.y = Math.max(nextRobot.y, rampHeightAtCenter);
          
          // Count how many wheels are supported
          const dWheel = rL * 0.8;
          const dW_side = rW * 0.8;
          const relAngle = nextRobot.angle - rot;
          const fx = Math.sin(relAngle);
          const fz = Math.cos(relAngle);
          const rx = Math.cos(relAngle);
          const rz = -Math.sin(relAngle);

          const wheelsLocal = [
            { lx: localX + dWheel * fx + dW_side * rx, lz: localZ + dWheel * fz + dW_side * rz },
            { lx: localX + dWheel * fx - dW_side * rx, lz: localZ + dWheel * fz - dW_side * rz },
            { lx: localX - dWheel * fx + dW_side * rx, lz: localZ - dWheel * fz + dW_side * rz },
            { lx: localX - dWheel * fx - dW_side * rx, lz: localZ - dWheel * fz - dW_side * rz }
          ];
          // A wheel is supported if it's outside the ramp's longitudinal range (on normal flat ground/platform)
          // or if it's on the ramp deck within its lateral width.
          const supportedWheelsCount = wheelsLocal.filter(w => {
            const isInsideLongitudinal = w.lz >= -halfD && w.lz <= halfD;
            if (isInsideLongitudinal) {
              return Math.abs(w.lx) <= halfW;
            }
            return true; // Supported by normal floor or platform
          }).length;

          const frictionVal = params.wheelFriction ?? 0.55;
          // If only 2 wheels or fewer are supported (meaning it's hanging off the side laterally), the effective friction drops significantly
          const effectiveFriction = supportedWheelsCount <= 2 ? frictionVal * 0.25 : frictionVal;

          // Mark standstill climb restriction if robot was already on the ramp and speed is ~ 0
          // This keeps it from climbing if it originates from a standstill on the ramp,
          // but we bypass this restriction if wheel friction is very high.
          if (Math.abs(robot.speed) < 1.0 && effectiveFriction < 0.95) {
            nextRobot.rampClimbBlocked = true;
          }

          // Resistance and climbing logic when going up
          if (localZ > -halfD && localZ < halfD) {
            const headingDotRamp = Math.sin(nextRobot.angle) * (-Math.sin(rot)) + Math.cos(nextRobot.angle) * Math.cos(rot);
            const isDrivingUp = nextRobot.speed * headingDotRamp > 0;

            if (isDrivingUp) {
              const reqSpeed = 10 + Math.pow(1 - effectiveFriction, 1.5) * 80;
              const currentSpeed = Math.abs(nextRobot.speed);

              if ((nextRobot.rampClimbBlocked || currentSpeed < reqSpeed) && effectiveFriction < 0.95) {
                // Cannot climb! Spin wheels and slide backwards down the ramp
                climbResistFactor = -0.3;
              } else {
                // Can climb! Slight resistance, or boost if high friction
                climbResistFactor = effectiveFriction > 0.9 ? 1.2 : 0.85;
              }
            } else {
              // Driving down or neutral: goes down slightly easier
              climbResistFactor = Math.min(climbResistFactor, 1.1);
            }
          }

          // Calculate tilt (pitch and roll) relative to the slope
          if (Math.abs(localX) < halfW && localZ >= -halfD && localZ <= halfD) {
            const slopeAngle = Math.atan2(rObs.height, halfD * 2);

            // In local coordinates of the ramp, normal is (0, cos(slope), -sin(slope))
            const nLocalX = 0;
            const nLocalY = Math.cos(slopeAngle);
            const nLocalZ = -Math.sin(slopeAngle);

            // Transform local normal to world space (rotate by rot around Y)
            const nWorldX = nLocalX * Math.cos(rot) - nLocalZ * Math.sin(rot);
            const nWorldY = nLocalY;
            const nWorldZ = nLocalX * Math.sin(rot) + nLocalZ * Math.cos(rot);

            // Transform world normal into robot's current local frame
            const robotLocalNx = nWorldX * Math.cos(nextRobot.angle) - nWorldZ * Math.sin(nextRobot.angle);
            const robotLocalNz = nWorldX * Math.sin(nextRobot.angle) + nWorldZ * Math.cos(nextRobot.angle);
            const robotLocalNy = nWorldY;

            // Pitch & roll calculations
            targetPitch = Math.atan2(robotLocalNz, robotLocalNy);
            targetRoll = -Math.atan2(robotLocalNx, robotLocalNy);
          }
        }
      } else if (obs.type === 'platform') {
        const pObs = obs as PlatformObstacle;
        const halfW = pObs.width / 2;
        const halfD = pObs.depth / 2;
        const rot = pObs.rotation || 0;
        
        const dx = nextRobot.x - pObs.x;
        const dz = nextRobot.z - pObs.z;
        const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
        const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);
        
        const rW = nextRobot.width / 2;
        const rL = nextRobot.length / 2;
        
        if (Math.abs(localX) < halfW + rW && Math.abs(localZ) < halfD + rL) {
          // Se arriva dall'alto o se è già salito
          const reqSpeed = 10 + Math.pow(1 - (params.wheelFriction ?? 0.55), 1.5) * 80;
          const condition1 = nextRobot.y >= pObs.height - 30.0;
          const condition2 = Math.abs(nextRobot.speed) > reqSpeed;
          if (condition1 || condition2) { 
            onAnyRamp = true;
            nextRobot.y = Math.max(nextRobot.y, pObs.height);
          } else {
            // Urto, prova a sollevarlo se è vicino al bordo e si muove verso la piattaforma
            const isMovingTowards = (localZ < 0 && nextRobot.speed > 0) || (localZ > 0 && nextRobot.speed < 0);
            if (isMovingTowards && nextRobot.y > pObs.height - 20) {
              onAnyRamp = true;
              nextRobot.y = Math.max(nextRobot.y, pObs.height);
            } else {
              // Urto frontale (muro), lo spingiamo fuori
              let pushX = 0;
              let pushZ = 0;
              if (Math.abs(localX) - (halfW + rW) > Math.abs(localZ) - (halfD + rL)) {
                pushX = Math.sign(localX) * (halfW + rW - Math.abs(localX));
              } else {
                pushZ = Math.sign(localZ) * (halfD + rL - Math.abs(localZ));
              }
              
              const worldPushX = pushX * Math.cos(rot) - pushZ * Math.sin(rot);
              const worldPushZ = pushX * Math.sin(rot) + pushZ * Math.cos(rot);
              
              nextRobot.x += worldPushX;
              nextRobot.z += worldPushZ;
              
              // Align robot normally against wall
              const nx = pushX === 0 ? 0 : Math.sign(pushX);
              const nz = pushZ === 0 ? 0 : Math.sign(pushZ);
              const worldNx = nx * Math.cos(rot) - nz * Math.sin(rot);
              const worldNz = nx * Math.sin(rot) + nz * Math.cos(rot);
              alignRobotToNormal(nextRobot, -worldNx, -worldNz, dt);
            }
          }
        }
      } else if (obs.type === 'seesaw') {
        const sObs = obs as SeesawObstacle;
        const halfW = 15; // Width is 30 cm
        const halfD = 15; // Depth is 30 cm
        const rot = sObs.rotation || 0;

        // Transform robot position into seesaw local space
        const dx = nextRobot.x - sObs.x;
        const dz = nextRobot.z - sObs.z;
        const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
        const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);

        const rW = nextRobot.width / 2;
        const rL = nextRobot.length / 2;

        if (Math.abs(localX) < halfW + rW && Math.abs(localZ) < halfD + rL) {
          onAnyRamp = true;

          // Pivot height is 5.5 cm as described by user
          const axisHeight = 5.5; 

          // Max tilt angle so that the edge touches the ground:
          // sin(thetaMax) = 5.5 / 15 => thetaMax = asin(5.5 / 15) ~ 0.375
          const thetaMax = Math.asin(axisHeight / halfD);

          // The seesaw features a weight asymmetry (weighs slightly more on the entry side (localZ < 0)).
          // We model this by evaluating the net torque about the pivot axis.
          const rMass = params?.massRobot ?? 5.0;
          const torqueBias = 15.0; // Positive torque favors the entry side being down (positive angle, thetaMax)
          const torque = -rMass * localZ + torqueBias;

          // If net torque is negative, tilt forward (exit side down, target angle = -thetaMax)
          // If net torque is positive, tilt backward (entry side down, target angle = thetaMax)
          const targetAngle = torque < 0 ? -thetaMax : thetaMax;

          if (sObs.currentAngle === undefined) {
            sObs.currentAngle = thetaMax; // Default resting tilted position
          }

          // Transition smoothly towards target angle
          const interpolationSpeed = 6.0; // rad/s
          sObs.currentAngle += (targetAngle - sObs.currentAngle) * Math.min(1, dt * interpolationSpeed);

          const alpha = sObs.currentAngle;

          // Compute robot pitch and roll based on simulated axle heights
          // Axle distances from the robot's center
          const dWheel = rL * 0.8; // 80% of half length to represent wheel base
          const dW_side = rW * 0.8; // 80% of half width for wheel track width

          // Robot heading unit vector in seesaw local space
          const relAngle = nextRobot.angle - rot;
          const fx = Math.sin(relAngle);
          const fz = Math.cos(relAngle);

          // Front and Rear wheel line center positions across the axle
          const frontX = localX + dWheel * fx;
          const frontZ = localZ + dWheel * fz;
          const rearX = localX - dWheel * fx;
          const rearZ = localZ - dWheel * fz;

          // Left and Right wheel line center positions across the track width
          // Roll is orthogonal to forward heading
          const rx = Math.cos(relAngle);
          const rz = -Math.sin(relAngle);

          // Ground height formula for any local point (lx, lz) on or off the tilted deck
          const getGroundHeightAtLocal = (lx: number, lz: number): number => {
            if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfD) {
              return Math.max(0, axisHeight + lz * Math.sin(alpha));
            }
            return 0; // Flat floor
          };

          // Get exact heights at all 4 corners of wheels contact path
          // (rx, rz) points to the right of the robot, so adding it gives the right-side wheels, while subtracting gives the left-side wheels.
          const hFrontRight = getGroundHeightAtLocal(frontX + dW_side * rx, frontZ + dW_side * rz);
          const hFrontLeft  = getGroundHeightAtLocal(frontX - dW_side * rx, frontZ - dW_side * rz);
          const hRearRight  = getGroundHeightAtLocal(rearX + dW_side * rx, rearZ + dW_side * rz);
          const hRearLeft   = getGroundHeightAtLocal(rearX - dW_side * rx, rearZ - dW_side * rz);

          // Average heights for main alignment axes
          const hFront = (hFrontLeft + hFrontRight) / 2;
          const hRear  = (hRearLeft + hRearRight) / 2;
          const hLeft  = (hFrontLeft + hRearLeft) / 2;
          const hRight = (hFrontRight + hRearRight) / 2;

          // Continuous vertical position of center based on wheel contacts
          const averageHeight = (hFront + hRear) / 2;
          nextRobot.y = Math.max(nextRobot.y, averageHeight);

          // Calculate continuous pitches and rolls smoothly
          const clampedPitchRatio = Math.max(-1, Math.min(1, (hFront - hRear) / (2 * dWheel || 1)));
          targetPitch = -Math.asin(clampedPitchRatio);

          const clampedRollRatio = Math.max(-1, Math.min(1, (hLeft - hRight) / (2 * dW_side || 1)));
          targetRoll = -Math.asin(clampedRollRatio);

          // Count how many wheels are supported
          const wheelsLocalSeesaw = [
            { lx: frontX + dW_side * rx, lz: frontZ + dW_side * rz },
            { lx: frontX - dW_side * rx, lz: frontZ - dW_side * rz },
            { lx: rearX + dW_side * rx, lz: rearZ + dW_side * rz },
            { lx: rearX - dW_side * rx, lz: rearZ - dW_side * rz }
          ];
          // A wheel is supported if it's outside the seesaw's longitudinal range (on normal flat ground/platform)
          // or if it's on the seesaw deck within its lateral width.
          const supportedWheelsCount = wheelsLocalSeesaw.filter(w => {
            const isInsideLongitudinal = w.lz >= -halfD && w.lz <= halfD;
            if (isInsideLongitudinal) {
              return Math.abs(w.lx) <= halfW;
            }
            return true; // Supported by normal floor or platform
          }).length;

          const frictionVal = params.wheelFriction ?? 0.55;
          // If only 2 wheels or fewer are supported (meaning it's hanging off the side laterally), the effective friction drops significantly
          const effectiveFriction = supportedWheelsCount <= 2 ? frictionVal * 0.25 : frictionVal;

          // Apply climb resistance based on wheelFriction on the seesaw (altalena)
          // If moving upwards (height increases as we go), apply friction check
          const isClimbingSeesaw = (nextRobot.speed * fz * Math.sin(alpha)) > 0;
          if (isClimbingSeesaw) {
            if (Math.abs(robot.speed) < 1.0 && effectiveFriction < 0.95) {
              nextRobot.rampClimbBlocked = true;
            }

            const reqSpeed = 10 + Math.pow(1 - effectiveFriction, 1.5) * 80;
            const currentSpeed = Math.abs(nextRobot.speed);

            if ((nextRobot.rampClimbBlocked || currentSpeed < reqSpeed) && effectiveFriction < 0.95) {
              // Cannot climb! Spin wheels and slide back down the slope
              climbResistFactor = -0.3;
            } else {
              // Can climb! Slight resistance or boost if high friction
              climbResistFactor = effectiveFriction > 0.9 ? 1.2 : 0.85;
            }
          } else {
            // Going down or flat: normal movement, slightly easier
            climbResistFactor = Math.min(climbResistFactor, 1.1);
          }
        } else {
          // Slowly tilt back to default resting angle (thetaMax)
          const axisHeight = 5.5; 
          const thetaMax = Math.asin(axisHeight / halfD);
          if (sObs.currentAngle === undefined) {
            sObs.currentAngle = thetaMax;
          }
          sObs.currentAngle += (thetaMax - sObs.currentAngle) * Math.min(1, dt * 4.0);
        }
      }
    }
    if (!onAnyRamp) {
      nextRobot.rampClimbBlocked = false;
    }
    // Smoothly blend pitch and roll values towards target values
    nextRobot.pitch = (nextRobot.pitch ?? 0) + (targetPitch - (nextRobot.pitch ?? 0)) * Math.min(1, dt * 10);
    nextRobot.roll = (nextRobot.roll ?? 0) + (targetRoll - (nextRobot.roll ?? 0)) * Math.min(1, dt * 10);
  } else {
    nextRobot.pitch = targetPitch;
    nextRobot.roll = targetRoll;
  }

  // 1. Robot Motion Update with Inertia & Friction
  // Apply forces/torques or direct velocity step with friction decay
  const frictionDecay = Math.pow(1 - params.friction * 4, dt);
  nextRobot.speed *= frictionDecay;
  nextRobot.angularSpeed *= frictionDecay;

  // Move robot based on speeds
  // dx = speed * sin(angle), dz = speed * cos(angle)
  const moveX = nextRobot.speed * Math.sin(nextRobot.angle) * dt * climbResistFactor;
  const moveZ = nextRobot.speed * Math.cos(nextRobot.angle) * dt * climbResistFactor;

  nextRobot.x += moveX;
  nextRobot.z += moveZ;
  nextRobot.angle += nextRobot.angularSpeed * dt;

  // Wrap or clamp robot angle
  if (nextRobot.angle > Math.PI) nextRobot.angle -= 2 * Math.PI;
  if (nextRobot.angle < -Math.PI) nextRobot.angle += 2 * Math.PI;

  // Keep robot inside the field (taking size into account, width/length)
  // Simple bounding box for robot (oriented along its angle) - approximate boundaries
  const rRadius = Math.max(nextRobot.width, nextRobot.length) / 2;
  const rooms = getTiledRooms(specialCorners);
  const prevRoom = getRoomForPoint(robot.x, robot.z, rooms);

  // Outer boundary containment: keep robot within the 500x500 floor
  // During normal movement (dt > 0), we can apply the radius buffer to keep it physically on top.
  if (dt > 0) {
    const edgeBuffer = rRadius;
    
    if (nextRobot.x < -FLOOR_HALF_W + edgeBuffer) {
      nextRobot.x = -FLOOR_HALF_W + edgeBuffer;
      alignRobotToNormal(nextRobot, 1, 0, dt);
    }
    if (nextRobot.x > FLOOR_HALF_W - edgeBuffer) {
      nextRobot.x = FLOOR_HALF_W - edgeBuffer;
      alignRobotToNormal(nextRobot, -1, 0, dt);
    }
    if (nextRobot.z < -FLOOR_HALF_D + edgeBuffer) {
      nextRobot.z = -FLOOR_HALF_D + edgeBuffer;
      alignRobotToNormal(nextRobot, 0, 1, dt);
    }
    if (nextRobot.z > FLOOR_HALF_D - edgeBuffer) {
      nextRobot.z = FLOOR_HALF_D - edgeBuffer;
      alignRobotToNormal(nextRobot, 0, -1, dt);
    }
  }

  // Cross-room wall collision checking (the four main perimeter walls of Room 0)
  // Disable these rigid push-backs if dt is 0 (manual teleport/idle mode)
  if (dt > 0) {
    const wallBuffer = rRadius;
    
    // 1. West Wall of Main Arena (at X = -FIELD_HALF_W)
    if (nextRobot.z >= -FIELD_HALF_D && nextRobot.z <= FIELD_HALF_D) {
      if (hasWallAtX(-FIELD_HALF_W, nextRobot.z, specialCorners)) {
          if (robot.x >= -FIELD_HALF_W) {
            if (nextRobot.x < -FIELD_HALF_W + wallBuffer) {
              nextRobot.x = -FIELD_HALF_W + wallBuffer;
              alignRobotToNormal(nextRobot, 1, 0, dt);
            }
          } else {
            if (nextRobot.x > -FIELD_HALF_W - wallBuffer) {
              nextRobot.x = -FIELD_HALF_W - wallBuffer;
              alignRobotToNormal(nextRobot, -1, 0, dt);
            }
          }
      }
    }

    // 2. East Wall of Main Arena (at X = FIELD_HALF_W)
    if (nextRobot.z >= -FIELD_HALF_D && nextRobot.z <= FIELD_HALF_D) {
      if (hasWallAtX(FIELD_HALF_W, nextRobot.z, specialCorners)) {
          if (robot.x <= FIELD_HALF_W) {
            if (nextRobot.x > FIELD_HALF_W - wallBuffer) {
              nextRobot.x = FIELD_HALF_W - wallBuffer;
              alignRobotToNormal(nextRobot, -1, 0, dt);
            }
          } else {
            if (nextRobot.x < FIELD_HALF_W + wallBuffer) {
              nextRobot.x = FIELD_HALF_W + wallBuffer;
              alignRobotToNormal(nextRobot, 1, 0, dt);
            }
          }
      }
    }

    // 3. North Wall of Main Arena (at Z = -FIELD_HALF_D)
    if (nextRobot.x >= -FIELD_HALF_W && nextRobot.x <= FIELD_HALF_W) {
      if (hasWallAtZ(nextRobot.x, -FIELD_HALF_D, specialCorners)) {
          if (robot.z >= -FIELD_HALF_D) {
            if (nextRobot.z < -FIELD_HALF_D + wallBuffer) {
              nextRobot.z = -FIELD_HALF_D + wallBuffer;
              alignRobotToNormal(nextRobot, 0, 1, dt);
            }
          } else {
            if (nextRobot.z > -FIELD_HALF_D - wallBuffer) {
              nextRobot.z = -FIELD_HALF_D - wallBuffer;
              alignRobotToNormal(nextRobot, 0, -1, dt);
            }
          }
      }
    }

    // 4. South Wall of Main Arena (at Z = FIELD_HALF_D)
    if (nextRobot.x >= -FIELD_HALF_W && nextRobot.x <= FIELD_HALF_W) {
      if (hasWallAtZ(nextRobot.x, FIELD_HALF_D, specialCorners)) {
          if (robot.z <= FIELD_HALF_D) {
            if (nextRobot.z > FIELD_HALF_D - wallBuffer) {
              nextRobot.z = FIELD_HALF_D - wallBuffer;
              alignRobotToNormal(nextRobot, 0, -1, dt);
            }
          } else {
            if (nextRobot.z < FIELD_HALF_D + wallBuffer) {
              nextRobot.z = FIELD_HALF_D + wallBuffer;
              alignRobotToNormal(nextRobot, 0, 1, dt);
            }
          }
      }
    }
  }

  // 1.5 Robot Collision with Triangular Collector Walls and Perimeter Walls (Including Low Claw)
  if (dt > 0) {
    const dirX = Math.sin(nextRobot.angle);
    const dirZ = Math.cos(nextRobot.angle);
    const rightX = Math.cos(nextRobot.angle);
    const rightZ = -Math.sin(nextRobot.angle);
    const hw = nextRobot.width / 2;
    const hl = nextRobot.length / 2;

    const corners = [
      { x: nextRobot.x + dirX * hl - rightX * hw, z: nextRobot.z + dirZ * hl - rightZ * hw }, // FL
      { x: nextRobot.x + dirX * hl + rightX * hw, z: nextRobot.z + dirZ * hl + rightZ * hw }, // FR
      { x: nextRobot.x - dirX * hl - rightX * hw, z: nextRobot.z - dirZ * hl - rightZ * hw }, // BL
      { x: nextRobot.x - dirX * hl + rightX * hw, z: nextRobot.z - dirZ * hl + rightZ * hw }  // BR
    ];

    // If claw is low, we also consider claw tips as robot boundary collision vertices
    if (nextRobot.armHeight < 0.2) {
      const clawDistance = 14.0;
      const clawShift = 1.0 + nextRobot.clawOpen * 5.0;
      const ctl = {
        x: nextRobot.x + dirX * clawDistance - rightX * clawShift,
        z: nextRobot.z + dirZ * clawDistance - rightZ * clawShift
      };
      const ctr = {
        x: nextRobot.x + dirX * clawDistance + rightX * clawShift,
        z: nextRobot.z + dirZ * clawDistance + rightZ * clawShift
      };
      const ctc = {
        x: nextRobot.x + dirX * clawDistance,
        z: nextRobot.z + dirZ * clawDistance
      };
      corners.push(ctl, ctr);

      const clawPoints = [ctl, ctr, ctc];
      let hitClawWall = false;

      // Check perimeter wall collisions for each claw point
      for (const pt of clawPoints) {
        // 1. West wall of Main Arena (at X = -FIELD_HALF_W)
        if (pt.z >= -FIELD_HALF_D && pt.z <= FIELD_HALF_D) {
          if (hasWallAtX(-FIELD_HALF_W, pt.z, specialCorners)) {
            if (robot.x >= -FIELD_HALF_W && pt.x < -FIELD_HALF_W) {
              const penetration = -FIELD_HALF_W - pt.x;
              nextRobot.x += penetration;
              hitClawWall = true;
            }
          }
        }
        // 2. East wall of Main Arena (at X = FIELD_HALF_W)
        if (pt.z >= -FIELD_HALF_D && pt.z <= FIELD_HALF_D) {
          if (hasWallAtX(FIELD_HALF_W, pt.z, specialCorners)) {
            if (robot.x <= FIELD_HALF_W && pt.x > FIELD_HALF_W) {
              const penetration = pt.x - FIELD_HALF_W;
              nextRobot.x -= penetration;
              hitClawWall = true;
            }
          }
        }
        // 3. North wall of Main Arena (at Z = -FIELD_HALF_D)
        if (pt.x >= -FIELD_HALF_W && pt.x <= FIELD_HALF_W) {
          if (hasWallAtZ(pt.x, -FIELD_HALF_D, specialCorners)) {
            if (robot.z >= -FIELD_HALF_D && pt.z < -FIELD_HALF_D) {
              const penetration = -FIELD_HALF_D - pt.z;
              nextRobot.z += penetration;
              hitClawWall = true;
            }
          }
        }
        // 4. South wall of Main Arena (at Z = FIELD_HALF_D)
        if (pt.x >= -FIELD_HALF_W && pt.x <= FIELD_HALF_W) {
          if (hasWallAtZ(pt.x, FIELD_HALF_D, specialCorners)) {
            if (robot.z <= FIELD_HALF_D && pt.z > FIELD_HALF_D) {
              const penetration = pt.z - FIELD_HALF_D;
              nextRobot.z -= penetration;
              hitClawWall = true;
            }
          }
        }
      }

      // Check collector corner wall collisions for each claw point
      for (const col of collectors) {
        const signX = col.xCorner < 0 ? -1 : 1;
        const signZ = col.zCorner < 0 ? -1 : 1;
        const nx = -signX / Math.SQRT2;
        const nz = -signZ / Math.SQRT2;

        for (const pt of clawPoints) {
          const d = signX * (pt.x - col.xCorner) + signZ * (pt.z - col.zCorner) + col.size;
          const pen = d / Math.SQRT2;

          const inXBound = signX < 0 ? (pt.x >= col.xCorner && pt.x <= col.xCorner + col.size) : (pt.x <= col.xCorner && pt.x >= col.xCorner - col.size);
          const inZBound = signZ < 0 ? (pt.z >= col.zCorner && pt.z <= col.zCorner + col.size) : (pt.z <= col.zCorner && pt.z >= col.zCorner - col.size);

          if (inXBound && inZBound && pen > 0) {
            nextRobot.x += nx * pen;
            nextRobot.z += nz * pen;
            hitClawWall = true;
          }
        }
      }

      // Check outer floor perimeter bounds for claw points
      for (const pt of clawPoints) {
        if (pt.x < -FLOOR_HALF_W) { nextRobot.x += (-FLOOR_HALF_W - pt.x); hitClawWall = true; }
        if (pt.x > FLOOR_HALF_W) { nextRobot.x -= (pt.x - FLOOR_HALF_W); hitClawWall = true; }
        if (pt.z < -FLOOR_HALF_D) { nextRobot.z += (-FLOOR_HALF_D - pt.z); hitClawWall = true; }
        if (pt.z > FLOOR_HALF_D) { nextRobot.z -= (pt.z - FLOOR_HALF_D); hitClawWall = true; }
      }

      if (hitClawWall) {
        // speed remains unchanged to simulate slipping wheels
        nextRobot.clawWallHit = true;
      }
    }

    for (const col of collectors) {
      const signX = col.xCorner < 0 ? -1 : 1;
      const signZ = col.zCorner < 0 ? -1 : 1;
      
      // Normal direction pushing AWAY from the corner
      const nx = -signX / Math.SQRT2;
      const nz = -signZ / Math.SQRT2;

      let maxPen = 0;
      for (const c of corners) {
        // Distance function: D > 0 means the corner penetrates the diagonal
        const d = signX * (c.x - col.xCorner) + signZ * (c.z - col.zCorner) + col.size;
        const pen = d / Math.SQRT2;
        
        const inXBound = signX < 0 ? (c.x >= col.xCorner && c.x <= col.xCorner + col.size) : (c.x <= col.xCorner && c.x >= col.xCorner - col.size);
        const inZBound = signZ < 0 ? (c.z >= col.zCorner && c.z <= col.zCorner + col.size) : (c.z <= col.zCorner && c.z >= col.zCorner - col.size);

        if (inXBound && inZBound && pen > maxPen) {
          maxPen = pen;
        }
      }

      if (maxPen > 0) {
        nextRobot.x += nx * maxPen;
        nextRobot.z += nz * maxPen;
        alignRobotToNormal(nextRobot, nx, nz, dt);
      }
    }
  }

  // 2. Grabbing Logistics
  // Claw Position relative to Robot:
  // Forward is in the direction of nextRobot.angle
  // The fingers span from local Z=6 to Z=14. The "center" of the gripper area is at local Z=10.0
  const gripperCenterDist = 10.0;
  const clawX = nextRobot.x + gripperCenterDist * Math.sin(nextRobot.angle);
  const clawZ = nextRobot.z + gripperCenterDist * Math.cos(nextRobot.angle);

  // If we have a held sphere, update its position to match the claw
  // Elevate sphere based on armHeight (lowered down to 3.0 base, then +3.0 to sit ON TOP of plate)
  const targetSphereY = nextRobot.y + 6.0 + nextRobot.armHeight * 15.0;

  if (nextRobot.isGrippingId !== null) {
    const heldIdx = nextSpheres.findIndex(s => s.id === nextRobot.isGrippingId);
    if (heldIdx !== -1) {
      if (nextRobot.clawOpen > 0.40) {
        // Released! Give it the current robot's kinetic speed + slight release impulse
        const released = nextSpheres[heldIdx];
        released.isHeld = false;
        // Release with robot velocity + a bit of forward kick
        const robVX = nextRobot.speed * Math.sin(nextRobot.angle);
        const robVZ = nextRobot.speed * Math.cos(nextRobot.angle);
        released.vx = robVX + Math.sin(nextRobot.angle) * 5 + (Math.random() - 0.5) * 4;
        released.vz = robVZ + Math.cos(nextRobot.angle) * 5 + (Math.random() - 0.5) * 4;
        released.vy = -25.0; // Strong downward push to overcome any collision sticking
        nextRobot.isGrippingId = null;
      } else {
        // Locked inside claw
        const held = nextSpheres[heldIdx];
        held.isHeld = true;
        held.x = clawX;
        held.z = clawZ;
        held.y = targetSphereY;
        held.vx = 0;
        held.vz = 0;
        held.vy = 0;
      }
    } else {
      nextRobot.isGrippingId = null;
    }
  } else {
    // If claw is closing or closed and some sphere is inside the gripper area, grab it!
    // Sphere diameter is 5.0. Fingers gap is 2.0 + clawOpen * 10.0.
    // If clawOpen <= 0.40, the gap is starting to "pinch" or enclose.
    const prevOpen = nextRobot.prevClawOpen !== undefined ? nextRobot.prevClawOpen : 1.0;
    if (nextRobot.clawOpen <= 0.40 && prevOpen > 0.40) {
      for (const s of nextSpheres) {
        if (!s.isHeld) {
          // Check if sphere is within the Z volume of fingers (local Z 6 to 14) 
          // and centered enough in X.
          const rx = s.x - nextRobot.x;
          const rz = s.z - nextRobot.z;
          // Rotate sphere into robot local coordinate system
          const localX = rx * Math.cos(nextRobot.angle) - rz * Math.sin(nextRobot.angle);
          const localZ = rx * Math.sin(nextRobot.angle) + rz * Math.cos(nextRobot.angle);

          // Fingers are at local Z = 6 to 14. Give some tolerance.
          const inZRange = localZ > 7.0 && localZ < 13.0;
          const inXRange = Math.abs(localX) < 2.5; 
          const inYRange = Math.abs(s.y - targetSphereY) < 6.0; // Ensure ball matches claw height

          if (inZRange && inXRange && inYRange) {
            nextRobot.isGrippingId = s.id;
            s.isHeld = true;
            break;
          }
        }
      }
    }
  }

  // 3. Spheres Physics Updates (Motion, gravity, friction)
  const gravity = 981.0; // cm/s^2 (Standard Earth gravity)
  for (const s of nextSpheres) {
    if (s.isHeld) continue;

    // Apply gravity
    if (s.y > 2.5) {
      s.vy -= gravity * dt;
    } else if (s.y < 2.5) {
      // Correct any slight penetration
      s.y = 2.5;
      if (s.vy < 0) s.vy = -s.vy * 0.2; // Small floor bounce
    } else {
      s.vy = 0;
    }

    // Apply rolling/sliding friction (Sand-filled balls have specific friction adjustment)
    const sphereFrictionDecay = Math.exp(-params.sphereFriction * 2.0 * dt);
    s.vx *= sphereFrictionDecay;
    s.vz *= sphereFrictionDecay;

    // Apply movement
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.y += s.vy * dt;

    // Bounce off floor if it dropped
    if (s.y < 2.5) {
      s.y = 2.5;
      if (Math.abs(s.vy) > 10) {
        const sandRestitution = params.restitution * 0.25;
        s.vy = -s.vy * sandRestitution; // bounce
      } else {
        s.vy = 0;
      }
    }

    // A. Wall Collisions (Outer Field limits defined by available tiled rooms, and perimeter walls)
    // Sand balls are "dead" and don't bounce much
    const bounceVelocityRetain = params.restitution * 0.25; 
    const boundaryBuffer = s.radius;

    const prevX = s.x - s.vx * dt;
    const prevZ = s.z - s.vz * dt;

    // Outer boundary containment: keep sphere within the 500x500 floor
    if (s.x < -FLOOR_HALF_W + boundaryBuffer) {
      s.x = -FLOOR_HALF_W + boundaryBuffer;
      s.vx = -s.vx * bounceVelocityRetain;
    }
    if (s.x > FLOOR_HALF_W - boundaryBuffer) {
      s.x = FLOOR_HALF_W - boundaryBuffer;
      s.vx = -s.vx * bounceVelocityRetain;
    }
    if (s.z < -FLOOR_HALF_D + boundaryBuffer) {
      s.z = -FLOOR_HALF_D + boundaryBuffer;
      s.vz = -s.vz * bounceVelocityRetain;
    }
    if (s.z > FLOOR_HALF_D - boundaryBuffer) {
      s.z = FLOOR_HALF_D - boundaryBuffer;
      s.vz = -s.vz * bounceVelocityRetain;
    }

    if (dt > 0) {
      // Cross-room wall collision checking (the four main perimeter walls of Room 0)
      // 1. West Wall of Main Arena (at X = -FIELD_HALF_W)
      if (s.z >= -FIELD_HALF_D && s.z <= FIELD_HALF_D) {
        if (hasWallAtX(-FIELD_HALF_W, s.z, specialCorners)) {
            if (prevX >= -FIELD_HALF_W) {
              if (s.x < -FIELD_HALF_W + boundaryBuffer) {
                s.x = -FIELD_HALF_W + boundaryBuffer;
                s.vx = -s.vx * bounceVelocityRetain;
              }
            } else {
              if (s.x > -FIELD_HALF_W - boundaryBuffer) {
                s.x = -FIELD_HALF_W - boundaryBuffer;
                s.vx = -s.vx * bounceVelocityRetain;
              }
            }
        }
      }
      // 2. East Wall of Main Arena (at X = FIELD_HALF_W)
      if (s.z >= -FIELD_HALF_D && s.z <= FIELD_HALF_D) {
        if (hasWallAtX(FIELD_HALF_W, s.z, specialCorners)) {
            if (prevX <= FIELD_HALF_W) {
              if (s.x > FIELD_HALF_W - boundaryBuffer) {
                s.x = FIELD_HALF_W - boundaryBuffer;
                s.vx = -s.vx * bounceVelocityRetain;
              }
            } else {
              if (s.x < FIELD_HALF_W + boundaryBuffer) {
                s.x = FIELD_HALF_W + boundaryBuffer;
                s.vx = -s.vx * bounceVelocityRetain;
              }
            }
        }
      }
      // 3. North Wall of Main Arena (at Z = -FIELD_HALF_D)
      if (s.x >= -FIELD_HALF_W && s.x <= FIELD_HALF_W) {
        if (hasWallAtZ(s.x, -FIELD_HALF_D, specialCorners)) {
            if (prevZ >= -FIELD_HALF_D) {
              if (s.z < -FIELD_HALF_D + boundaryBuffer) {
                s.z = -FIELD_HALF_D + boundaryBuffer;
                s.vz = -s.vz * bounceVelocityRetain;
              }
            } else {
              if (s.z > -FIELD_HALF_D - boundaryBuffer) {
                s.z = -FIELD_HALF_D - boundaryBuffer;
                s.vz = -s.vz * bounceVelocityRetain;
              }
            }
        }
      }
      // 4. South Wall of Main Arena (at Z = FIELD_HALF_D)
      if (s.x >= -FIELD_HALF_W && s.x <= FIELD_HALF_W) {
        if (hasWallAtZ(s.x, FIELD_HALF_D, specialCorners)) {
            if (prevZ <= FIELD_HALF_D) {
              if (s.z > FIELD_HALF_D - boundaryBuffer) {
                s.z = FIELD_HALF_D - boundaryBuffer;
                s.vz = -s.vz * bounceVelocityRetain;
              }
            } else {
              if (s.z < FIELD_HALF_D + boundaryBuffer) {
                s.z = FIELD_HALF_D + boundaryBuffer;
                s.vz = -s.vz * bounceVelocityRetain;
              }
            }
        }
      }
    }

    // Spheres are completely free to move around the extended white floor.
    // They only collide against obstacles and triangular collectors.

    // B. Collision with Triangular Collector Walls (only if sphere is NOT elevated over 6cm!)
    if (s.y < COLLECTOR_WALL_HEIGHT) {
      for (const col of collectors) {
        const diag = getCollectorDiagonal(col.xCorner, col.zCorner, col.size);
        const segment = distanceToSegment(s.x, s.z, diag.ax, diag.az, diag.bx, diag.bz);
        if (segment.distance < s.radius) {
          // Pointing vector from diagonal wall to sphere
          const nx = s.x - segment.closestX;
          const nz = s.z - segment.closestZ;
          const len = Math.sqrt(nx * nx + nz * nz) || 1;
          const pen = s.radius - segment.distance;

          // Push away from segment
          s.x += (nx / len) * pen;
          s.z += (nz / len) * pen;

          // Reflect velocity mapping with normal
          const dot = s.vx * (nx / len) + s.vz * (nz / len);
          s.vx = (s.vx - 2 * dot * (nx / len)) * bounceVelocityRetain;
          s.vz = (s.vz - 2 * dot * (nz / len)) * bounceVelocityRetain;
        }
      }
    }
  }

  // 4. Sphere-to-Sphere Collisions
  for (let i = 0; i < nextSpheres.length; i++) {
    const s1 = nextSpheres[i];
    if (s1.isHeld) continue;

    for (let j = i + 1; j < nextSpheres.length; j++) {
      const s2 = nextSpheres[j];
      if (s2.isHeld) continue;

      const dx = s2.x - s1.x;
      const dz = s2.z - s1.z;
      const dy = s2.y - s1.y;
      const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
      const minDist = s1.radius + s2.radius;

      if (dist < minDist) {
        // Collision!
        const pen = minDist - dist;
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        const nz = dz / (dist || 1);

        // Displace spheres to remove overlap
        const dispAmount = pen / 2;
        s1.x -= nx * dispAmount;
        s1.y -= ny * dispAmount;
        s1.z -= nz * dispAmount;
        s2.x += nx * dispAmount;
        s2.y += ny * dispAmount;
        s2.z += nz * dispAmount;

        // Relative Velocity
        const rvx = s2.vx - s1.vx;
        const rvy = s2.vy - s1.vy;
        const rvz = s2.vz - s1.vz;

        // Dot product of relative velocity and normal
        const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

        // Bounce if they moving towards each other
        if (velAlongNormal < 0) {
          const sandRestitution = params.restitution * 0.25;
          const impulseScalar = -(1 + sandRestitution) * velAlongNormal;
          // Equi-mass spheres (0.5 weight split)
          s1.vx -= 0.5 * impulseScalar * nx;
          s1.vy -= 0.5 * impulseScalar * ny;
          s1.vz -= 0.5 * impulseScalar * nz;
          s2.vx += 0.5 * impulseScalar * nx;
          s2.vy += 0.5 * impulseScalar * ny;
          s2.vz += 0.5 * impulseScalar * nz;
        }
      }
    }
  }

  // 4.5 Sphere-to-Obstacle Collisions (now horizontal segments/boxes/ramps)
  for (const s of nextSpheres) {
    if (s.isHeld) continue;
    for (const obs of obstacles) {
      if (!obs.type || obs.type === 'cylinder') {
        const cObs = obs as CylindricalObstacle;
        const rot = cObs.rotation || 0;
        const halfLen = (cObs.height || 25) / 2;
        const x1 = cObs.x - Math.cos(rot) * halfLen;
        const z1 = cObs.z - Math.sin(rot) * halfLen;
        const x2 = cObs.x + Math.cos(rot) * halfLen;
        const z2 = cObs.z + Math.sin(rot) * halfLen;

        const collisionRes = getPointToSegmentDist(s.x, s.z, x1, z1, x2, z2);
        const minDist = s.radius + (cObs.radius || 0.5);

        if (collisionRes.dist < minDist) {
          const pen = minDist - collisionRes.dist;
          const dx = s.x - collisionRes.closestX;
          const dz = s.z - collisionRes.closestZ;
          const nx = dx / (collisionRes.dist || 1);
          const nz = dz / (collisionRes.dist || 1);

          s.x += nx * pen;
          s.z += nz * pen;

          // Bounce
          const dot = s.vx * nx + s.vz * nz;
          if (dot < 0) {
            const res = params.restitution * 0.4;
            s.vx = (s.vx - 2 * dot * nx) * res;
            s.vz = (s.vz - 2 * dot * nz) * res;
          }
        }
      } else if (obs.type === 'box') {
        const bObs = obs as BoxObstacle;
        const halfW = bObs.width / 2;
        const halfD = bObs.depth / 2;
        const rot = bObs.rotation || 0;
        
        // Transform sphere position into box local space
        const dx = s.x - bObs.x;
        const dz = s.z - bObs.z;
        const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
        const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);
        
        const rad = s.radius;
        if (Math.abs(localX) < halfW + rad && Math.abs(localZ) < halfD + rad) {
          // Simple push out along local axes
          const overlapX = (halfW + rad) - Math.abs(localX);
          const overlapZ = (halfD + rad) - Math.abs(localZ);
          
          let localNx = 0;
          let localNz = 0;
          let push = 0;
          if (overlapX < overlapZ) {
            localNx = Math.sign(localX);
            push = overlapX;
          } else {
            localNz = Math.sign(localZ);
            push = overlapZ;
          }
          
          // Rotate normal and push back to world coordinates
          const worldNx = localNx * Math.cos(rot) - localNz * Math.sin(rot);
          const worldNz = localNx * Math.sin(rot) + localNz * Math.cos(rot);
          
          s.x += worldNx * push;
          s.z += worldNz * push;
          
          // Bounce
          const dot = s.vx * worldNx + s.vz * worldNz;
          if (dot < 0) {
            const res = params.restitution * 0.4;
            s.vx = (s.vx - 2 * dot * worldNx) * res;
            s.vz = (s.vz - 2 * dot * worldNz) * res;
          }
        }
      }
    }
  }

  // 5. Robot-to-Sphere collisions
  // We model the robot as an OBB in X-Z and sphere as a circle in X-Z
  // If a sphere collides (not held), we resolve overlap and push the sphere away.
  for (const s of nextSpheres) {
    if (s.isHeld) continue;

    // Convert sphere position into Robot local coordinates
    // Translate sphere relative to robot center
    const rx = s.x - nextRobot.x;
    const rz = s.z - nextRobot.z;

    // Rotate sphere back into face alignment (correct coordinate rotation)
    const localX = rx * Math.cos(nextRobot.angle) - rz * Math.sin(nextRobot.angle);
    const localZ = rx * Math.sin(nextRobot.angle) + rz * Math.cos(nextRobot.angle);

    // --- MAIN BODY COLLISION ---
    const halfW = nextRobot.width / 2;
    const halfL = nextRobot.length / 2;

    // Find the closest point on the robot's OBB box to the sphere
    const clampedX = Math.max(-halfW, Math.min(halfW, localX));
    const clampedZ = Math.max(-halfL, Math.min(halfL, localZ));

    const dx = localX - clampedX;
    const dz = localZ - clampedZ;
    const distSq = dx * dx + dz * dz;

    let hitRegistered = false;

    if (distSq < s.radius * s.radius) {
      // Resolve collision in 2D plane X-Z with the main body
      // Correct vertical overlap check relative to absolute robot height span
      const robotMinY = nextRobot.y;
      const robotMaxY = nextRobot.y + nextRobot.height;
      const sphereMinY = s.y - s.radius;
      const sphereMaxY = s.y + s.radius;
      const verticalOverlap = sphereMaxY >= robotMinY && sphereMinY <= robotMaxY;

      if (!verticalOverlap) {
        // Sphere is outside the vertical span of the robot body
        hitRegistered = false; 
      } else {
        // Wall push-off
        const dist = Math.sqrt(distSq) || 0.01;
      const pen = s.radius - dist;

      // Contact normal in local space
      const localNormalX = dx / dist;
      const localNormalZ = dz / dist;

      // Rotate normal back to global space (using the correct local-to-global yaw rotation)
      const globNormalX = localNormalX * Math.cos(nextRobot.angle) + localNormalZ * Math.sin(nextRobot.angle);
      const globNormalZ = -localNormalX * Math.sin(nextRobot.angle) + localNormalZ * Math.cos(nextRobot.angle);

      // Check if displacing the sphere would push it into a wall, collector, or obstacle
      const targetX = s.x + globNormalX * pen;
      const targetZ = s.z + globNormalZ * pen;

      if (isSphereCollidingWithEnvironment(targetX, targetZ, s.y, s.radius, specialCorners, collectors, obstacles)) {
        // Sphere is squeezed between robot and environment!
        // Push the robot back instead of pushing the sphere (so robot is stopped by the sphere)
        nextRobot.x -= globNormalX * pen;
        nextRobot.z -= globNormalZ * pen;
        // speed remains unchanged to simulate slipping wheels
        nextRobot.sphereSqueezeHit = true;

        // Speed of the sphere is also killed/stopped
        s.vx = 0;
        s.vz = 0;
      } else {
        // Normal push-off: displace sphere
        s.x = targetX;
        s.z = targetZ;

        // Impart some linear impulse on sphere from robot velocity
        const robGlobVX = nextRobot.speed * Math.sin(nextRobot.angle);
        const robGlobVZ = nextRobot.speed * Math.cos(nextRobot.angle);

        // Sphere gains a portion of robot's speed direct projection + simple rigid bounce
        const relativeVX = s.vx - robGlobVX;
        const relativeVZ = s.vz - robGlobVZ;
        const relNormVel = relativeVX * globNormalX + relativeVZ * globNormalZ;

        if (relNormVel < 0) {
          const sandRestitution = params.restitution * 0.25;
          const bounceFactor = 1 + sandRestitution;
          s.vx = (s.vx - relNormVel * bounceFactor * globNormalX) + robGlobVX * 0.4;
          s.vz = (s.vz - relNormVel * bounceFactor * globNormalZ) + robGlobVZ * 0.4;
        }
      }
      hitRegistered = true;
      }
    }

    // --- CLAW FINGERS SIDE COLLISIONS (Only tested if claw is low, body was not hit, and sphere overlaps claw vertically) ---
    const clawMinY = nextRobot.y + nextRobot.armHeight * 15.0;
    const clawMaxY = nextRobot.y + 6.0 + nextRobot.armHeight * 15.0 + 3.0;
    const clawVerticalOverlap = (s.y + s.radius >= clawMinY) && (s.y - s.radius <= clawMaxY);

    if (!hitRegistered && nextRobot.armHeight < 0.2 && clawVerticalOverlap) {
      const fingerShift = 1.0 + nextRobot.clawOpen * 5.0;
      const hw_f = 0.5; // Finger half width
      const hl_f = 4.0; // Finger half length (spans local Z from 6.0 to 14.0)

      // Test Left Finger
      const xl_local = localX - (-fingerShift);
      const zl_local = localZ - 10.0; // Centered at local Z = 10.0

      const clX_l = Math.max(-hw_f, Math.min(hw_f, xl_local));
      const clZ_l = Math.max(-hl_f, Math.min(hl_f, zl_local));
      const dx_l = xl_local - clX_l;
      const dz_l = zl_local - clZ_l;
      const distSq_l = dx_l * dx_l + dz_l * dz_l;

      // Test Right Finger
      const xr_local = localX - fingerShift;
      const zr_local = localZ - 10.0;

      const clX_r = Math.max(-hw_f, Math.min(hw_f, xr_local));
      const clZ_r = Math.max(-hl_f, Math.min(hl_f, zr_local));
      const dx_r = xr_local - clX_r;
      const dz_r = zr_local - clZ_r;
      const distSq_r = dx_r * dx_r + dz_r * dz_r;

      let collided = false;
      let f_dx = 0;
      let f_dz = 0;
      let f_distSq = 0;
      let isLeftFinger = false;

      if (distSq_l < s.radius * s.radius && (distSq_r >= s.radius * s.radius || distSq_l < distSq_r)) {
        collided = true;
        f_dx = dx_l;
        f_dz = dz_l;
        f_distSq = distSq_l;
        isLeftFinger = true;
      } else if (distSq_r < s.radius * s.radius) {
        collided = true;
        f_dx = dx_r;
        f_dz = dz_r;
        f_distSq = distSq_r;
        isLeftFinger = false;
      }

      if (collided) {
        const dist = Math.sqrt(f_distSq) || 0.01;
        const pen = s.radius - dist;

        // Contact normal in local space
        const localNormalX = f_dx / dist;
        const localNormalZ = f_dz / dist;

        // "Scooping" effect: If hitting the inside of a finger, nudge it forward slightly
        // instead of purely away.
        const hittingInside = isLeftFinger ? (localNormalX > 0.1) : (localNormalX < -0.1);
        let adjNormalX = localNormalX;
        let adjNormalZ = localNormalZ;
        
        if (hittingInside) {
          // Flatten the normal and push more towards Z+ (forward)
          adjNormalZ += 0.4; 
          const mag = Math.sqrt(adjNormalX * adjNormalX + adjNormalZ * adjNormalZ);
          adjNormalX /= mag;
          adjNormalZ /= mag;
        }

        // Rotate normal back to global space (using the correct local-to-global yaw rotation)
        const globNormalX = adjNormalX * Math.cos(nextRobot.angle) + adjNormalZ * Math.sin(nextRobot.angle);
        const globNormalZ = -adjNormalX * Math.sin(nextRobot.angle) + adjNormalZ * Math.cos(nextRobot.angle);

        // Displace sphere along global normal
        s.x += globNormalX * pen;
        s.z += globNormalZ * pen;

        // Impart linear impulse on sphere from robot velocity
        const robGlobVX = nextRobot.speed * Math.sin(nextRobot.angle);
        const robGlobVZ = nextRobot.speed * Math.cos(nextRobot.angle);

        const relativeVX = s.vx - robGlobVX;
        const relativeVZ = s.vz - robGlobVZ;
        const relNormVel = relativeVX * globNormalX + relativeVZ * globNormalZ;

        if (relNormVel < 0) {
          const sandRestitution = params.restitution * 0.25;
          const bounceFactor = 1 + sandRestitution;
          // Add extra forward velocity if scooping
          const scoopBonus = hittingInside ? 0.35 : 0.1;
          s.vx = (s.vx - relNormVel * bounceFactor * globNormalX) + robGlobVX * scoopBonus;
          s.vz = (s.vz - relNormVel * bounceFactor * globNormalZ) + robGlobVZ * scoopBonus;
        }
      }
    }
  }

  // --- SENSOR DISTANCE CALCULATION ---
  // The sensor looks forward from the front center of the robot.
  const sensorMaxDist = 255;
  const sensorX = nextRobot.x + (nextRobot.length / 2) * Math.sin(nextRobot.angle);
  const sensorZ = nextRobot.z + (nextRobot.length / 2) * Math.cos(nextRobot.angle);
  const dirX = Math.sin(nextRobot.angle);
  const dirZ = Math.cos(nextRobot.angle);

  let minHitDist = sensorMaxDist;
  let hitColor: 'none' | 'green' | 'red' | 'white' | 'silver' | 'black' = 'white';

  // 1. Raycast against Spheres
  for (const s of nextSpheres) {
    if (s.isHeld) continue; // Ignore the held sphere
    const cx = s.x - sensorX;
    const cz = s.z - sensorZ;
    const t = cx * dirX + cz * dirZ;
    const EPS = 0.001;
    if (t > -EPS && t < minHitDist) {
      const projX = sensorX + t * dirX;
      const projZ = sensorZ + t * dirZ;
      const distSq = (projX - s.x) ** 2 + (projZ - s.z) ** 2;
      if (distSq <= s.radius ** 2) {
        const offset = Math.sqrt(s.radius ** 2 - distSq);
        const hitDist = t - offset;
        if (hitDist < minHitDist) {
          minHitDist = Math.max(0, hitDist);
          if (minHitDist < 10) hitColor = s.color as any;
        }
      }
    }
  }

  // 2. Raycast against Field Walls
  const checkWallHit = (axisX: boolean, wallPos: number) => {
    const dir = axisX ? dirX : dirZ;
    if (Math.abs(dir) > 0.0001) {
      const t = (wallPos - (axisX ? sensorX : sensorZ)) / dir;
      const EPS = 0.001;
      // Allow t to be slightly negative to catch hits when touching or slightly inside
      if (t > -EPS && t < minHitDist) {
        const hitX = sensorX + t * dirX;
        const hitZ = sensorZ + t * dirZ;
        
        let hasWall = false;
        if (axisX) {
          if (hitZ >= -FIELD_HALF_D && hitZ <= FIELD_HALF_D) {
            if (hasWallAtX(wallPos, hitZ, specialCorners)) hasWall = true;
          }
        } else {
          if (hitX >= -FIELD_HALF_W && hitX <= FIELD_HALF_W) {
            if (hasWallAtZ(hitX, wallPos, specialCorners)) hasWall = true;
          }
        }

        if (hasWall) {
          minHitDist = Math.max(0, t);
          if (minHitDist < 10) hitColor = 'white';
        }
      }
    }
  };

  checkWallHit(true, -FIELD_HALF_W);
  checkWallHit(true, FIELD_HALF_W);
  checkWallHit(false, -FIELD_HALF_D);
  checkWallHit(false, FIELD_HALF_D);

  // 3. Raycast against Collector Walls (Diagonal and internal straight sides)
  for (const col of collectors) {
    const diag = getCollectorDiagonal(col.xCorner, col.zCorner, col.size);
    const signX = col.xCorner < 0 ? -1 : 1;
    const signZ = col.zCorner < 0 ? -1 : 1;

    // We check three segments: the diagonal, and the two straight wall segments.
    // Segment logic: [A, B]
    const segments = [
      // The Diagonal
      { ax: diag.ax, az: diag.az, bx: diag.bx, bz: diag.bz },
      // Straight Wall 1 (xc, zc) to (xc - signX*size, zc)
      { ax: col.xCorner, az: col.zCorner, bx: col.xCorner - signX * col.size, bz: col.zCorner },
      // Straight Wall 2 (xc, zc) to (xc, zc - signZ*size)
      { ax: col.xCorner, az: col.zCorner, bx: col.xCorner, bz: col.zCorner - signZ * col.size }
    ];

    for (const seg of segments) {
      const sx = seg.bx - seg.ax;
      const sz = seg.bz - seg.az;

      // Solve for ray-segment intersection: P + t*D = A + u*(B-A)
      const den = dirX * sz - dirZ * sx;
      if (Math.abs(den) > 0.0001) {
        const t = ((seg.ax - sensorX) * sz - (seg.az - sensorZ) * sx) / den;
        const u = ((seg.ax - sensorX) * dirZ - (seg.az - sensorZ) * dirX) / den;
        
        // Use a small negative epsilon for t to account for the robot being 'at' the wall
        // and a small epsilon for u range to be inclusive of endpoints
        const EPS = 0.001;
        if (t > -EPS && t < minHitDist && u >= -EPS && u <= 1 + EPS) {
          minHitDist = Math.max(0, t);
          if (minHitDist < 10) hitColor = col.color as any;
        }
      }
    }
  }

  nextRobot.sensorDistance = minHitDist;

  // --- GROUND COLOR SENSORS & REFLECTIVITY ---
  // Positioned at the front of the robot.
  const frontCenterX = nextRobot.x + (nextRobot.length / 2) * Math.sin(nextRobot.angle);
  const frontCenterZ = nextRobot.z + (nextRobot.length / 2) * Math.cos(nextRobot.angle);

  // Downward-facing sensors are tucked slightly under the chassis at local Z=5.5 (directly beneath fuchsia pillars)
  const sensorZOffset = 5.5;
  const sensorCenterX = nextRobot.x + sensorZOffset * Math.sin(nextRobot.angle);
  const sensorCenterZ = nextRobot.z + sensorZOffset * Math.cos(nextRobot.angle);

  // 1. Center Forward Color Sensor (Looks forward up to 10cm)
  nextRobot.detectedColor = (minHitDist < 10) ? hitColor : 'white';

  // 2. LuceColDx (Front Right) downward-facing sensor
  // Placed on fuchsia pillar (lateral offset determined by robot state)
  const sampleOffset = nextRobot.sensorLateralOffset;
  const dxX = sensorCenterX + sampleOffset * Math.cos(nextRobot.angle);
  const dxZ = sensorCenterZ - sampleOffset * Math.sin(nextRobot.angle);
  const dxSample = sampleFieldFloor(dxX, dxZ, collectors, specialCorners, tileOverlays, nextSpheres, obstacles, nextRobot.y);
  nextRobot.luceColDxColor = dxSample.color;
  nextRobot.luceColDxLight = dxSample.light;

  // 3. LuceColSx (Front Left) downward-facing sensor
  // Placed on fuchsia pillar (lateral offset determined by robot state)
  const sxX = sensorCenterX - sampleOffset * Math.cos(nextRobot.angle);
  const sxZ = sensorCenterZ + sampleOffset * Math.sin(nextRobot.angle);
  const sxSample = sampleFieldFloor(sxX, sxZ, collectors, specialCorners, tileOverlays, nextSpheres, obstacles, nextRobot.y);
  nextRobot.luceColSxColor = sxSample.color;
  nextRobot.luceColSxLight = sxSample.light;

  return { nextRobot, nextSpheres };
}

/**
 * Samples the floor color and light reflectivity (0-100) at any given coordinate.
 */
export function sampleFieldFloor(
  px: number,
  pz: number,
  collectors: CollectorState[],
  specialCorners: SpecialCornerState[],
  tileOverlays: TileOverlay[],
  spheres: SphereState[],
  obstacles: Obstacle[] = [],
  sensorY?: number
): { color: 'none' | 'green' | 'red' | 'white' | 'silver' | 'black'; light: number } {
  // 1. Check if over any resting (not gripped) sphere
  for (const s of spheres) {
    if (!s.isHeld) {
      const dist = Math.sqrt((s.x - px) ** 2 + (s.z - pz) ** 2);
      if (dist <= s.radius) {
        // If sensorY is provided, check if the sphere is vertically close enough to the sensor height
        if (sensorY !== undefined && Math.abs(s.y - sensorY) > 5.0) {
          continue;
        }
        return {
          color: s.color, // 'silver' or 'black'
          light: s.color === 'silver' ? 88 : 8
        };
      }
    }
  }

  // 1.5. Check if we are over a ramp or platform obstacle (they have a white background with an 18mm black line in the middle)
  for (const obs of obstacles) {
    if (obs.type === 'ramp') {
      const rObs = obs as RampObstacle;
      const halfW = rObs.width / 2;
      const halfD = rObs.depth / 2;
      const rot = rObs.rotation || 0;

      const dx = px - rObs.x;
      const dz = pz - rObs.z;
      const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
      const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);

      if (Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD) {
        // We are on the ramp! Top face has a centered black line (1.8 cm / 18 mm wide)
        const distToLine = Math.abs(localX);
        const maxSensorRadius = 2.2;
        const factor = Math.min(1.0, Math.max(0.0, distToLine / maxSensorRadius));
        const light = Math.round(8 + factor * (95 - 8));
        const color = distToLine <= 0.9 ? 'black' : 'white';
        return { color, light };
      }
    } else if (obs.type === 'platform') {
      const pObs = obs as PlatformObstacle;
      const halfW = pObs.width / 2;
      const halfD = pObs.depth / 2;
      const rot = pObs.rotation || 0;

      const dx = px - pObs.x;
      const dz = pz - pObs.z;
      const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
      const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);

      if (Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD) {
        // We are on the platform! Top face has a centered black line (1.8 cm / 18 mm wide)
        const distToLine = Math.abs(localX);
        const maxSensorRadius = 2.2;
        const factor = Math.min(1.0, Math.max(0.0, distToLine / maxSensorRadius));
        const light = Math.round(8 + factor * (95 - 8));
        const color = distToLine <= 0.9 ? 'black' : 'white';
        return { color, light };
      }
    } else if (obs.type === 'seesaw') {
      const sObs = obs as SeesawObstacle;
      const halfW = 15; // 30 / 2
      const halfD = 15; // 30 / 2
      const rot = sObs.rotation || 0;

      const dx = px - sObs.x;
      const dz = pz - sObs.z;
      const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
      const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);

      if (Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD) {
        // We are on the seesaw! Top face has a centered black line (1.8 cm / 18 mm wide)
        const distToLine = Math.abs(localX);
        const maxSensorRadius = 2.2;
        const factor = Math.min(1.0, Math.max(0.0, distToLine / maxSensorRadius));
        const light = Math.round(8 + factor * (95 - 8));
        const color = distToLine <= 0.9 ? 'black' : 'white';
        return { color, light };
      }
    } else if (obs.type === 'green_marker') {
      const gObs = obs as GreenMarkerObstacle;
      const gHalfW = (gObs.width || 2.5) / 2;
      const gHalfD = (gObs.depth || 2.5) / 2;
      const rot = gObs.rotation || 0;
      
      const dx = px - gObs.x;
      const dz = pz - gObs.z;
      const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
      const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);
      
      if (Math.abs(localX) <= gHalfW && Math.abs(localZ) <= gHalfD) {
        return { color: 'green', light: 45 };
      }
    }
  }

  // 2. Check entrance / exit strips from specialCorners
  for (const sc of specialCorners) {
    const signX = sc.xCorner < 0 ? 1 : -1;
    const signZ = sc.zCorner < 0 ? 1 : -1;
    const stripWidth = 2.5; // cm (25 mm)
    const isEntrance = sc.type === 'entrance';

    if (sc.missingWall === 'x') {
      const minX = Math.min(sc.xCorner, sc.xCorner + signX * sc.size);
      const maxX = Math.max(sc.xCorner, sc.xCorner + signX * sc.size);
      if (px >= minX && px <= maxX && Math.abs(pz - sc.zCorner) <= stripWidth / 2) {
        return isEntrance 
          ? { color: 'silver', light: 85 } 
          : { color: 'black', light: 8 };
      }
    } else if (sc.missingWall === 'z') {
      const minZ = Math.min(sc.zCorner, sc.zCorner + signZ * sc.size);
      const maxZ = Math.max(sc.zCorner, sc.zCorner + signZ * sc.size);
      if (pz >= minZ && pz <= maxZ && Math.abs(px - sc.xCorner) <= stripWidth / 2) {
        return isEntrance 
          ? { color: 'silver', light: 85 } 
          : { color: 'black', light: 8 };
      }
    }
  }

  // 3. Check inside collectors
  for (const col of collectors) {
    const signX = col.xCorner < 0 ? 1 : -1;
    const signZ = col.zCorner < 0 ? 1 : -1;
    const dx = (px - col.xCorner) * signX;
    const dz = (pz - col.zCorner) * signZ;
    
    // If the sensor point is past the wall boundaries defining the corner, skip it
    if (dx < 0 || dz < 0) {
      continue;
    }

    if (isInsideCollectorCorner(px, pz, col.xCorner, col.zCorner, col.size)) {
      return {
        color: col.color, // 'green' or 'red'
        light: col.color === 'green' ? 45 : 35
      };
    }
    const diag = getCollectorDiagonal(col.xCorner, col.zCorner, col.size);
    const seg = distanceToSegment(px, pz, diag.ax, diag.az, diag.bx, diag.bz);
    if (seg.distance < 5.0) {
      return {
        color: col.color,
        light: col.color === 'green' ? 45 : 35
      };
    }
  }

  // 4. Check tile overlays
  const overlay = tileOverlays.find(o => Math.abs(o.x - px) <= 15 && Math.abs(o.z - pz) <= 15);
  if (overlay) {
    const dx = px - overlay.x;
    const dz = pz - overlay.z;
    const rot = overlay.rotation || 0;
    const cosRot = Math.cos(-rot);
    const sinRot = Math.sin(-rot);
    const rx = dx * cosRot - dz * sinRot;
    const rz = dx * sinRot + dz * cosRot;

    // Detect asset type based on known base64 fingerprints or stored metadata
    let id = 'none';
    const cleanUrl = overlay.imageUrl || '';
    const tileId = overlay.tileId || '';
    const tileName = (overlay.name || '').toLowerCase();

    if (tileId === 'straight' || tileName.includes('straight') || tileName.includes('rettilineo') || tileName.includes('linea')) {
      id = 'straight';
    } else if (tileId === 'curve' || tileName.includes('curve') || tileName.includes('curva')) {
      id = 'curve';
    } else if (tileId === 'cross' || tileName.includes('cross') || tileName.includes('incrocio') || tileName.includes('croce')) {
      id = 'cross';
    } else if (tileId === 't-junction' || tileName.includes('t-junction') || tileName.includes('t-incrocio')) {
      id = 't-junction';
    } else if (tileId === 'green-marker' || tileName.includes('green-marker') || tileName.includes('verde')) {
      id = 'green-marker';
    } else if (tileId === 'red-marker' || tileName.includes('red-marker') || tileName.includes('rosso')) {
      id = 'red-marker';
    } else if (cleanUrl.includes('PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IndoaXRlIi8+PHJlY3QgeD0iNDciIHdpZHRoPSI2IiBoZWlnaHQ9IjEwMCIgZmlsbD0iYmxhY2siLz48L3N2Zz4=')) {
      id = 'straight';
    } else if (cleanUrl.includes('PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTSAwIDUwIEEgNTAgNTAgMCAwIDEgNTAgMTAwIiBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjYiLz48L3N2Zz4=')) {
      id = 'curve';
    } else if (cleanUrl.includes('PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IndoaXRlIi8+PHJlY3QgeD0iNDciIHdpZHRoPSI2IiBoZWlnaHQ9IjEwMCIgZmlsbD0iYmxhY2siLz48cmVjdCB5PSI0NyIgd2lkdGg9IjEwMCIgaGVpZ2h0PSI2IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')) {
      id = 'cross';
    } else if (cleanUrl.includes('PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IndoaXRlIi8+PHJlY3QgeD0iNDciIHdpZHRoPSI2IiBoZWlnaHQ9IjEwMCIgZmlsbD0iYmxhY2siLz48cmVjdCB5PSI0NyIgeD0iNDciIHdpZHRoPSI1MyIgaGVpZ2h0PSI2IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')) {
      id = 't-junction';
    } else if (cleanUrl.includes('PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IndoaXRlIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiMxMGI5ODEiLz48L3N2Zz4=')) {
      id = 'green-marker';
    } else if (cleanUrl.includes('PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IndoaXRlIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNlZjQ0NDQiLz48L3N2Zz4=')) {
      id = 'red-marker';
    } else {
      const urlLower = cleanUrl.toLowerCase();
      if (urlLower.includes('green-marker') || urlLower.includes('marcatore verde') || urlLower.includes('verde')) id = 'green-marker';
      else if (urlLower.includes('red-marker') || urlLower.includes('marcatore rosso') || urlLower.includes('rosso')) id = 'red-marker';
      else if (urlLower.includes('t-junction') || urlLower.includes('t-incrocio')) id = 't-junction';
      else if (urlLower.includes('cross') || urlLower.includes('incrocio')) id = 'cross';
      else if (urlLower.includes('curve') || urlLower.includes('curva')) id = 'curve';
      else if (urlLower.includes('straight') || urlLower.includes('rettilineo')) id = 'straight';
    }

    const lineWidth = 1.8; // Matches SVG tiles (6% of 30cm)
    let distToLine = 999;

    if (id === 'straight') {
      distToLine = Math.abs(rx);
    } else if (id === 'curve') {
      // Curve arc starts at (-15, 0) to (0, 15), radius 15, centered at (-15, 15)
      const cx = -15;
      const cz = 15;
      const dist = Math.sqrt((rx - cx) ** 2 + (rz - cz) ** 2);
      distToLine = Math.abs(dist - 15);
    } else if (id === 'cross') {
      distToLine = Math.min(Math.abs(rx), Math.abs(rz));
    } else if (id === 't-junction') {
      if (rx >= 0) {
        distToLine = Math.min(Math.abs(rx), Math.abs(rz));
      } else {
        const distToOrigin = Math.sqrt(rx * rx + rz * rz);
        distToLine = Math.min(Math.abs(rx), distToOrigin);
      }
    } else if (id === 'green-marker') {
      if (rx >= -12 && rx <= 12 && rz >= -12 && rz <= 12) {
        return { color: 'green', light: 45 };
      }
    } else if (id === 'red-marker') {
      if (rx >= -12 && rx <= 12 && rz >= -12 && rz <= 12) {
        return { color: 'red', light: 35 };
      }
    }

    if (distToLine < 999) {
      // Gradual analog light value based on distance to the center of the line.
      // Light fades smoothly from 95% (far away) down to 8% (exactly on center).
      // Max reading radius of sensor is 2.2cm.
      const maxSensorRadius = 2.2;
      const factor = Math.min(1.0, Math.max(0.0, distToLine / maxSensorRadius));
      const light = Math.round(8 + factor * (95 - 8));
      
      // If the sensor center is close enough to the physical black line, it registers 'black' color
      const color = distToLine <= (lineWidth / 2) ? 'black' : 'white';
      return { color, light };
    }
  }

  return { color: 'white', light: 95 };
}
