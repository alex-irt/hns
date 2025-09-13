import { shader as raycastShader } from "./raycastShader";
import type { ShaderCharacter } from "./ShaderCharacter";
import { Vec3 } from "./Vec3";

const specialBlocks = [
    {
        id: 'x',
        position: [55.5, 9.5, 20.5],
        color: [0, 0, 1, .5],
        playerColor: [0, 0, 1, .6]
    },
    {
        id: 'magenta',
        position: [88.5, 9.5, 233.5],
        color: [1, 0, 1, .5],
        playerColor: [1, 0, 1, .6]
    },
    {
        id: 'cyan',
        position: [173.5, 7.5, 39.5],
        color: [.5, 0, 1, .6],
        playerColor: [.5, 0, 1, .6]
    },
    {
        id: 'lime',
        position: [209.5, 9.5, 166.5],
        color: [.5, 1, .5, .6],
        playerColor: [.5, 1, .5, .6]
    },
    {
        id: 'white',
        position: [232.5, 10.5, 217.5],
        color: [1, 1, 1, .75],
        playerColor: [1, 1, 1, .75]
    }
];


// Helper functions for manual buffer packing
function packCameraData(data: {
    screenWidth: number;
    screenHeight: number;
    position: [number, number, number];
    direction: [number, number, number];
    fov: number;
}): ArrayBuffer {
    // struct CameraData {
    //     screenWidth : u32,     // 4 bytes
    //     screenHeight : u32,    // 4 bytes
    //     position : vec3<f32>,  // 12 bytes
    //     direction : vec3<f32>, // 12 bytes
    //     fov : f32              // 4 bytes
    // }
    // Total: 36 bytes, but WebGPU requires 16-byte alignment, so 48 bytes
    const buffer = new ArrayBuffer(48);
    const view = new DataView(buffer);

    view.setUint32(0, data.screenWidth, true);
    view.setUint32(4, data.screenHeight, true);
    // 8 bytes padding
    view.setFloat32(16, data.position[0], true);
    view.setFloat32(20, data.position[1], true);
    view.setFloat32(24, data.position[2], true);
    // 4 bytes padding
    view.setFloat32(32, data.direction[0], true);
    view.setFloat32(36, data.direction[1], true);
    view.setFloat32(40, data.direction[2], true);
    view.setFloat32(44, data.fov, true);

    return buffer;
}

function packSettingsData(data: {
    worldSizeX: number;
    worldSizeY: number;
    worldSizeZ: number;
}): ArrayBuffer {
    // struct Settings {
    //     worldSizeX : u32,  // 4 bytes
    //     worldSizeY : u32,  // 4 bytes
    //     worldSizeZ : u32   // 4 bytes
    // }
    // Total: 12 bytes, but WebGPU requires 16-byte alignment, so 16 bytes
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);

    view.setUint32(0, data.worldSizeX, true);
    view.setUint32(4, data.worldSizeY, true);
    view.setUint32(8, data.worldSizeZ, true);
    // 4 bytes padding

    return buffer;
}

function packLightData(data: {
    lightCount: number;
    lights: Array<{
        position: [number, number, number];
        color: [number, number, number, number];
    }>;
}): ArrayBuffer {
    // struct LightData {
    //     lightCount : i32,                   // 4 bytes
    //     lights : array<Light, 512>         // 512 * 32 bytes = 16384 bytes
    // }
    // struct Light {
    //     position : vec3<f32>,  // 12 bytes
    //     color : vec4<f32>      // 16 bytes
    // }
    // Each Light is 28 bytes, but aligned to 32 bytes
    // Total: 4 + 12 (padding) + 512 * 32 = 16400 bytes
    const buffer = new ArrayBuffer(16400);
    const view = new DataView(buffer);

    view.setInt32(0, data.lightCount, true);
    // 12 bytes padding to align lights array to 16 bytes

    for (let i = 0; i < Math.min(data.lights.length, 512); i++) {
        const light = data.lights[i];
        const offset = 16 + i * 32; // 16 bytes header + padding, 32 bytes per light

        // position: vec3<f32>
        view.setFloat32(offset + 0, light.position[0], true);
        view.setFloat32(offset + 4, light.position[1], true);
        view.setFloat32(offset + 8, light.position[2], true);
        // 4 bytes padding

        // color: vec4<f32>
        view.setFloat32(offset + 16, light.color[0], true);
        view.setFloat32(offset + 20, light.color[1], true);
        view.setFloat32(offset + 24, light.color[2], true);
        view.setFloat32(offset + 28, light.color[3], true);
    }

    return buffer;
}

function packPlayerData(data: {
    playerCount: number;
    players: Array<{
        position: [number, number, number];
        rotation: [number, number, number, number];
        color: [number, number, number, number];
    }>;
}): ArrayBuffer {
    // struct PlayerData {
    //     playerCount : i32,                   // 4 bytes
    //     players : array<Player, 64>         // 64 * 48 bytes = 3072 bytes
    // }
    // struct Player {
    //     position : vec3<f32>,  // 12 bytes
    //     rotation : vec4<f32>,  // 16 bytes
    //     color : vec4<f32>      // 16 bytes
    // }
    // Each Player is 44 bytes, but aligned to 48 bytes
    // Total: 4 + 12 (padding) + 64 * 48 = 3088 bytes
    const buffer = new ArrayBuffer(3088);
    const view = new DataView(buffer);

    view.setInt32(0, data.playerCount, true);
    // 12 bytes padding to align players array to 16 bytes
    for (let i = 0; i < Math.min(data.players.length, 64); i++) {
        const player = data.players[i];
        const offset = 16 + i * 48; // 16 bytes header + padding, 48 bytes per player

        // position: vec3<f32>
        view.setFloat32(offset + 0, player.position[0], true);
        view.setFloat32(offset + 4, player.position[1], true);
        view.setFloat32(offset + 8, player.position[2], true);
        // 4 bytes padding

        // rotation: vec4<f32>
        view.setFloat32(offset + 16, player.rotation[0], true);
        view.setFloat32(offset + 20, player.rotation[1], true);
        view.setFloat32(offset + 24, player.rotation[2], true);
        view.setFloat32(offset + 28, player.rotation[3], true);

        // color: vec4<f32>
        view.setFloat32(offset + 32, player.color[0], true);
        view.setFloat32(offset + 36, player.color[1], true);
        view.setFloat32(offset + 40, player.color[2], true);
        view.setFloat32(offset + 44, player.color[3], true);
    }

    return buffer;
}

function packInputData(data: {
    blocksChanged: Array<{
        position: [number, number, number];
        block: number;
    }>;
}): ArrayBuffer {
    // struct InputData {
    //     blocksChanged : array<ChangedBlock, 32>  // 32 * 16 bytes = 512 bytes
    // }
    // struct ChangedBlock {
    //     position : vec3<i32>,  // 12 bytes
    //     block : u32            // 4 bytes
    // }
    // Each ChangedBlock is 16 bytes
    const buffer = new ArrayBuffer(512);
    const view = new DataView(buffer);

    for (let i = 0; i < Math.min(data.blocksChanged.length, 32); i++) {
        const change = data.blocksChanged[i];
        const offset = i * 16;

        // position: vec3<i32>
        view.setInt32(offset + 0, change.position[0], true);
        view.setInt32(offset + 4, change.position[1], true);
        view.setInt32(offset + 8, change.position[2], true);

        // block: u32
        view.setUint32(offset + 12, change.block, true);
    }

    return buffer;
}

export class CanvasShader {
    context: GPUCanvasContext;
    device!: GPUDevice;
    sceneLights: { position: Vec3, color: Vec3 }[] = [];

    renderPipeline!: GPUComputePipeline;
    lightPipeline!: GPUComputePipeline;
    inputPipeline!: GPUComputePipeline;

    size: number = 256;

    blockDataA!: GPUTexture;
    blockDataB!: GPUTexture;

    cameraUniformBuffer!: GPUBuffer;
    settingsUniformBuffer!: GPUBuffer;
    lightDataUniformBuffer!: GPUBuffer;
    inputUniformBuffer!: GPUBuffer;
    playerDataUniformBuffer!: GPUBuffer;

    constructor(canvas: HTMLCanvasElement) {
        const context = canvas.getContext('webgpu');

        if (!context) {
            throw new Error("Failed to get WebGPU context");
        }

        this.context = context;
    }

    async init() {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) {

            // Add a message to the user
            // create an h1 element and add it to the page
            const h1 = document.createElement('h1');
            h1.innerText = `WebGPU not supported, please enable the feature flag to use WebGPU or try a different browser. For Chrome, go to chrome://flags/#enable-vulkan. For Safari Advanced > Experimental Features and enable "WebGPU". For Firefox, got to about:config and enable "dom.webgpu.enabled" and "gfx.webrender.all".`;
            h1.style.position = 'absolute';
            h1.style.top = '20%';
            h1.style.left = '50%';
            h1.style.transform = 'translate(-50%, -50%)';
            h1.style.color = 'white';
            h1.style.backgroundColor = 'black';
            h1.style.padding = '20px';
            h1.style.borderRadius = '10px';
            document.body.appendChild(h1);
            throw new Error("Failed to get GPU adapter");
        }

        const hasBGRA8unormStorage = adapter.features.has('bgra8unorm-storage');

        const device = await adapter?.requestDevice({
            requiredFeatures: hasBGRA8unormStorage
                ? ['bgra8unorm-storage']
                : [],
        });

        if (!device) {
            throw new Error("Failed to get GPU device");
        }

        this.device = device;

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device,
            format: presentationFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.STORAGE_BINDING,
        });

        // -------------------------------------------------------------------------------------------------------------
        // Initialize block data as a 3d storage texture
        // -------------------------------------------------------------------------------------------------------------

        const blocks: [number, number, number, number][] = Array(this.size * this.size * this.size).fill([0, 0, 0, 0]);

        // deterministic PRNG (mulberry32)
        function mulberry32(a: number) {
            return function () {
                var t = a += 0x6D2B79F5;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        }

        let perlin = {
            gradients: {} as Record<string, { x: number; y: number }>,
            memory: {} as Record<string, number>,
            // runtime RNG, seeded via seed()
            rng: mulberry32(4658) as () => number,
            rand_vect: function () {
                const theta = this.rng() * 2 * Math.PI;
                return { x: Math.cos(theta), y: Math.sin(theta) };
            },
            dot_prod_grid: function (x: number, y: number, vx: number, vy: number) {
                const key = `${vx},${vy}`;
                let g_vect = this.gradients[key];
                const d_vect = { x: x - vx, y: y - vy };
                if (!g_vect) {
                    g_vect = this.rand_vect();
                    this.gradients[key] = g_vect;
                }
                return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
            },
            smootherstep: function (x: number) {
                return 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
            },
            interp: function (x: number, a: number, b: number) {
                return a + this.smootherstep(x) * (b - a);
            },
            seed: function (seed?: number) {
                this.gradients = {};
                this.memory = {};
                const s = seed === undefined ? 4658 : (seed >>> 0);
                this.rng = mulberry32(s);
            },
            get: function (x: number, y: number) {
                const key = `${x},${y}`;
                if (Object.prototype.hasOwnProperty.call(this.memory, key))
                    return this.memory[key];
                const xf = Math.floor(x);
                const yf = Math.floor(y);
                //interpolate
                const tl = this.dot_prod_grid(x, y, xf, yf);
                const tr = this.dot_prod_grid(x, y, xf + 1, yf);
                const bl = this.dot_prod_grid(x, y, xf, yf + 1);
                const br = this.dot_prod_grid(x, y, xf + 1, yf + 1);
                const xt = this.interp(x - xf, tl, tr);
                const xb = this.interp(x - xf, bl, br);
                const v = this.interp(y - yf, xt, xb);
                this.memory[key] = v;
                return v;
            }
        };

        let percentLoaded = 0;

        console.log("Generating world...");

        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const i = x + y * this.size + z * this.size * this.size;

                    // if (y < 2) {
                    //     blocks[i] = [1, 0, 201, 0];
                    // } else if (x % 16 === 0) {
                    //     blocks[i] = [1, 201, 0, 0];
                    // } else if (z % 16 === 0 && x % 2 === 0) {
                    //     blocks[i] = [1, 0, 0, 201];
                    // }

                    // if ((x === 16) && y >= 2 && y < 8 && (z === 8 || z === 24 || z === 40)) {
                    //     blocks[i] = [0,0,0,0];
                    // }

                    if (x < 16 && z < 16) {
                        if (y <= 5) {
                            blocks[i] = [1, 201, 201, 201];
                        }
                    } else {
                        const noise1 = perlin.get(x / 16, z / 16) * 8;
                        const noise2 = perlin.get((x + 100) / 32, (z + 100) / 32) * 4;
                        const noise3 = perlin.get(x / 32, z / 32) * 2;
                        const height = Math.floor(noise1 + noise2 + noise3) + 2;

                        if (y < height) {
                            const r = Math.floor(Math.random() * 100 + 50);
                            const g = Math.floor(Math.random() * 100 + 50);
                            const b = Math.floor(Math.random() * 100 + 50);
                            blocks[i] = [1, r, g, b];
                        }
                    }

                    percentLoaded = (i / (this.size * this.size * this.size)) * 100;

                    // document.querySelector('#loading')!.innerHTML = `Loading: ${percentLoaded.toFixed(2)}%`;
                    // console.log(`Loading: ${percentLoaded.toFixed(2)}%`);
                }
            }
        }

        for (const specialBlock of specialBlocks) {
            const x = Math.floor(specialBlock.position[0]);
            const y = Math.floor(specialBlock.position[1]);
            const z = Math.floor(specialBlock.position[2]);

            blocks[x + y * this.size + z * this.size * this.size] = [1, specialBlock.color[0] * 255, specialBlock.color[1] * 255, specialBlock.color[2] * 255];
        }

        this.blockDataA = this.create3dTexture(
            blocks.map(block => {
                // 4 bytes: Type, 0, 0, 0
                return (block[0] << 24) | (block[1] << 16) | (block[2] << 8) | block[3];
            }),
            this.size, this.size, this.size,
            GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
            'block data A');

        this.blockDataB = this.create3dTexture(
            blocks.map(block => {
                // take r, g, b, a from the block and encode them as bytes into one u32
                return (block[0] << 24) | (block[1] << 16) | (block[2] << 8) | block[3];
            }),
            this.size, this.size, this.size,
            GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
            'block data B');

        // -------------------------------------------------------------------------------------------------------------
        // Raycast shader pipeline
        // -------------------------------------------------------------------------------------------------------------

        const code = raycastShader.replace(/\$\{presentationFormat\}/g, presentationFormat);

        const module = device.createShaderModule({ label: 'Raycast shader module', code });
        this.renderPipeline = device.createComputePipeline({
            label: 'Raycast pipeline',
            layout: 'auto',
            compute: { entryPoint: 'render', module },
        });

        // -------------------------------------------------------------------------------------------------------------
        // Lighting shader pipeline
        // -------------------------------------------------------------------------------------------------------------

        this.lightPipeline = device.createComputePipeline({
            label: 'Lighting pipeline',
            layout: 'auto',
            compute: { entryPoint: 'light', module },
        });

        // -------------------------------------------------------------------------------------------------------------
        // Input shader pipeline
        // -------------------------------------------------------------------------------------------------------------

        this.inputPipeline = device.createComputePipeline({
            label: 'Input pipeline',
            layout: 'auto',
            compute: { entryPoint: 'input', module },
        });

        // -------------------------------------------------------------------------------------------------------------
        // Uniform buffer definitions
        // -------------------------------------------------------------------------------------------------------------

        this.cameraUniformBuffer = device.createBuffer({
            size: 48, // Size calculated from packCameraData
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.settingsUniformBuffer = device.createBuffer({
            size: 16, // Size calculated from packSettingsData
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Initialize settings data
        const settingsData = packSettingsData({
            worldSizeX: this.size,
            worldSizeY: this.size,
            worldSizeZ: this.size,
        });
        device.queue.writeBuffer(this.settingsUniformBuffer, 0, settingsData);

        this.lightDataUniformBuffer = device.createBuffer({
            size: 16400, // Size calculated from packLightData
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Initialize light data
        const initialLightData = packLightData({
            lightCount: 1,
            lights: [
                { position: [8.5, 3.5, 8.5], color: [1, 1, 1, 1] }
            ]
        });
        device.queue.writeBuffer(this.lightDataUniformBuffer, 0, initialLightData);

        this.playerDataUniformBuffer = device.createBuffer({
            size: 3088, // Size calculated from packPlayerData
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Initialize player data
        const initialPlayerData = packPlayerData({
            playerCount: 1,
            players: [
                { position: [0, 0, 0], rotation: [0, 0, 0, 1], color: [1, 1, 1, 1] }
            ]
        });
        device.queue.writeBuffer(this.playerDataUniformBuffer, 0, initialPlayerData);

        this.inputUniformBuffer = device.createBuffer({
            size: 512, // Size calculated from packInputData
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Initialize input data
        const initialInputData = packInputData({
            blocksChanged: Array.from({ length: 32 }, () => ({ position: [0, 0, 0], block: 0 }))
        });
        device.queue.writeBuffer(this.inputUniformBuffer, 0, initialInputData);

        return blocks;
    }

    create3dTexture(data: number[], sizeX: number, sizeY: number, sizeZ: number, usage: number, label?: string) {
        // create a 3D texture on the GPU to hold our computation
        const texture = this.device.createTexture({
            label: (label || '') + ' 3D texture',
            size: [sizeX, sizeY, sizeZ],
            format: 'r32uint',
            dimension: '3d',
            usage,
        });

        this.device.queue.writeTexture(
            { texture },
            new Uint32Array(data),
            { bytesPerRow: sizeX * 4, rowsPerImage: sizeY },
            { width: sizeX, height: sizeY, depthOrArrayLayers: sizeZ },
        );

        return texture;
    }

    render(character?: ShaderCharacter, players: Array<{ position: number[], rotation: number[], color: number[], lastUpdate: number }> = []) {
        let cameraData: ArrayBuffer;

        if (character) {
            const direction = new Vec3(0, 0, .8).applyQuaternion(character.rotation);

            cameraData = packCameraData({
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                position: [character.position.x, character.position.y, character.position.z],
                direction: [direction.x, direction.y, direction.z],
                fov: 80,
            });
        } else {
            cameraData = packCameraData({
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                position: [0, 0, 0],
                direction: [0, 0, 0],
                fov: 80,
            });
        }

        let inputData: ArrayBuffer | null = null;
        if (character) {
            if (character.blockChanges.length) {
                inputData = packInputData({
                    blocksChanged: character.blockChanges.map(change => ({
                        position: change.position.toArray() as [number, number, number],
                        block: (change.block[0] << 24) | (change.block[1] << 16) | (change.block[2] << 8) | change.block[3]
                    }))
                });
            }

            character.blockChanges.forEach(change => {
                if (change.block[0] === 2) {
                    console.log("Block changed:", change);
                    console.log(this.sceneLights);
                    this.sceneLights.push({
                        position: change.position.clone().add(new Vec3(.5, .5, .5)),
                        color: new Vec3(change.block[1], change.block[2], change.block[3]).multiplyScalar(1 / 255)
                    });
                } else if (change.oldBlock[0] === 2) {
                    this.sceneLights = this.sceneLights.filter(light => {
                        return !light.position.equals(change.position.clone().add(new Vec3(.5, .5, .5)));
                    });
                }
            });

            character.blockChanges = [];
        }

        if (character) {
            for (const sBlock of specialBlocks) {
                const dist = character?.position.distanceTo(new Vec3(...sBlock.position)) || 0;

                if (dist < 3) {
                    console.log("Collected special block:", sBlock.id);
                    character!.color = sBlock.playerColor;

                    if (!character.collectedLights.includes(sBlock.id)) {
                        character.collectedLights.push(sBlock.id);

                        if (character.collectedLights.length === specialBlocks.length) {
                            console.log("All special blocks collected!");

                            character!.color[3] = 1;

                            // create an h1 element and add it to the page
                            const h1 = document.createElement('h1');
                            h1.innerText = "You found all the special blocks!";
                            h1.style.position = 'absolute';
                            h1.style.top = '20%';
                            h1.style.left = '50%';
                            h1.style.transform = 'translate(-50%, -50%)';
                            h1.style.color = 'white';
                            h1.style.backgroundColor = 'black';
                            h1.style.padding = '20px';
                            h1.style.borderRadius = '10px';
                            document.body.appendChild(h1);
                        }
                    }
                }
            }
        }

        const lightStartValues: Array<{ position: number[], color: number[] }> = [];
        lightStartValues.push(
            { position: [8.5, 5.5, 8.5], color: [.5, .3, .4, .75] },
            // { position: [4.5, 6.5, 2.5 + (i * 16)], color: [0, .5, 0, 1] },
            // { position: [2.5, 14.5, 4.5 + (i * 16)], color: [0, 0, .5, 1] },
            // { position: [14.5, 6.5, 14.5 + (i * 16)], color: [.25, 0, 0.5, 1] },
            // { position: [6.5, 14.5, 14.5 + (i * 16)], color: [0, .5, .5, 1] },
            { position: (character?.position.clone() || new Vec3(0, 0, 0)).add(new Vec3(0, 3, 0)).toArray(), color: character?.color || [1, 1, 1, 0] },
            ...specialBlocks.map(b => ({ position: b.position, color: b.color }))
        );

        const animatedLights = lightStartValues.map((light: any, i: number) => {
            // disabled
            const offset = 0 //Math.abs(Math.sin((i + Date.now() / 1000) / 2));
            const colorSine = 1//Math.abs(Math.sin(Date.now() / (7100 + i * 39) + (981202 * i * i)));
            const strengthSine = 1//Math.abs(Math.sin(Date.now() / (5300 + i * 19) + (908 * i * i)));

            return {
                position: [
                    light.position[0] + offset,
                    light.position[1] + offset,
                    light.position[2] + offset
                ] as [number, number, number],
                color: [
                    light.color[0] * colorSine,
                    light.color[1] * colorSine,
                    light.color[2] * colorSine,
                    light.color[3] * 1
                ] as [number, number, number, number]
            };
        });

        // const sceneLightsFormatted = this.sceneLights.map(light => ({
        //     position: [light.position.x, light.position.y, light.position.z] as [number, number, number],
        //     color: [light.color.x, light.color.y, light.color.z, .25] as [number, number, number, number]
        // }));

        const characterLights = players.map(player => ({
            position: [
                player.position[0] + 0,
                player.position[1] + 3,
                player.position[2] + 0
            ] as [number, number, number],
            color: player.color as [number, number, number, number]
        }));

        const lightData = packLightData({
            lightCount: animatedLights.length + characterLights.length,
            lights: [...animatedLights, ...characterLights]
        });

        // Write buffer data
        this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, cameraData);
        this.device.queue.writeBuffer(this.lightDataUniformBuffer, 0, lightData);
        if (inputData) {
            this.device.queue.writeBuffer(this.inputUniformBuffer, 0, inputData);
        }

        const playerData = packPlayerData({
            playerCount: Object.values(players).length,
            players: Object.values(players).map(player => ({
                position: player.position as [number, number, number],
                rotation: player.rotation as [number, number, number, number],
                color: player.color as [number, number, number, number]
            }))
        });
        this.device.queue.writeBuffer(this.playerDataUniformBuffer, 0, playerData);

        const texture = this.context.getCurrentTexture();

        // -------------------------------------------------------------------------------------------------------------
        // Run the lighting input pipeline
        // -------------------------------------------------------------------------------------------------------------
        // let bindGroup = this.device.createBindGroup({
        //     layout: this.inputPipeline.getBindGroupLayout(0),
        //     entries: [
        //         { binding: 0, resource: texture.createView() },
        //         { binding: 1, resource: this.blockDataA.createView() },
        //         // { binding: 3, resource: { buffer: this.cameraUniformBuffer } },
        //         { binding: 4, resource: { buffer: this.settingsUniformBuffer } },
        //         // { binding: 5, resource: { buffer: this.lightDataUniformBuffer } },
        //         { binding: 6, resource: { buffer: this.inputUniformBuffer } },
        //     ],
        // });

        // let encoder = this.device.createCommandEncoder({ label: 'input encoder' });
        // let pass = encoder.beginComputePass();
        // pass.setPipeline(this.inputPipeline);
        // pass.setBindGroup(0, bindGroup);
        // pass.dispatchWorkgroups(1);
        // pass.end();

        // let commandBuffer = encoder.finish();
        // this.device.queue.submit([commandBuffer]);

        let bindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: texture.createView() },
                { binding: 1, resource: this.blockDataA.createView() },
                { binding: 3, resource: { buffer: this.cameraUniformBuffer } },
                { binding: 4, resource: { buffer: this.settingsUniformBuffer } },
                { binding: 5, resource: { buffer: this.lightDataUniformBuffer } },
                { binding: 7, resource: { buffer: this.playerDataUniformBuffer } },
            ],
        });

        let encoder = this.device.createCommandEncoder({ label: 'raycast encoder' });
        let pass = encoder.beginComputePass();
        pass.setPipeline(this.renderPipeline);
        pass.setBindGroup(0, bindGroup);
        const tileX = 8;
        const tileY = 8;
        const dispatchX = Math.ceil(texture.width / tileX);
        const dispatchY = Math.ceil(texture.height / tileY);
        pass.dispatchWorkgroups(dispatchX, dispatchY);
        pass.end();

        let commandBuffer = encoder.finish();
        this.device.queue.submit([commandBuffer]);
    }

}


