import { DepthConverter } from '../physics/depth-converter';
import { Segment } from '../depths/Segments';
import { Time } from '../physics/Time';
import { BreathingModel } from '../ccr/BreathingModel';

/** Source of the CNS oxygen exposure limits */
export enum CnsLimits {
    /** NOAA Diving Manual single exposure and 24 hour limits */
    noaa = 1,
    /**
     * Revised limits by Hoyt et al. 2025 (Diving and Hyperbaric Medicine 55:228).
     * The revised guideline covers only ppO2 1.3 bar: 240 min. working + 240 min. resting.
     * Conservative interpretation: for ppO2 up to 1.3 bar both single exposure and 24 hour limits
     * are the longer of the NOAA limit and 240 min. Above 1.3 bar NOAA limits apply unchanged.
     * This creates a step down of the limit just above 1.3 bar (e.g. 1.31 bar uses NOAA limit only).
     */
    revised2025 = 2
}

export class RevisedCnsLimits {
    /** Maximum ppO2 in bars covered by the revised limits */
    public static readonly maximumPpO2 = 1.3;
    /** Minimum exposure limit in seconds for ppO2 up to maximumPpO2 */
    public static readonly minimumLimit = Time.oneMinute * 240;

    /**
     * Applies the revised limit to the NOAA limit
     * @param ppO2 partial pressure of oxygen in bars
     * @param noaaLimit NOAA exposure limit in seconds
     * @param limits source of the limits
     * @returns exposure limit in seconds
     */
    public static apply(ppO2: number, noaaLimit: number, limits: CnsLimits): number {
        if (limits === CnsLimits.revised2025 && ppO2 <= RevisedCnsLimits.maximumPpO2) {
            return Math.max(noaaLimit, RevisedCnsLimits.minimumLimit);
        }

        return noaaLimit;
    }
}

/**
 * Reference: https://www.shearwater.com/wp-content/uploads/2012/08/Oxygen_Toxicity_Calculations.pdf
 * Shortcuts for the most common operations:
 *   AAP = absolute atmospheric pressure
 *   ppO2 = partial pressure of oxygen
 *   fO2 = oxygen fraction
 */
export class CnsCalculator {
    /** Surface elimination half time of CNS toxicity used by most dive computers */
    public static readonly halfTime = Time.oneMinute * 90;
    /** Maximum CNS toxicity in % */
    public static readonly limit = 100;
    private readonly minimumPpO2 = 0.5;

    constructor(private depthConverter: DepthConverter, private readonly breathing: BreathingModel,
        private limits: CnsLimits = CnsLimits.noaa) {
    }

    /**
     * Calculates remaining CNS toxicity in % after the surface interval.
     * The CNS is eliminated exponentially with 90 minutes half time.
     * @param cns CNS toxicity in % at end of previous dive
     * @param surfaceInterval duration of the surface interval in seconds, Infinity for first dive
     */
    public static residual(cns: number, surfaceInterval: number): number {
        if (cns <= 0 || surfaceInterval === Number.POSITIVE_INFINITY) {
            return 0;
        }

        return cns * Math.pow(0.5, surfaceInterval / CnsCalculator.halfTime);
    }

    /**
     * Calculates total CNS % for provided profile
     * @param startAscentIndex index of first segment of calculated ascent, Infinity if not known
     */
    public calculateForProfile(profile: Segment[], startAscentIndex: number = Number.POSITIVE_INFINITY): number {
        let total = 0;

        profile.forEach((segment, index) => {
            const avgDepth = (segment.startDepth + segment.endDepth) / 2;
            const ppO2 = this.breathing.ppO2(segment.gas, avgDepth, index >= startAscentIndex);
            total += this.calculateByPpO2(ppO2, segment.duration);
        });

        return total;
    }

    /**
     * Calculates total CNS % at end of provided dive profile,
     * including remaining CNS from previous dive after the surface interval.
     * @param profile the dive profile
     * @param previousCns CNS % at end of previous dive
     * @param surfaceInterval duration of the surface interval in seconds, Infinity for first dive
     * @param startAscentIndex index of first segment of calculated ascent, Infinity if not known
     */
    public calculateForRepetitiveDive(profile: Segment[], previousCns: number, surfaceInterval: number,
        startAscentIndex: number = Number.POSITIVE_INFINITY): number {
        const residual = CnsCalculator.residual(previousCns, surfaceInterval);
        return residual + this.calculateForProfile(profile, startAscentIndex);
    }

    /**
     * Calculates CNS in % for provided profile segment
     * @param fO2 oxygen fraction
     * @param startDepth starting depth in meters
     * @param endDepth end depth in meters
     * @param duration duration in seconds
     */
    public calculate(fO2: number, startDepth: number, endDepth: number, duration: number): number {
        const avgDepth = (startDepth + endDepth) / 2;
        const aap = this.depthConverter.toBar(avgDepth);
        const ppO2 = fO2 * aap;
        return this.calculateByPpO2(ppO2, duration);
    }

    /**
     * Calculates CNS in % for constant oxygen partial pressure
     * @param ppO2 oxygen partial pressure in bars
     * @param duration duration in seconds
     */
    public calculateByPpO2(ppO2: number, duration: number): number {
        if(ppO2 <= this.minimumPpO2) {
            return 0;
        }

        // https://thetheoreticaldiver.org/wordpress/index.php/2019/08/15/calculating-oxygen-cns-toxicity/
        const exponent = this.exponentByPpO2(ppO2);
        const noaaLimit = 1 / Math.exp(exponent);
        const limit = RevisedCnsLimits.apply(ppO2, noaaLimit, this.limits);
        const cns = duration / limit;
        return cns * 100;
    }

    // slope function as mentioned from the paper above
    private exponentByPpO2(ppO2: number): number {
        if(ppO2 <= 1.5) {
            return -11.7853 + 1.93873 * ppO2;
        }

        return -23.6349 + 9.80829 * ppO2;
    }
}
