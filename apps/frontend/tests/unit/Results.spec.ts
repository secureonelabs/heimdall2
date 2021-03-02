import ControlTable from '@/components/cards/controltable/ControlTable.vue';
import ProfData from '@/components/cards/ProfileData.vue';
import {FilteredDataModule} from '@/store/data_filters';
import {profile_unique_key} from '@/utilities/format_util';
import Results from '@/views/Results.vue';
import {shallowMount, Wrapper} from '@vue/test-utils';
import {context} from 'inspecjs';
import 'jest';
import Vue from 'vue';
import Vuetify from 'vuetify';
import {
  expectedCount,
  loadAll,
  loadSample,
  removeAllFiles
} from '../util/testingUtils';

interface ListElt {
  // A unique id to be used as a key.
  key: string;

  // Computed values for status and severity "value", for sorting
  status_val: number;
  severity_val: number;

  control: context.ContextualizedControl;
}

interface InfoItem {
  label: string;
  text: string;
  info?: string;
}

const $router = {
  currentRoute: {
    path: '/results'
  }
};
const vuetify = new Vuetify();
let profInfoWrapper: Wrapper<Vue>;
let controlTableWrapper: Wrapper<Vue>;

const wrapper: Wrapper<Vue> = shallowMount(Results, {
  vuetify,
  mocks: {
    $router
  },
  propsData: {}
});

loadSample('Acme Overlay Example');

describe('Profile Info', () => {
  it('shows correct number of files', () => {
    loadAll();
    expect((wrapper.vm as any).filteFilter.length).toBe(
      FilteredDataModule.selectedFileIds.length
    );
  });

  it('no children', () => {
    removeAllFiles();
    loadSample('NGINX Clean Sample');

    profInfoWrapper = shallowMount(ProfData, {
      vuetify,
      mocks: {
        $router
      },
      propsData: {
        selected_prof: (wrapper.vm as any).rootProfiles[0]
      }
    });

    expect((profInfoWrapper.vm as any).items.length).toBe(0);
  });

  it('2 children', () => {
    removeAllFiles();
    loadSample('Acme Overlay Example');

    profInfoWrapper = shallowMount(ProfData, {
      vuetify,
      mocks: {
        $router
      },
      propsData: {
        selected_prof: (wrapper.vm as any).rootProfiles[0]
      }
    });

    const actual = [
      (profInfoWrapper.vm as any).items[0].name,
      (profInfoWrapper.vm as any).items[1].name
    ];
    const expected = ['ssh-baseline', 'ssl-baseline'];

    expect(actual).toEqual(expected);
  });

  it('children of children', () => {
    removeAllFiles();
    loadSample('Triple Overlay Example');

    profInfoWrapper = shallowMount(ProfData, {
      vuetify,
      mocks: {
        $router
      },
      propsData: {
        selected_prof: (wrapper.vm as any).rootProfiles[0]
      }
    });

    expect((profInfoWrapper.vm as any).items[0].children[0].name).toBe(
      'Oracle Database 12c Security Technical Implementation Guide'
    );
  });

  it('parent has correct data', () => {
    const expected: InfoItem[] = [
      {label: 'Version', text: '0.1.0'},
      {label: 'From file', text: 'Triple Overlay Example'},
      {label: 'Start time', text: '2020-06-01T18:50:31+00:00'},
      {
        label: 'Sha256 Hash',
        text: '3fe40f9476a23b5b4dd6c0da2bb8dbe8ca5a4a8b6bfb27ffbf9f1797160c0f91'
      },
      {label: 'Title', text: '.'},
      {label: 'Maintainer', text: 'CMS InSpec Dev Team'},
      {label: 'Copyright', text: '.'},
      {label: 'Controls', text: '200'}
    ];
    expect((profInfoWrapper.vm as any).selected_info).toEqual(expected);
  });

  it('children have correct data', () => {
    const expected: InfoItem[] = [
      {label: 'Version', text: '0.1.0'},
      {label: 'From file', text: 'Triple Overlay Example'},
      {label: 'Start time', text: '2020-06-01T18:50:31+00:00'},
      {
        label: 'Sha256 Hash',
        text: 'a34d4b2bb6d5675173abdb1df727cc552807b5c80c1d5de027b85c640f8a0fee'
      },
      {label: 'Title', text: 'InSpec Profile'},
      {label: 'Maintainer', text: 'The Authors'},
      {label: 'Copyright', text: 'The Authors'},
      {label: 'Copyright Email', text: 'you@example.com'},
      {label: 'Controls', text: '200'}
    ];
    (profInfoWrapper.vm as any).active = [];
    (profInfoWrapper.vm as any).child_active = [
      profile_unique_key((wrapper.vm as any).visibleProfiles[1])
    ];
    expect((profInfoWrapper.vm as any).selected_info).toEqual(expected);
  });
});

describe('Datatable', () => {
  it('displays correct number of controls with many files', () => {
    removeAllFiles();
    loadAll();
    controlTableWrapper = shallowMount(ControlTable, {
      vuetify,
      mocks: {
        $router
      },
      propsData: {
        filter: (wrapper.vm as any).allFilter,
        showImpact: true
      }
    });
    const expected =
      expectedCount('passed') +
      expectedCount('failed') +
      expectedCount('notReviewed') +
      expectedCount('notApplicable') +
      expectedCount('profileError');
    expect((controlTableWrapper.vm as any).items.length).toBe(expected);
  });

  it('control row and table data is correct', () => {
    expect(
      (controlTableWrapper.vm as any).items
        .map((item: ListElt) => item.control.data.id)
        .sort()
    ).toEqual(
      FilteredDataModule.controls({
        fromFile: FilteredDataModule.selectedFileIds,
        omitOverlayedControls: true
      })
        .map((c) => c.data.id)
        .sort()
    );
  });
});
