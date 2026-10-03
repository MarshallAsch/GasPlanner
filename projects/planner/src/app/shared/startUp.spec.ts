import { Location } from '@angular/common';
import { DashboardStartUp, InstallPlatform } from './startUp';
import { PreferencesStore } from './preferencesStore';
import { PlanUrlSerialization } from './PlanUrlSerialization';
import { SubViewStorage } from './subViewStorage';
import { ViewStates } from './viewStates';
import { HelpService } from './learn/help.service';

const iPhoneAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const macAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const androidAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const createPlatform = (userAgent: string, maxTouchPoints = 0, standalone = false, displayStandalone = false): InstallPlatform => ({
    navigator: { userAgent, maxTouchPoints, standalone },
    matchMedia: (query: string) => ({ matches: displayStandalone && query === '(display-mode: standalone)' })
});

describe('DashboardStartUp', () => {
    let installEnabled: boolean;
    let preferences: jasmine.SpyObj<PreferencesStore>;

    const createSut = (platform: InstallPlatform): DashboardStartUp => new DashboardStartUp(
        {} as Location,
        preferences,
        {} as PlanUrlSerialization,
        {} as SubViewStorage,
        {} as ViewStates,
        {} as HelpService,
        platform
    );

    const createPromptEvent = (): Event => new Event('beforeinstallprompt', { cancelable: true });

    beforeEach(() => {
        installEnabled = true;
        preferences = jasmine.createSpyObj<PreferencesStore>('PreferencesStore',
            ['disclaimerEnabled', 'installEnabled', 'disableShowInstall', 'disableDisclaimer']);
        preferences.disclaimerEnabled.and.returnValue(true);
        preferences.installEnabled.and.callFake(() => installEnabled);
    });

    describe('Apple', () => {
        it('iPhone shows install hint without install prompt event', () => {
            const sut = createSut(createPlatform(iPhoneAgent, 5));
            expect(sut.showAppleInstall).toBeTrue();
            expect(sut.showInstallButton).toBeTrue();
        });

        it('iPhone in standalone mode hides install hint', () => {
            const sut = createSut(createPlatform(iPhoneAgent, 5, true));
            expect(sut.showAppleInstall).toBeFalse();
            expect(sut.showInstallButton).toBeFalse();
        });

        it('iPhone in display-mode standalone hides install hint', () => {
            const sut = createSut(createPlatform(iPhoneAgent, 5, false, true));
            expect(sut.showInstallButton).toBeFalse();
        });

        it('iPad reporting as Mac with touch shows install hint', () => {
            const sut = createSut(createPlatform(macAgent, 5));
            expect(sut.showAppleInstall).toBeTrue();
            expect(sut.showInstallButton).toBeTrue();
        });

        it('desktop Mac without touch is not Apple install', () => {
            const sut = createSut(createPlatform(macAgent, 0));
            expect(sut.showAppleInstall).toBeFalse();
            expect(sut.showInstallButton).toBeFalse();
        });

        it('dismissed hint stays hidden', () => {
            installEnabled = false;
            const sut = createSut(createPlatform(iPhoneAgent, 5));
            expect(sut.showInstallButton).toBeFalse();
        });

        it('closing hint hides it', () => {
            const sut = createSut(createPlatform(iPhoneAgent, 5));
            sut.stopShowInstallButton();
            expect(sut.showInstallButton).toBeFalse();
        });
    });

    describe('Android', () => {
        it('hides install button without install prompt event', () => {
            const sut = createSut(createPlatform(androidAgent, 5));
            expect(sut.showAppleInstall).toBeFalse();
            expect(sut.showInstallButton).toBeFalse();
        });

        it('shows install button after install prompt event', () => {
            const sut = createSut(createPlatform(androidAgent, 5));
            sut.onbeforeinstallprompt(createPromptEvent());
            expect(sut.showInstallButton).toBeTrue();
        });
    });
});
