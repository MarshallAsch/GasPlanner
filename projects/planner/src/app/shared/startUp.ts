import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Location } from '@angular/common';
import { PreferencesStore } from './preferencesStore';
import { PlanUrlSerialization } from './PlanUrlSerialization';
import { SubViewStorage } from './subViewStorage';
import { ViewStates } from './viewStates';
import { HelpService } from './learn/help.service';

/** Subset of the browser window used to decide how to offer app installation. */
export interface InstallPlatform {
    navigator: {
        userAgent: string;
        maxTouchPoints: number;
        /** Safari only: true when launched from the home screen */
        standalone?: boolean;
    };
    matchMedia(query: string): { matches: boolean };
}

export const INSTALL_PLATFORM = new InjectionToken<InstallPlatform>('InstallPlatform', {
    providedIn: 'root',
    factory: (): InstallPlatform => window
});

@Injectable()
export class DashboardStartUp {
    private _showDisclaimer = true;
    private _showInstallButton = false;
    private allowInstall = false;
    private deferredPrompt: any;

    constructor(
        private location: Location,
        private preferences: PreferencesStore,
        private urlSerialization: PlanUrlSerialization,
        private viewStore: SubViewStorage,
        private views: ViewStates,
        private help: HelpService,
        @Inject(INSTALL_PLATFORM) private platform: InstallPlatform
    ) {
        this._showDisclaimer = this.preferences.disclaimerEnabled();
        this._showInstallButton = this.preferences.installEnabled();
    }

    public get showDisclaimer(): boolean {
        return this._showDisclaimer;
    }

    public get showInstallButton(): boolean {
        // iOS Safari never fires beforeinstallprompt, so the Apple hint can't depend on it
        return this._showInstallButton && (this.allowInstall || this.showAppleInstall);
    }

    public get showAppleInstall(): boolean {
        return this.isApple && !this.isStandalone;
    }

    private get isApple(): boolean {
        const nav = this.platform.navigator;
        const isIOs = /iphone|ipad|ipod/i.test(nav.userAgent);
        // iPadOS 13+ reports itself as desktop Mac, only touch support tells the difference
        const isIPadOs = /macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1;
        return isIOs || isIPadOs;
    }

    private get isStandalone(): boolean {
        return this.platform.navigator.standalone === true ||
            this.platform.matchMedia('(display-mode: standalone)').matches;
    }

    public onDashboard(): void {
        const query = window.location.search;

        if (query === '' || this.views.started) {
            // no need to restore the state, since dives are kept in service states
            // no calculation needed because it was already done in reload
        } else {
            // the only view which loads from parameters instead of view state
            this.urlSerialization.fromUrl(query);
        }

        // cant do in constructor, since the state may be changed
        this.viewStore.saveMainView();
        this.showLearnWelcome();

        // in case it fails we need to reset the parameters
        // or in case of navigation to dashboard with only one dive
        this.updateQueryParams();
    }

    public stopDisclaimer(): void {
        this._showDisclaimer = false;
        this.preferences.disableDisclaimer();
    }

    public stopShowInstallButton(): void {
        this._showInstallButton = false;
        this.preferences.disableShowInstall();
    }

    public updateQueryParams(): void {
        let urlParams = this.urlSerialization.toUrl();
        const maxUrlRecommendedLength = 2048;

        if (urlParams.length > maxUrlRecommendedLength) {
            console.warn('Created url parameters with length longer than acceptable in some browsers');
        }

        if(urlParams.length > 0) {
            urlParams = '?' + urlParams;
        }

        this.location.go(urlParams);
    }

    public onbeforeinstallprompt(e: Event): void {
        e.preventDefault();
        this.deferredPrompt = e;
        this.allowInstall = true;
    }

    public addToHomeScreen(): void {
        this.allowInstall = false;
        this.stopShowInstallButton();

        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice
                .then((choiceResult: any) => {
                    this.deferredPrompt = null;
                });
        }
    }

    private showLearnWelcome(): void {
        const threeMinutes = 3 * 60 * 1000;

        setTimeout(() => {
            if (this.preferences.quizWelcomeEnabled()) {
                this.preferences.disableQuizWelcome();
                this.help.openLearnWelcome();
            }
        }, threeMinutes);
    }
}
