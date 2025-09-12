import { Quaternion } from "./Quat";
import { Vec3 } from "./Vec3";
import { Input } from './input';
type HitInfo = {
    normal: Vec3,
    dist: number,
    pos: Vec3,
    block: number[]
};
export class ShaderCharacter {
    cameraOffset: Vec3 = new Vec3(0, 1.25, 0);

    jumpStrength: number = 15;
    jumpStrengthKickstart: number = 25;

    jumping: boolean = false;
    jumpHeld: number = 0;
    maxJumpHold: number = 100;
    jumpDuration: number = 0;
    characterHeight: number = 3.0;
    characterRadius: number = 0.45;

    position: Vec3 = new Vec3(0, 0, 0);
    rotation: Quaternion = new Quaternion();

    velocity: Vec3 = new Vec3(0, 0, 0);

    input: Input;

    blocks: [number, number, number, number][];
    blockChanges: { position: Vec3, block: [number, number, number, number], oldBlock: [number, number, number, number] }[] = [];

    constructor(blocks: [number, number, number, number][], position: Vec3 = new Vec3(4.0, 10.0, 4.0)) {
        this.input = new Input();
        this.position = position;
        this.blocks = blocks;
    }

    RayCast(origin: Vec3, dir: Vec3): HitInfo {
         // invDir should be the component-wise reciprocal of direction (1.0 / dir.x, ...)
        let invDir = new Vec3(
            1.0 / dir.x,
            1.0 / dir.y,
            1.0 / dir.z,
        );
        var pos = origin;       // may be clamp/intersect-ed to grid bounds
        var tmax = 0.0;
        var voxel: number[] = [0, 0, 0, 0];
        let originVoxelPos = origin.clone().floor(); // get voxel position from origin
        var prevBlockPos: Vec3 = originVoxelPos.clone();

        for (var i = 0; i < 256; i++) {
            let voxelPos = pos.clone().floor(); // get voxel position from current position
            voxel = this.getBlock(voxelPos);

            if (voxel === null) {
                break;
            }

            if (voxel[0] != 0 &&
                (
                    originVoxelPos.x != voxelPos.x ||
                    originVoxelPos.y != voxelPos.y ||
                    originVoxelPos.z != voxelPos.z
                )) { break; } // found hit at tmax

            prevBlockPos = voxelPos.clone();
            let cellMin = voxelPos.clone();
            let cellMax = cellMin.clone().addScalar(1.0);
            let time = this.IntersectAABB(origin, invDir, cellMin, cellMax);

            tmax = time.y + 0.0001;
            pos = origin.clone().add(dir.clone().multiplyScalar(tmax));
        }

        console.log(i);
        console.log(pos);
        console.log(voxel);

        return {
            normal: prevBlockPos.clone().sub(pos.clone().floor()).normalize(),
            dist: tmax,                    // distance to hit point
            pos,                     // hit position
            block: voxel                    // voxel data at hit position
        };
    }

    // // AABB intersection using slab method
    IntersectAABB(origin: Vec3, invDir: Vec3, bbMin: Vec3, bbMax: Vec3): Vec3 {
        var t0 = (bbMin.sub(origin)).multiply(invDir);
        var t1 = (bbMax.sub(origin)).multiply(invDir);

        let temp = t0;
        t0 = Vec3.min(temp, t1);
        t1 = Vec3.max(temp, t1);

        let tmin = Math.max(Math.max(t0.x, t0.y), t0.z);
        let tmax = Math.min(Math.min(t1.x, t1.y), t1.z);

        return new Vec3(tmin, tmax);
    }


    blockCast(pos: Vec3, dir: Vec3, maxDistance: number = 100, stepSize: number = 0.5) {
        // DDA (Digital Differential Analyzer) voxel traversal
        let current = pos.clone();
        const step = dir.clone().normalize().multiplyScalar(stepSize);
        let traveled = 0;

        for (; traveled < maxDistance; traveled += stepSize) {
            const blockPos = current.clone().floor();
            const block = this.getBlock(blockPos);

            if (!block) {
                return null;
            }

            if (block[0] !== 0) {
                return { pos: current, block };
            }

            current.add(step);
        }
        return null;
    }

    getBlock(position: Vec3) {
        const worldSize = 256;
        const i = position.x + position.y * worldSize + position.z * worldSize * worldSize;
        return this.blocks[i] || null;
    }

    setBlock(position: Vec3, block: [number, number, number, number]) {
        const worldSize = 256;
        const i = position.x + position.y * worldSize + position.z * worldSize * worldSize;
        const oldBlock = this.blocks[i];
        this.blocks[i] = block;
        this.blockChanges.push({ position, block, oldBlock });
    }

    applyImpulse(impulse: Vec3) {
        this.velocity = this.velocity.add(impulse.multiplyScalar(0.0025));
    }

    update(deltaTime: number) {
        this.input.update(deltaTime);

        if (this.input.buttonsPressed[' ']) {
            if (!this.jumping) {
                this.jumpHeld = .025;
                this.jumping = true;
                this.applyImpulse(new Vec3(0, this.jumpStrengthKickstart, 0));
            }
        }

        if (this.jumping) {
            if (this.input.buttonsHeld[' ']) {
                if (this.jumpHeld <= this.maxJumpHold) {
                    this.jumpHeld += deltaTime;
                } else {
                    this.jumpHeld = this.maxJumpHold; // Cap the jump hold
                }
            }
            this.jumpDuration += deltaTime;

            // This must be multiplies by a number greater than 1
            const jumpLength = this.jumpHeld * 1.25;

            if (jumpLength > this.jumpDuration) {
                // const applyImpulseStrength = lerp(0, this.jumpStrength, this.jumpDuration / jumpLength);
                this.applyImpulse(new Vec3(0, this.jumpStrength * deltaTime, 0));
            } else {
                this.jumping = false;
                this.jumpDuration = 0;
                this.jumpHeld = 0;
            }
        }

        const maxMoveSpeed = 1;
        const stopSpeed = 8;
        const acceleration = 5;

        const vectorForward = new Vec3(0, 0, 1).applyQuaternion(this.rotation);
        const vectorRight = new Vec3(-1, 0, 0).applyQuaternion(this.rotation);

        let movementVector = new Vec3(0, 0, 0);

        // Movement input
        if (this.input.buttonsHeld['w']) {
            movementVector = movementVector.add(vectorForward);
        }
        if (this.input.buttonsHeld['s']) {
            movementVector = movementVector.add(vectorForward.clone().multiplyScalar(-1));
        }
        if (this.input.buttonsHeld['a']) {
            movementVector = movementVector.add(vectorRight.clone().multiplyScalar(-1));
        }
        if (this.input.buttonsHeld['d']) {
            movementVector = movementVector.add(vectorRight);
        }
        movementVector = movementVector.length() > 0 ? movementVector.normalize() : movementVector;

        const currentVelocity = new Vec3(this.velocity.x, 0, this.velocity.z);
        const moveDirCurrentVelocity = currentVelocity.dot(movementVector);

        if (movementVector.equals(new Vec3(0, 0, 0))) {
            // apply friction when not moving
            if (currentVelocity.length() > 0.1) {
                this.applyImpulse(currentVelocity.clone().multiplyScalar(-stopSpeed * deltaTime));
            } else {
                this.applyImpulse(new Vec3(-currentVelocity.x * stopSpeed * deltaTime, 0, -currentVelocity.z * stopSpeed * deltaTime));
            }
        } else if (Math.abs(moveDirCurrentVelocity) > maxMoveSpeed) {
            this.applyImpulse(new Vec3(-currentVelocity.x * stopSpeed * deltaTime, 0, -currentVelocity.z * stopSpeed * deltaTime));
            this.applyImpulse(movementVector.clone().multiplyScalar(maxMoveSpeed - moveDirCurrentVelocity));
        } else {
            this.applyImpulse(movementVector.clone().multiplyScalar(deltaTime * acceleration));
        }

        // Mouse look (horizontal)
        const mouseSensitivity = 0.2;
        const rotateBy = -this.input.mouseDelta.x * mouseSensitivity * 0.01;
        // Get current rotation as a quaternion
        // const leftQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotateBy);
        // rotationQuaternion.multiply(leftQ);

        this.rotation = this.rotation.multiply(new Quaternion().setFromAxisAngle(new Vec3(0, 1, 0), rotateBy));

        const upDownRotAdjustment = new Quaternion().setFromAxisAngle(new Vec3(1, 0, 0), this.input.mouseDelta.y * mouseSensitivity * 0.01);

        if (this.input.mouseDelta.y > 0) {
            // todo limit this and the next rotation so you can't look up and backwards or down and backwards
            this.rotation = this.rotation.multiply(upDownRotAdjustment);
        } else if (this.input.mouseDelta.y < 0) {
            this.rotation = this.rotation.multiply(upDownRotAdjustment);
        }

        if (this.input.buttonsPressed['mouse1'] || this.input.buttonsPressed['mouse3']) {
            const cameraDir = new Vec3(0, 0, 1).applyQuaternion(this.rotation);
            const cameraPos = this.position.clone();

            let hit = this.RayCast(cameraPos, cameraDir);

            if (hit) {
                if (this.input.buttonsPressed['mouse1']) {
                    const pos = hit.pos.sub(hit.normal.clone().multiplyScalar(-.15)); // Adjust position to avoid placing on top
                    // of the block

                    this.setBlock(pos.clone().floor(), [2, 60, 10, 20]); // Place a block of type 1 (e.g., BlockGrass)
                } else if (this.input.buttonsPressed['mouse3']) {
                    this.setBlock(hit.pos.clone().floor(), [0, 0, 0, 0]); // Remove the block
                }
            }
        }

        const heightsToCheck = [
            // .4, // Start at .4 off the ground to make stairs (.33 height) not stop the character
            // .95,
            // 1.25,
            // 1.5,
            // 1.75,
            // 2.25,
            // 2.5,
            // 2.75,
            .4
        ];

        // Check for collisions every 20 degrees around the character
        const directionsToCheck = Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2; // 360 degrees divided by 8
            return new Vec3(Math.cos(angle), 0, Math.sin(angle));
        });
        // const directionsToCheck = [Vec3.FORWARD]

        directionsToCheck.forEach((direction) => {
            heightsToCheck.forEach((height) => {
                const checkPos = this.position.clone();
                checkPos.y -= this.characterHeight / 2;
                checkPos.y += height;

                const directionalCast = this.blockCast(checkPos.clone(), direction, 1, .005);

                if (directionalCast) {
                    const directionalCastPos = new Vec3(directionalCast.pos.x, 0, directionalCast.pos.z);
                    const distance = new Vec3(this.position.x, 0, this.position.z).distanceTo(directionalCastPos);

                    if (distance < this.characterRadius) {
                        // Adjust position to avoid collision
                        const offset = direction.clone().multiplyScalar(distance - this.characterRadius);
                        this.position.add(offset);

                        const currentVelocity = new Vec3(this.velocity.x, 0, this.velocity.z);
                        const velocityInDirectionAmount = currentVelocity.dot(direction);
                        const collDirCurrentVelocity = velocityInDirectionAmount * currentVelocity.length();

                        this.velocity.sub(direction.clone().multiplyScalar(collDirCurrentVelocity));

                        // reduce overall velocity based on velocityInDirectionAmount
                        this.velocity.multiplyScalar((1 - Math.abs(velocityInDirectionAmount) / maxMoveSpeed));
                    }
                }
            });
        });

        // blockcast down to find ground
        const groundHit = this.blockCast(this.position.clone(), new Vec3(0, -1, 0), this.characterHeight / 2 + 2, .01);

        const groundPos = groundHit ? groundHit.pos : null;

        const distToGround = groundPos ? (this.position.y - this.characterHeight / 2) - groundPos.y : 10;

        if (distToGround < 0) {
            this.position.y = this.position.y - distToGround;

            if (this.velocity.y < 0) {
                this.velocity.y = 0; // Reset vertical velocity when on ground
            }
        }

        if (distToGround > 0) {
            if (this.velocity.y > -2) {
                // this.velocity.y -= .0025 * deltaTime; // Apply gravity
                this.applyImpulse(new Vec3(0, -7.5 * deltaTime, 0));
            }
        }

        // Update character position
        this.position.x += this.velocity.x * deltaTime * 0.01; // Adjust speed factor as needed
        this.position.y += this.velocity.y * deltaTime * 0.01; // Adjust speed factor as needed
        this.position.z += this.velocity.z * deltaTime * 0.01; // Adjust speed factor as needed
    }
}
