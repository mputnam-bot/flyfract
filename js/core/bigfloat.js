/**
 * BigFloat - Arbitrary Precision Floating Point for Deep Zoom
 *
 * Uses a mantissa stored as an array of floats (each with ~26 bits of precision)
 * plus an exponent for the scale. This gives us essentially unlimited precision
 * by adding more limbs.
 *
 * For Mandelbrot perturbation theory, we need arbitrary precision for:
 * - Reference point (center) coordinates
 * - Reference orbit Z_n values
 */

// Constants for precision management
const LIMB_BITS = 26;  // Bits of precision per limb (conservative to avoid overflow)
const LIMB_BASE = Math.pow(2, LIMB_BITS);
const LIMB_MASK = LIMB_BASE - 1;

export class BigFloat {
    /**
     * Create a BigFloat
     * @param {number|BigFloat|string} value - Initial value
     * @param {number} precision - Number of limbs (default 4 = ~104 bits)
     */
    constructor(value = 0, precision = 4) {
        this.precision = precision;
        this.mantissa = new Float64Array(precision);
        this.exp = 0;  // Binary exponent
        this.sign = 1;

        if (value instanceof BigFloat) {
            this.copyFrom(value);
        } else if (typeof value === 'string') {
            this.fromString(value);
        } else if (typeof value === 'number') {
            this.fromNumber(value);
        }
    }

    /**
     * Create from a JavaScript number
     */
    fromNumber(n) {
        if (n === 0) {
            this.mantissa.fill(0);
            this.exp = 0;
            this.sign = 1;
            return this;
        }

        this.sign = n < 0 ? -1 : 1;
        n = Math.abs(n);

        // Extract exponent
        const e = Math.floor(Math.log2(n));
        this.exp = e - LIMB_BITS + 1;

        // Normalize to [0.5, 1) and scale
        let m = n / Math.pow(2, this.exp);

        // Fill limbs
        for (let i = 0; i < this.precision; i++) {
            const limb = Math.floor(m);
            this.mantissa[i] = limb;
            m = (m - limb) * LIMB_BASE;
        }

        return this.normalize();
    }

    /**
     * Create from a decimal string (for high-precision input)
     */
    fromString(str) {
        str = str.trim();
        if (str === '0' || str === '') {
            this.mantissa.fill(0);
            this.exp = 0;
            this.sign = 1;
            return this;
        }

        this.sign = str[0] === '-' ? -1 : 1;
        if (str[0] === '-' || str[0] === '+') {
            str = str.substring(1);
        }

        // Parse as decimal and convert
        const num = parseFloat(str);
        if (isFinite(num)) {
            this.fromNumber(this.sign * num);
        }

        return this;
    }

    /**
     * Convert to JavaScript number (loses precision)
     */
    toNumber() {
        if (this.isZero()) return 0;

        let result = 0;
        let scale = Math.pow(2, this.exp);

        for (let i = 0; i < this.precision; i++) {
            result += this.mantissa[i] * scale;
            scale /= LIMB_BASE;
        }

        return this.sign * result;
    }

    /**
     * Convert to hi/lo pair for GPU (double-single emulation)
     */
    toHiLo() {
        const n = this.toNumber();
        const hi = Math.fround(n);
        const lo = n - hi;
        return { hi, lo };
    }

    /**
     * Check if zero
     */
    isZero() {
        for (let i = 0; i < this.precision; i++) {
            if (this.mantissa[i] !== 0) return false;
        }
        return true;
    }

    /**
     * Copy from another BigFloat
     */
    copyFrom(other) {
        this.sign = other.sign;
        this.exp = other.exp;
        // Resize if needed
        if (this.precision !== other.precision) {
            this.precision = other.precision;
            this.mantissa = new Float64Array(this.precision);
        }
        for (let i = 0; i < Math.min(this.precision, other.precision); i++) {
            this.mantissa[i] = other.mantissa[i];
        }
        return this;
    }

    /**
     * Clone this BigFloat
     */
    clone() {
        return new BigFloat(this, this.precision);
    }

    /**
     * Normalize the mantissa (carry propagation and leading zero removal)
     */
    normalize() {
        if (this.isZero()) {
            this.exp = 0;
            this.sign = 1;
            return this;
        }

        // Carry propagation
        let carry = 0;
        for (let i = this.precision - 1; i >= 0; i--) {
            this.mantissa[i] += carry;
            carry = Math.floor(this.mantissa[i] / LIMB_BASE);
            this.mantissa[i] = this.mantissa[i] % LIMB_BASE;
            if (this.mantissa[i] < 0) {
                this.mantissa[i] += LIMB_BASE;
                carry--;
            }
        }

        // Handle overflow
        if (carry > 0) {
            // Shift right
            for (let i = this.precision - 1; i > 0; i--) {
                this.mantissa[i] = this.mantissa[i - 1];
            }
            this.mantissa[0] = carry;
            this.exp += LIMB_BITS;
        }

        // Remove leading zeros
        while (this.mantissa[0] === 0 && !this.isZero()) {
            for (let i = 0; i < this.precision - 1; i++) {
                this.mantissa[i] = this.mantissa[i + 1];
            }
            this.mantissa[this.precision - 1] = 0;
            this.exp -= LIMB_BITS;
        }

        return this;
    }

    /**
     * Add another BigFloat
     */
    add(other) {
        if (other.isZero()) return this.clone();
        if (this.isZero()) return other.clone();

        // Handle different signs
        if (this.sign !== other.sign) {
            const otherNeg = other.clone();
            otherNeg.sign = -otherNeg.sign;
            return this.sub(otherNeg);
        }

        const result = new BigFloat(0, Math.max(this.precision, other.precision));
        result.sign = this.sign;

        // Align exponents
        const expDiff = this.exp - other.exp;
        const limbShift = Math.floor(expDiff / LIMB_BITS);

        result.exp = Math.max(this.exp, other.exp);

        // Add mantissas with alignment
        for (let i = 0; i < result.precision; i++) {
            const thisIdx = i;
            const otherIdx = i + limbShift;

            if (thisIdx < this.precision) {
                result.mantissa[i] += this.mantissa[thisIdx];
            }
            if (otherIdx >= 0 && otherIdx < other.precision) {
                result.mantissa[i] += other.mantissa[otherIdx];
            }
        }

        return result.normalize();
    }

    /**
     * Subtract another BigFloat
     */
    sub(other) {
        if (other.isZero()) return this.clone();

        // Handle different signs: a - (-b) = a + b
        if (this.sign !== other.sign) {
            const otherNeg = other.clone();
            otherNeg.sign = -otherNeg.sign;
            return this.add(otherNeg);
        }

        // Compare magnitudes
        const cmp = this.compareMagnitude(other);
        if (cmp === 0) {
            return new BigFloat(0, this.precision);
        }

        const result = new BigFloat(0, Math.max(this.precision, other.precision));

        let larger, smaller;
        if (cmp > 0) {
            larger = this;
            smaller = other;
            result.sign = this.sign;
        } else {
            larger = other;
            smaller = this;
            result.sign = -this.sign;
        }

        result.exp = larger.exp;

        // Subtract with borrow
        const expDiff = larger.exp - smaller.exp;
        const limbShift = Math.floor(expDiff / LIMB_BITS);

        for (let i = 0; i < result.precision; i++) {
            if (i < larger.precision) {
                result.mantissa[i] = larger.mantissa[i];
            }
            const smallerIdx = i + limbShift;
            if (smallerIdx >= 0 && smallerIdx < smaller.precision) {
                result.mantissa[i] -= smaller.mantissa[smallerIdx];
            }
        }

        // Handle borrows
        for (let i = result.precision - 1; i > 0; i--) {
            if (result.mantissa[i] < 0) {
                result.mantissa[i] += LIMB_BASE;
                result.mantissa[i - 1]--;
            }
        }

        return result.normalize();
    }

    /**
     * Multiply by another BigFloat
     */
    mul(other) {
        if (this.isZero() || other.isZero()) {
            return new BigFloat(0, this.precision);
        }

        const result = new BigFloat(0, Math.max(this.precision, other.precision));
        result.sign = this.sign * other.sign;
        result.exp = this.exp + other.exp;

        // Convolution for multiplication
        const temp = new Float64Array(this.precision + other.precision);

        for (let i = 0; i < this.precision; i++) {
            for (let j = 0; j < other.precision; j++) {
                temp[i + j] += this.mantissa[i] * other.mantissa[j];
            }
        }

        // Normalize temp into result
        let carry = 0;
        for (let i = temp.length - 1; i >= 0; i--) {
            temp[i] += carry;
            carry = Math.floor(temp[i] / LIMB_BASE);
            temp[i] = temp[i] % LIMB_BASE;
        }

        // Copy to result (first precision limbs)
        let shift = 0;
        while (shift < temp.length && temp[shift] === 0) {
            shift++;
        }

        for (let i = 0; i < result.precision; i++) {
            if (i + shift < temp.length) {
                result.mantissa[i] = temp[i + shift];
            }
        }

        // Adjust exponent for shift
        result.exp += (this.precision - shift) * LIMB_BITS;

        return result.normalize();
    }

    /**
     * Square this number (faster than mul(this))
     */
    square() {
        return this.mul(this);
    }

    /**
     * Compare magnitudes (ignoring sign)
     * Returns: -1 if |this| < |other|, 0 if equal, 1 if |this| > |other|
     */
    compareMagnitude(other) {
        if (this.exp !== other.exp) {
            return this.exp > other.exp ? 1 : -1;
        }

        for (let i = 0; i < Math.max(this.precision, other.precision); i++) {
            const thisLimb = i < this.precision ? this.mantissa[i] : 0;
            const otherLimb = i < other.precision ? other.mantissa[i] : 0;
            if (thisLimb !== otherLimb) {
                return thisLimb > otherLimb ? 1 : -1;
            }
        }

        return 0;
    }

    /**
     * Get the magnitude squared (for escape check)
     * Returns a regular number (loses precision but fast for comparison)
     */
    static magnitudeSquared(re, im) {
        // For escape check, we only need approximate magnitude
        return re.toNumber() ** 2 + im.toNumber() ** 2;
    }
}

/**
 * BigComplex - Complex number using BigFloat components
 */
export class BigComplex {
    constructor(re = 0, im = 0, precision = 4) {
        this.precision = precision;
        this.re = re instanceof BigFloat ? re : new BigFloat(re, precision);
        this.im = im instanceof BigFloat ? im : new BigFloat(im, precision);
    }

    clone() {
        return new BigComplex(this.re.clone(), this.im.clone(), this.precision);
    }

    /**
     * Add another complex number
     */
    add(other) {
        return new BigComplex(
            this.re.add(other.re),
            this.im.add(other.im),
            this.precision
        );
    }

    /**
     * Subtract another complex number
     */
    sub(other) {
        return new BigComplex(
            this.re.sub(other.re),
            this.im.sub(other.im),
            this.precision
        );
    }

    /**
     * Multiply by another complex number
     * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
     */
    mul(other) {
        const ac = this.re.mul(other.re);
        const bd = this.im.mul(other.im);
        const ad = this.re.mul(other.im);
        const bc = this.im.mul(other.re);

        return new BigComplex(
            ac.sub(bd),
            ad.add(bc),
            this.precision
        );
    }

    /**
     * Square this complex number
     * (a + bi)^2 = (a^2 - b^2) + 2abi
     */
    square() {
        const a2 = this.re.square();
        const b2 = this.im.square();
        const ab = this.re.mul(this.im);
        const two = new BigFloat(2, this.precision);

        return new BigComplex(
            a2.sub(b2),
            ab.mul(two),
            this.precision
        );
    }

    /**
     * Get magnitude squared (as regular number for escape check)
     */
    magnitudeSquared() {
        return BigFloat.magnitudeSquared(this.re, this.im);
    }

    /**
     * Convert to hi/lo pairs for GPU
     */
    toHiLo() {
        return {
            re: this.re.toHiLo(),
            im: this.im.toHiLo()
        };
    }

    /**
     * Convert to regular JavaScript numbers
     */
    toNumbers() {
        return {
            re: this.re.toNumber(),
            im: this.im.toNumber()
        };
    }
}

/**
 * Determine required precision based on zoom level
 * @param {number} zoomLog - Log2 of zoom level
 * @returns {number} Required limbs
 */
export function getPrecisionForZoom(zoomLog) {
    // Each limb gives ~26 bits of precision
    // Standard float32 has ~23 bits, so we need extra precision beyond that
    // At zoomLog N, we need roughly N bits of precision
    const bitsNeeded = Math.max(53, zoomLog + 30);  // Extra margin for arithmetic
    const limbs = Math.ceil(bitsNeeded / LIMB_BITS);
    return Math.max(4, Math.min(16, limbs));  // 4 to 16 limbs (104 to 416 bits)
}
