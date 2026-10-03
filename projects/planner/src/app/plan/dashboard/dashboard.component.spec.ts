import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location, NgClass } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { TranslatePipe } from '@ngx-translate/core';
import { NEVER } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DashboardStartUp, InstallPlatform } from '../../shared/startUp';
import { PreferencesStore } from '../../shared/preferencesStore';
import { PlanUrlSerialization } from '../../shared/PlanUrlSerialization';
import { SubViewStorage } from '../../shared/subViewStorage';
import { ViewStates } from '../../shared/viewStates';
import { HelpService } from '../../shared/learn/help.service';
import { ShareDiveService } from '../../shared/ShareDiveService';
import { ViewSwitchService } from '../../shared/viewSwitchService';
import { UnitConversion } from '../../shared/UnitConversion';
import { ReloadDispatcher } from '../../shared/reloadDispatcher';
import { DiveSchedules } from '../../shared/dive.schedules';
import { provideTestTranslate } from '../../../testing/translate-testing.helpers';

describe('DashboardComponent install banner', () => {
    const iPhoneAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

    let fixture: ComponentFixture<DashboardComponent>;

    beforeEach(async () => {
        const preferences = jasmine.createSpyObj<PreferencesStore>('PreferencesStore',
            ['disclaimerEnabled', 'installEnabled', 'disableShowInstall']);
        preferences.disclaimerEnabled.and.returnValue(false);
        preferences.installEnabled.and.returnValue(true);
        const iPhone: InstallPlatform = {
            navigator: { userAgent: iPhoneAgent, maxTouchPoints: 5, standalone: false },
            matchMedia: () => ({ matches: false })
        };

        const startUp = new DashboardStartUp({} as Location, preferences, {} as PlanUrlSerialization,
            {} as SubViewStorage, {} as ViewStates, {} as HelpService, iPhone);
        spyOn(startUp, 'onDashboard');
        spyOn(startUp, 'updateQueryParams');

        await TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [
                provideTestTranslate(),
                { provide: DashboardStartUp, useValue: startUp },
                { provide: ShareDiveService, useValue: { toastVisible: false } },
                { provide: ViewSwitchService, useValue: { isComplex: false } },
                { provide: UnitConversion, useValue: { imperialUnits: false } },
                { provide: ReloadDispatcher, useValue: { infoCalculated$: NEVER, selectedChanged$: NEVER } },
                { provide: DiveSchedules, useValue: {} }
            ]
        })
            // render only the banners, child panels are out of scope here
            .overrideComponent(DashboardComponent, {
                set: { imports: [ReactiveFormsModule, FaIconComponent, NgClass, TranslatePipe], schemas: [CUSTOM_ELEMENTS_SCHEMA] }
            })
            .compileComponents();

        fixture = TestBed.createComponent(DashboardComponent);
        fixture.detectChanges();
    });

    it('shows Apple add to home screen hint on iPhone without install prompt event', () => {
        const banner = fixture.nativeElement as HTMLElement;
        expect(banner.textContent).toContain('dashboard.installAppleMessage');
        expect(banner.textContent).not.toContain('dashboard.addToHomeScreen');
    });
});
