export const shader = `@group(0) @binding(0)
var tex : texture_storage_2d<\${presentationFormat}, write>;
    @group(0) @binding(1)
    var blockDataA : texture_storage_3d < r32uint, read_write>;
    //@group(0) @binding(2)
    //var blockDataB : texture_storage_3d < r32uint, read_write>;

    @group(0) @binding(3)
    var<uniform> cameraData : CameraData;
    @group(0) @binding(4)
    var<uniform> settings : Settings;

    @group(0) @binding(5)
    var<uniform> lightData : LightData;
    
    @group(0) @binding(6)
    var<uniform> inputData : InputData;
   
    @group(0) @binding(7)
    var<uniform> playerData : PlayerData;

    struct PlayerData {
        playerCount : i32,                   // 4 bytes
        players : array<Player, 64>         // 64 * 48 bytes = 3072 bytes
    }
    struct Player {
        position : vec3<f32>,  // 12 bytes
        rotation : vec4<f32>,  // 16 bytes
        color : vec4<f32>      // 16 bytes
    }

    struct Settings {
        worldSizeX : u32,
        worldSizeY : u32,
        worldSizeZ : u32
    }

    struct CameraData {
        screenWidth : u32,
        screenHeight : u32,
        position : vec3 < f32>,
        direction : vec3 < f32>,
        fov : f32
    }

    struct VoxelData {
        block : u32,
        color : vec4 < f32>
    }

    struct LightData {
        lightCount : i32,
        lights : array<Light, 512>
    }

    struct Light {
        position : vec3 < f32>,
        color : vec4 < f32>
    }

    struct InputData {
        blocksChanged : array <ChangedBlock, 32>
    }

    struct Shape {
        position : vec3 < f32>,
        color : vec4 < f32>,
        size : vec3 < f32>,
    }

    struct ChangedBlock {
        position : vec3 < i32 >,
        block : u32
    }

    fn Rotate2D(v : vec2 < f32>, a : f32) -> vec2 < f32>{
        let SinA = sin(a);
        let CosA = cos(a);
        return vec2 < f32 > (v.x * CosA - v.y * SinA, v.y * CosA + v.x * SinA);
    }

    fn GetVoxel(c : vec3 < f32>) -> VoxelData {
        if (c.x < 0.0 || c.x >= f32(settings.worldSizeX) || c.y < 0.0 || c.y >= f32(settings.worldSizeY) || c.z < 0.0 || c.z >= f32(settings.worldSizeZ))
        {
            return VoxelData(0, vec4(0.0));
        }

        var pos = vec3 < i32 > (
        i32(floor(c.x)),
        i32(floor(c.y)),
        i32(floor(c.z)),
        );

        var voxelData = textureLoad(blockDataA, pos);

        var voxel = VoxelData(
        voxelData.r >> 24,
        vec4 < f32 > (
        f32((voxelData.r >> 16) & 0xFF) / 255.0,
        f32((voxelData.r >> 8) & 0xFF) / 255.0,
        f32(voxelData.r & 0xFF) / 255.0,
        1.0
        ));

        return voxel;
    }

    struct HitInfo{
        normal : vec3 < f32>,
        dist : f32,
        pos : vec3 < f32>,
        block : VoxelData
    };


    fn RayCast(origin: vec3<f32>, dir: vec3<f32>) -> HitInfo {
        let invDir = 1.0 / dir; // pre-compute to avoid slow divisions
        var pos = origin;       // may be clamp/intersect-ed to grid bounds
        var tmax = 0.0;
        var voxel: VoxelData;
        let originVoxelPos = floor(origin);
        var prevBlockPos: vec3<f32>;

        for (var i = 0; i < 256; i++) {
            let voxelPos = floor(pos);
            voxel = GetVoxel(voxelPos);

            if (voxel.block != 0 &&
            (
            originVoxelPos.x != voxelPos.x ||
            originVoxelPos.y != voxelPos.y ||
            originVoxelPos.z != voxelPos.z
            )) { break; } // found hit at tmax

            prevBlockPos = voxelPos;
            let cellMin = voxelPos;
            let cellMax = cellMin + 1.0;
            let time = IntersectAABB(origin, invDir, cellMin, cellMax);

            tmax = time.y + 0.0001;
            pos = origin + tmax * dir;
        }
        

        return HitInfo(
            normalize(prevBlockPos - floor(pos)),
            tmax,                    // distance to hit point
            pos,                     // hit position
            voxel                    // voxel data at hit position
        );
    }

    // AABB intersection slab style
    fn IntersectAABB(origin: vec3<f32>, invDir: vec3<f32>, bbMin: vec3<f32>, bbMax: vec3<f32>) -> vec2<f32> {
        var t0 = (bbMin - origin) * invDir;
        var t1 = (bbMax - origin) * invDir;

        let temp = t0;
        t0 = min(temp, t1);
        t1 = max(temp, t1);

        let tmin = max(max(t0.x, t0.y), t0.z);
        let tmax = min(min(t1.x, t1.y), t1.z);

        return vec2(tmin, tmax);
    }

    fn intersectAABBCatShapes(origin: vec3<f32>, dir: vec3<f32>) -> HitInfo {
        let catShapes = array<Shape, 9>(
            // Body
            Shape(vec3<f32>(-.25,.25,-.5), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.5, .5, 1.5)),
            // Head
            Shape(vec3<f32>(-.3,.35,-.55), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.6, .6, .6)),
            // feet
            Shape(vec3<f32>(-.2,0.0,-.4), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.1, .4, .1)),
            Shape(vec3<f32>(.0,0.0,-.4), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.1, .4, .1)),
            Shape(vec3<f32>(-.2,0.0,.4), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.1, .4, .1)),
            Shape(vec3<f32>(.0,0.0,.4), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.1, .4, .1)),
            // tail
            Shape(vec3<f32>(0.0,.5,1.0), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.1, .7, .1)),
            // ears
            Shape(vec3<f32>(-.25,.95,-.5), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.1, .1, .1)),
            Shape(vec3<f32>(.15,.95,-.5), vec4<f32>(.2, .2, .2, 1), vec3<f32>(.1, .1, .1)),
        );

        var hitInfo = HitInfo(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), VoxelData(0, vec4(0.0)));
        let invDir = 1.0 / dir;

        var bestDist = 10000.0;
        
        for (var i = 0; i < playerData.playerCount; i++) {
            let player = playerData.players[i];
            let offset = player.position + vec3<f32>(0.0, -1.0, 0.0);

            for (var i = 0; i < 9; i++) {
                var shape = catShapes[i];

                var newHitInfo = intersectWithShape(origin - offset, dir, shape);
                if (newHitInfo.block.block != 0) {
                    // convert hit position back into world-space by adding the offset
                    newHitInfo.pos = newHitInfo.pos + offset;
                    
                    if (newHitInfo.dist < bestDist) {
                        bestDist = newHitInfo.dist;
                        hitInfo = newHitInfo;
                    }
                }
            }
        }

        return hitInfo;
    }

    fn intersectWithShape(rayOrigin: vec3<f32>, rayDirection: vec3<f32>, shape: Shape) -> HitInfo {
        let boxMin = shape.position;
        let boxMax = shape.position + shape.size;

        var hitInfo = HitInfo(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), VoxelData(0, vec4(0.0)));

        let invDir = 1.0 / rayDirection; // pre-compute to avoid slow divisions
        let time = IntersectAABB(rayOrigin, invDir, boxMin, boxMax);

        // time.x = tmin, time.y = tmax
        if (time.x < time.y && time.y > 0.0) {
            hitInfo.dist = time.x;
            // compute world hit position (in rayOrigin space)
            hitInfo.pos = rayOrigin + rayDirection * hitInfo.dist;

            // determine which axis produced tmin to approximate normal
            let t0 = (boxMin - rayOrigin) * invDir;
            let t1 = (boxMax - rayOrigin) * invDir;
            var tminVec = min(t0, t1);
            var tmaxVec = max(t0, t1);

            // find largest component of tminVec -> the axis of entry
            if (tminVec.x >= tminVec.y && tminVec.x >= tminVec.z) {
                hitInfo.normal = vec3<f32>(sign(-rayDirection.x), 0.0, 0.0);
            } else if (tminVec.y >= tminVec.x && tminVec.y >= tminVec.z) {
                hitInfo.normal = vec3<f32>(0.0, sign(-rayDirection.y), 0.0);
            } else {
                hitInfo.normal = vec3<f32>(0.0, 0.0, sign(-rayDirection.z));
            }

            hitInfo.block = VoxelData(1, shape.color);
        }

        return hitInfo;
    }

    fn vec3Distance(a : vec3 < f32>, b : vec3 < f32>) -> f32 {
        return sqrt(dot(a - b, a - b));
    }

    fn rand(seed : f32) -> f32 {
        return fract(sin(seed * 12.9898) * 43758.5453);
    }

    @compute @workgroup_size(8, 8, 1) fn render(@builtin(global_invocation_id) id : vec3u)
    {
        let Pixel = id.xy;
        let Resolution = textureDimensions(tex).xy;
        let AspectRatio = f32(Resolution.y) / f32(Resolution.x);

        if (id.x >= Resolution.x || id.y >= Resolution.y)
        {
            return;
        }

        let FragCoord = vec2 < f32 > (f32(Pixel.x) + .5, f32(Resolution.y - Pixel.y) - .5);

        let UV = 2. * FragCoord / vec2 < f32 > (Resolution) - 1.;

        let fovScale = tan(radians(cameraData.fov) * 0.5);
        let aspect = f32(cameraData.screenWidth) / f32(cameraData.screenHeight);
        let uv = UV * vec2 < f32 > (aspect, 1.0) * fovScale;

        let forward = normalize(cameraData.direction);
        let worldUp = vec3 < f32 > (0.0, 1.0, 0.0);
        let right = normalize(cross(forward, worldUp));
        let up = cross(right, forward);

        var RayDirection = normalize(forward + uv.x * right + uv.y * up);

        var RayPosition = cameraData.position;


        let DirectionRotation = Rotate2D(RayDirection.xz, 0);
        let PositionRotation = Rotate2D(RayPosition.xz, 0);

        RayDirection = vec3 < f32 > (DirectionRotation.x, RayDirection.y, DirectionRotation.y);

        RayPosition = vec3 < f32 > (PositionRotation.x, RayPosition.y, PositionRotation.y);

        var Primary = intersectAABBCatShapes(RayPosition, RayDirection);

        let BlockPrimary = RayCast(RayPosition, RayDirection);

        if (Primary.block.block == 0 || BlockPrimary.dist < Primary.dist) {
            Primary = BlockPrimary;
            // Primary.block.color = vec4(0.75, 0.75, 0.75, 1.0);
        }

        var color = vec4(0.0);

        if (Primary.block.color.a == 0)
        {
            textureStore(tex, Pixel, vec4(0.0));
            return;
        }

        for (var i = 0; i < lightData.lightCount; i++)
        {
            let light = lightData.lights[i];
            let lightDist = vec3Distance(Primary.pos, light.position);

            if (lightDist > (light.color.a * 64.0))
            {
                continue;
            }

            let bias = .001;
            var shadowRayStart = Primary.pos + Primary.normal * bias;

            let catHit = intersectAABBCatShapes(shadowRayStart, normalize(light.position - shadowRayStart));


            let shadowRay = RayCast(shadowRayStart, normalize(light.position - shadowRayStart));

            if (catHit.block.block == 0 || catHit.dist > shadowRay.dist) {

                if (shadowRay.dist > lightDist - bias)
                {
                    //textureStore(tex, Pixel, Primary.block.color * ((1.0 - lightDist / 16.0) * shadowRay.block.color));
                    color += ((1.0 - lightDist / (light.color.a * 64.0)) * light.color);
                } else if (shadowRay.dist > lightDist - 2) {
                    let hitBlockPos = floor(shadowRay.pos);
                    let lightBlockPos = floor(light.position);

                    if (hitBlockPos.x == lightBlockPos.x &&
                        hitBlockPos.y == lightBlockPos.y &&
                        hitBlockPos.z == lightBlockPos.z)
                    {
                        color += ((1.0 - lightDist / (light.color.a * 64.0)) * light.color);
                    }
                }
            }
        }

        textureStore(tex, Pixel, Primary.block.color * color);
        // textureStore(tex, Pixel, vec4(
        //     (1 - (Primary.dist / 16.0)) * Primary.block.color.r,
        //     (1 - (Primary.dist / 16.0)) * Primary.block.color.g,
        //     (1 - (Primary.dist / 16.0)) * Primary.block.color.b,
        //     1.0
        // ));

        
    }

    @compute @workgroup_size(1) fn light(@builtin(global_invocation_id) id : vec3u)
    {
        let light = lightData.lights[0];

        if (GetVoxel(light.position).block == 2)
        {
            return;
        }

        if (light.position.x < 0.0 || light.position.x >= f32(settings.worldSizeX) ||
        light.position.y < 0.0 || light.position.y >= f32(settings.worldSizeY) ||
        light.position.z < 0.0 || light.position.z >= f32(settings.worldSizeZ))
        {
            return;
        }

    
        textureStore(blockDataA, vec3u(light.position.xyz), vec4u(
        u32(light.color.r * 255.0),
        u32(light.color.g * 255.0),
        u32(light.color.b * 255.0),
        u32(light.color.a * 255.0)
        ));

        //re(tex, Pixel, light);
    }

    @compute @workgroup_size(1) fn input(@builtin(global_invocation_id) id : vec3u)
    {
            //textureStore(blockDataA, vec3u(2,1,2), vec4u(0, 0, 0, 0));

        for (var i = 0; i < 32; i++)
        {
            var blockChange = inputData.blocksChanged[i];
            //blockChange.position = vec3<i32>(3,1,3);


            if (blockChange.position.x < 0 || blockChange.position.x >= i32(settings.worldSizeX) ||
            blockChange.position.y < 0 || blockChange.position.y >= i32(settings.worldSizeY) ||
            blockChange.position.z < 0 || blockChange.position.z >= i32(settings.worldSizeZ))
            {
                let x = 1;
                continue;
            }

            // disable editing for the game demo
            // textureStore(blockDataA, vec3u(blockChange.position), vec4u(blockChange.block, 0, 0, 0));
            // textureStore(tex, vec2u(blockChange.position.xy), vec4(1.0));
        }
    }
`;