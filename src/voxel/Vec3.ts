export class Vec3 {
    x: number;
    y: number;
    z: number;

    constructor(x?: number | Vec3, y?: number, z?: number) {
        if (x instanceof Vec3) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        } else {
            this.x = x ?? 0;
            this.y = y ?? 0;
            this.z = z ?? 0;
        }
    }
    
    static LEFT = new Vec3(-1, 0, 0);
    static RIGHT = new Vec3(1, 0, 0);
    static DOWN = new Vec3(0, -1, 0);
    static UP = new Vec3(0, 1, 0);
    static BACK = new Vec3(0, 0, -1);
    static BACKWARD = Vec3.BACK; // Alias for BACK
    static FORWARD = new Vec3(0, 0, 1);

    static Directions = [
        Vec3.UP,
        Vec3.LEFT,
        Vec3.RIGHT,
        Vec3.BACK,
        Vec3.FORWARD,
        Vec3.DOWN,
    ];

    toString() {
        return `${this.x},${this.y},${this.z}`;
    }

    distanceTo(vec: Vec3) {
        const dx = this.x - vec.x;
        const dy = this.y - vec.y;
        const dz = this.z - vec.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    subtract(vec: Vec3) {
        return new Vec3(this.x - vec.x, this.y - vec.y, this.z - vec.z);
    }

    mul(scalar: number) {
        return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    static min(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
    }

    static max(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
    }

    clone() {
        return new Vec3(this.x, this.y, this.z);
    }

    floor() {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        this.z = Math.floor(this.z);

        return this;
    }

    addScalar(scalar: number) {
        this.x += scalar;
        this.y += scalar;
        this.z += scalar;

        return this;
    }

    add(vec: Vec3) {
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        
        return this;
    }

    multiplyScalar(scalar: number) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        
        return this;
    }

    equals(vec: Vec3) {
        return this.x === vec.x && this.y === vec.y && this.z === vec.z;
    }

    sub(vec: Vec3) {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;

        return this;
    }

    multiply(vec: Vec3) {
        this.x *= vec.x;
        this.y *= vec.y;
        this.z *= vec.z;
        
        return this;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
            this.z /= len;
        }
        return this;
    }

    applyQuaternion(q: { x: number; y: number; z: number; w: number; }) {
        // quaternion q is assumed to have unit length

		const vx = this.x, vy = this.y, vz = this.z;
		const qx = q.x, qy = q.y, qz = q.z, qw = q.w;

		// t = 2 * cross( q.xyz, v );
		const tx = 2 * ( qy * vz - qz * vy );
		const ty = 2 * ( qz * vx - qx * vz );
		const tz = 2 * ( qx * vy - qy * vx );

		// v + q.w * t + cross( q.xyz, t );
		this.x = vx + qw * tx + qy * tz - qz * ty;
		this.y = vy + qw * ty + qz * tx - qx * tz;
		this.z = vz + qw * tz + qx * ty - qy * tx;

		return this;
    }

    dot(vec: Vec3) {
        return this.x * vec.x + this.y * vec.y + this.z * vec.z;
    }

    toArray() {
        return [this.x, this.y, this.z];
    }
    
    static fromArray(arr: number[]) {
        return new Vec3(arr[0], arr[1], arr[2]);
    }
    
}