import { CnsCalculator, CnsLimits } from './cnsCalculator';
import { CnsDailyCalculator } from './cnsDailyCalculator';
import { DepthConverter } from '../physics/depth-converter';
import { Time } from '../physics/Time';
import { OpenCircuitBreathing } from '../ccr/BreathingModel';

/**
 * In 10 m with simple converter the pressure is exactly 2 bar,
 * so the ppO2 is exactly 2 * fO2 and no rounding issue at limit boundaries.
 */
describe('CNS limits', () => {
    const depthConverter = DepthConverter.simple();
    const breathing = new OpenCircuitBreathing(depthConverter);
    const depth = 10;
    const fO2For = (ppO2: number): number => ppO2 / 2;

    describe('Single exposure', () => {
        const noaa = new CnsCalculator(depthConverter, breathing, CnsLimits.noaa);
        const revised = new CnsCalculator(depthConverter, breathing, CnsLimits.revised2025);
        const byDefault = new CnsCalculator(depthConverter, breathing);

        const calculate = (sut: CnsCalculator, ppO2: number, minutes: number): number =>
            sut.calculate(fO2For(ppO2), depth, depth, Time.oneMinute * minutes);

        it('Uses NOAA limits by default', () => {
            expect(calculate(byDefault, 1.3, 240)).toBeCloseTo(calculate(noaa, 1.3, 240), 6);
        });

        it('NOAA exceeds 100 % for 240 min at ppO2 1.3', () => {
            expect(calculate(noaa, 1.3, 240)).toBeGreaterThan(100);
        });

        it('Revised uses NOAA limit at ppO2 1.1, since it is longer than 240 min', () => {
            expect(calculate(revised, 1.1, 240)).toBeCloseTo(calculate(noaa, 1.1, 240), 6);
        });

        it('Revised 100 % for 240 min at ppO2 1.29', () => {
            expect(calculate(revised, 1.29, 240)).toBeCloseTo(100, 6);
        });

        it('Revised 100 % for 240 min at ppO2 1.3', () => {
            expect(calculate(revised, 1.3, 240)).toBeCloseTo(100, 6);
        });

        it('Revised uses NOAA limit at ppO2 1.31', () => {
            expect(calculate(revised, 1.31, 100)).toBeCloseTo(calculate(noaa, 1.31, 100), 6);
        });

        it('Revised uses NOAA limit at ppO2 1.6', () => {
            expect(calculate(revised, 1.6, 30)).toBeCloseTo(calculate(noaa, 1.6, 30), 6);
        });

        it('Revised counts 0 % at ppO2 0.5', () => {
            expect(calculate(revised, 0.5, 240)).toBeCloseTo(0, 6);
        });
    });

    describe('Daily', () => {
        const noaa = new CnsDailyCalculator(depthConverter, breathing, CnsLimits.noaa);
        const revised = new CnsDailyCalculator(depthConverter, breathing, CnsLimits.revised2025);
        const byDefault = new CnsDailyCalculator(depthConverter, breathing);

        const calculate = (sut: CnsDailyCalculator, ppO2: number, minutes: number): number =>
            sut.calculate(fO2For(ppO2), depth, depth, Time.oneMinute * minutes);

        it('Daily uses NOAA limits by default', () => {
            expect(calculate(byDefault, 1.3, 210)).toBeCloseTo(100, 6);
        });

        it('NOAA 100 % for 210 min at ppO2 1.3', () => {
            expect(calculate(noaa, 1.3, 210)).toBeCloseTo(100, 6);
        });

        it('Revised keeps NOAA 270 min limit at ppO2 1.1', () => {
            expect(calculate(revised, 1.1, 270)).toBeCloseTo(100, 6);
        });

        it('Daily revised 100 % for 240 min at ppO2 1.29', () => {
            expect(calculate(revised, 1.29, 240)).toBeCloseTo(100, 6);
        });

        it('Daily revised 100 % for 240 min at ppO2 1.3', () => {
            expect(calculate(revised, 1.3, 240)).toBeCloseTo(100, 6);
        });

        it('Revised keeps NOAA interpolated 207 min limit at ppO2 1.31', () => {
            expect(calculate(revised, 1.31, 207)).toBeCloseTo(100, 6);
        });

        it('Revised keeps NOAA 150 min limit at ppO2 1.6', () => {
            expect(calculate(revised, 1.6, 150)).toBeCloseTo(100, 6);
        });

        it('Daily revised counts 0 % at ppO2 0.5', () => {
            expect(calculate(revised, 0.5, 240)).toBeCloseTo(0, 6);
        });
    });
});
