import {FilteredDataModule} from '@/store/data_filters';
import {StatusCountModule} from '@/store/status_counts';
import {ComparisonContext} from '@/utilities/delta_util';
import Compare from '@/views/Compare.vue';
import {shallowMount, Wrapper} from '@vue/test-utils';
import 'jest';
import Vue from 'vue';
import Vuetify from 'vuetify';
import {fileCompliance, loadSample, removeAllFiles} from '../util/testingUtils';

const vuetify = new Vuetify();

const wrapper: Wrapper<Vue> = shallowMount(Compare, {
  vuetify,
  propsData: {}
});

const redHatControlCount = 247;
const redHatDelta = 27;
const nginxControlCount = 41;
const nginxDelta = 3;

describe('Compare table data', () => {
  loadSample('NGINX With Failing Tests');
  it('correctly counts controls with 1 file', () => {
    expect((wrapper.vm as any).control_sets.length).toBe(nginxControlCount);
  });

  it('does not recount same controls with 2 files', () => {
    loadSample('NGINX With Failing Tests');
    expect((wrapper.vm as any).control_sets.length).toBe(nginxControlCount);
  });

  it('does not show any changed between two of the same', () => {
    expect((wrapper.vm as any).show_sets.length).toBe(0);
  });

  it('does not recount same controls with 3 files', () => {
    loadSample('NGINX With Failing Tests');
    expect((wrapper.vm as any).control_sets.length).toBe(nginxControlCount);
  });

  it('search works when nothing fits criteria', () => {
    (wrapper.vm as any).searchTerm = 'failed';
    expect((wrapper.vm as any).show_sets.length).toBe(0);
  });

  it('search id works', () => {
    (wrapper.vm as any).checkbox = false;
    (wrapper.vm as any).searchTerm = 'v-13613';
    expect((wrapper.vm as any).show_sets.length).toBe(1);
  });

  it('does not recount same control with different data', () => {
    (wrapper.vm as any).searchTerm = '';
    (wrapper.vm as any).checkbox = true;
    loadSample('NGINX Clean Sample');
    expect((wrapper.vm as any).control_sets.length).toBe(nginxControlCount);
  });

  it('shows differing delta data when "show only changed"', () => {
    expect((wrapper.vm as any).show_sets.length).toBe(nginxDelta);
  });

  it('search status works', () => {
    (wrapper.vm as any).checkbox = false;
    (wrapper.vm as any).searchTerm = 'failed';
    expect((wrapper.vm as any).show_sets.length).toBe(nginxDelta);
  });

  it('counts every unique control', () => {
    loadSample('Red Hat With Failing Tests');
    (wrapper.vm as any).searchTerm = '';
    (wrapper.vm as any).checkbox = true;
    expect((wrapper.vm as any).control_sets.length).toBe(
      nginxControlCount + redHatControlCount
    );
  });

  it('doesnt show data of controls with one instance when "show only changed"', () => {
    expect((wrapper.vm as any).show_sets.length).toBe(nginxDelta);
  });

  it('shows all delta data of controls with multiple occurances when "show only changed"', () => {
    loadSample('Red Hat Clean Sample');
    expect((wrapper.vm as any).show_sets.length).toBe(nginxDelta + redHatDelta);
  });

  it('ComparisonContext counts status correctly', () => {
    let failed = 0;
    let passed = 0;
    let na = 0;
    let nr = 0;
    let pe = 0;
    const selectedData = FilteredDataModule.evaluations(
      FilteredDataModule.selectedFileIds
    );
    const currDelta = new ComparisonContext(selectedData);
    for (const pairing of Object.values(currDelta.pairings)) {
      for (const ctrl of pairing) {
        if (ctrl === null) {
          continue;
        } else if (ctrl!.root.hdf.status == 'Passed') {
          passed++;
        } else if (ctrl!.root.hdf.status == 'Failed') {
          failed++;
        } else if (ctrl!.root.hdf.status == 'Not Applicable') {
          na++;
        } else if (ctrl!.root.hdf.status == 'Not Reviewed') {
          nr++;
        } else if (ctrl!.root.hdf.status == 'Profile Error') {
          pe++;
        }
      }
    }
    const expected = {
      Failed: StatusCountModule.hash({
        omitOverlayedControls: true,
        fromFile: [...FilteredDataModule.selectedFileIds]
      }).Failed,
      Passed: StatusCountModule.hash({
        omitOverlayedControls: true,
        fromFile: [...FilteredDataModule.selectedFileIds]
      }).Passed,
      'From Profile': 0,
      'Profile Error': StatusCountModule.hash({
        omitOverlayedControls: true,
        fromFile: [...FilteredDataModule.selectedFileIds]
      })['Profile Error'],
      'Not Reviewed': StatusCountModule.hash({
        omitOverlayedControls: true,
        fromFile: [...FilteredDataModule.selectedFileIds]
      })['Not Reviewed'],
      'Not Applicable': StatusCountModule.hash({
        omitOverlayedControls: true,
        fromFile: [...FilteredDataModule.selectedFileIds]
      })['Not Applicable']
    };
    const actual = {
      Failed: failed,
      Passed: passed,
      'From Profile': 0,
      'Profile Error': pe,
      'Not Reviewed': nr,
      'Not Applicable': na
    };
    expect(actual).toEqual(expected);
  });
});

describe('compare charts', () => {
  it('sev chart gets correct data with 2 files', () => {
    removeAllFiles();
    loadSample('NGINX With Failing Tests');
    loadSample('NGINX Clean Sample');
    //the values in expected are the correct data
    expect((wrapper.vm as any).sev_series).toEqual([
      [0, 0],
      [3, 0],
      [0, 0],
      [0, 0]
    ]);
  });

  it('sev chart gets correct data with 2 files with differing profiles', () => {
    removeAllFiles();
    loadSample('NGINX With Failing Tests');
    loadSample('Red Hat With Failing Tests');
    //the values in expected are the correct data
    expect((wrapper.vm as any).sev_series).toEqual([
      [0, 6],
      [3, 18],
      [0, 3],
      [0, 0]
    ]);
  });

  it('sev chart gets correct data with 2 files with overlayed profiles', () => {
    removeAllFiles();
    loadSample('Triple Overlay Example');
    loadSample('Acme Overlay Example');
    //the values in expected are the correct data
    expect((wrapper.vm as any).sev_series).toEqual([
      [3, 0],
      [51, 0],
      [1, 0],
      [0, 60]
    ]);
  });

  it('compliance chart gets correct data with 2 files', () => {
    removeAllFiles();
    loadSample('NGINX With Failing Tests');
    loadSample('NGINX Clean Sample');
    expect(new Set((wrapper.vm as any).compliance_series[0].data)).toEqual(
      new Set([
        fileCompliance(FilteredDataModule.selectedFileIds[0]),
        fileCompliance(FilteredDataModule.selectedFileIds[1])
      ])
    );
  });

  it('compliance chart gets correct data with 2 files with differing profiles', () => {
    removeAllFiles();
    loadSample('NGINX With Failing Tests');
    loadSample('Red Hat With Failing Tests');
    expect(new Set((wrapper.vm as any).compliance_series[0].data)).toEqual(
      new Set([
        fileCompliance(FilteredDataModule.selectedFileIds[0]),
        fileCompliance(FilteredDataModule.selectedFileIds[1])
      ])
    );
  });

  it('compliance chart gets correct data with 2 files with overlayed profiles', () => {
    removeAllFiles();
    loadSample('Triple Overlay Example');
    loadSample('Acme Overlay Example');
    expect(new Set((wrapper.vm as any).compliance_series[0].data)).toEqual(
      new Set([
        fileCompliance(FilteredDataModule.selectedFileIds[0]),
        fileCompliance(FilteredDataModule.selectedFileIds[1])
      ])
    );
  });
});
