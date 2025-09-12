import {shader as raycastShader} from "./raycastShader";
import type { ShaderCharacter } from "./ShaderCharacter";
import { Vec3 } from "./Vec3";

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

        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const i = x + y * this.size + z * this.size * this.size;

                    if (y < 2) {
                        blocks[i] = [1, 0, 201, 0];
                    } else if (x % 16 === 0) {
                        blocks[i] = [1, 201, 0, 0];
                    } else if (z % 16 === 0 && x % 2 === 0) {
                        blocks[i] = [1, 0, 0, 201];
                    }

                    if ((x === 16) && y >= 2 && y < 8 && (z === 8 || z === 24 || z === 40)) {
                        blocks[i] = [0,0,0,0];
                    }
                }
            }
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

    render(character?: ShaderCharacter) {
        let cameraData: ArrayBuffer;
        
        if (character) {
            const direction = new Vec3(0, 0, .8).applyQuaternion(character.rotation);

            cameraData = packCameraData({
                screenWidth: 800,
                screenHeight: 600,
                position: [character.position.x, character.position.y, character.position.z],
                direction: [direction.x, direction.y, direction.z],
                fov: 80,
            });
        } else {
            cameraData = packCameraData({
                screenWidth: 800,
                screenHeight: 600,
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

        const lightStartValues: Array<{ position: number[], color: number[] }> = [];
        [1, 6, 10].forEach((i: number) => {
            lightStartValues.push(
                { position: [24.5, 5.5, 8.5 + (i * 16)], color: [.0, .05, .15, .5] },
                { position: [8.5, 5.5, 8.5 + (i * 16)], color: [.0, .2, .05, 1] },
                { position: [4.5, 6.5, 2.5 + (i * 16)], color: [0, .5, 0, 1] },
                { position: [2.5, 14.5, 4.5 + (i * 16)], color: [0, 0, .5, 1] },
                { position: [14.5, 6.5, 14.5 + (i * 16)], color: [.25, 0, 0.5, 1] },
                { position: [6.5, 14.5, 14.5 + (i * 16)], color: [0, .5, .5, 1] },
            );
        });

        const animatedLights = lightStartValues.map((light: any, i: number) => {
            // Let the position and colors be animated but make sure they are not synchronized
            const offset = Math.abs(Math.sin((i + Date.now() / 1000) / 2));
            const colorSine = Math.abs(Math.sin(Date.now() / (7100 + i * 39) + (981202 * i * i)));
            const strengthSine = Math.abs(Math.sin(Date.now() / (5300 + i * 19) + (908 * i * i)));

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
                    light.color[3] * (strengthSine / 2 + .25)
                ] as [number, number, number, number]
            };
        });

        const sceneLightsFormatted = this.sceneLights.map(light => ({
            position: [light.position.x, light.position.y, light.position.z] as [number, number, number],
            color: [light.color.x, light.color.y, light.color.z, .25] as [number, number, number, number]
        }));

        const lightData = packLightData({
            lightCount: animatedLights.length + sceneLightsFormatted.length,
            lights: [...animatedLights, ...sceneLightsFormatted]
        });

        // Write buffer data
        this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, cameraData);
        this.device.queue.writeBuffer(this.lightDataUniformBuffer, 0, lightData);
        if (inputData) {
            this.device.queue.writeBuffer(this.inputUniformBuffer, 0, inputData);
        }

        const texture = this.context.getCurrentTexture();

        // -------------------------------------------------------------------------------------------------------------
        // Run the lighting input pipeline
        // -------------------------------------------------------------------------------------------------------------
        let bindGroup = this.device.createBindGroup({
            layout: this.inputPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: texture.createView() },
                { binding: 1, resource: this.blockDataA.createView() },
                // { binding: 3, resource: { buffer: this.cameraUniformBuffer } },
                { binding: 4, resource: { buffer: this.settingsUniformBuffer } },
                // { binding: 5, resource: { buffer: this.lightDataUniformBuffer } },
                { binding: 6, resource: { buffer: this.inputUniformBuffer } },
            ],
        });

        let encoder = this.device.createCommandEncoder({ label: 'input encoder' });
        let pass = encoder.beginComputePass();
        pass.setPipeline(this.inputPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();

        let commandBuffer = encoder.finish();
        this.device.queue.submit([commandBuffer]);

        bindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: texture.createView() },
                { binding: 1, resource: this.blockDataA.createView() },
                { binding: 3, resource: { buffer: this.cameraUniformBuffer } },
                { binding: 4, resource: { buffer: this.settingsUniformBuffer } },
                { binding: 5, resource: { buffer: this.lightDataUniformBuffer } },
            ],
        });

        encoder = this.device.createCommandEncoder({ label: 'raycast encoder' });
        pass = encoder.beginComputePass();
        pass.setPipeline(this.renderPipeline);
        pass.setBindGroup(0, bindGroup);
        const tileX = 8;
        const tileY = 8;
        const dispatchX = Math.ceil(texture.width / tileX);
        const dispatchY = Math.ceil(texture.height / tileY);
        pass.dispatchWorkgroups(dispatchX, dispatchY);
        pass.end();

        commandBuffer = encoder.finish();
        this.device.queue.submit([commandBuffer]);
    }

}


