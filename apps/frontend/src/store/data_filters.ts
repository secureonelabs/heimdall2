/**
 * This module provides a cached, reusable method for filtering data from data_store.
 */

import {Trinary} from '@/enums/Trinary';
import {InspecDataModule, isFromProfileFile} from '@/store/data_store';
import {FileID, SourcedContextualizedEvaluation} from '@/store/report_intake';
import Store from '@/store/store';
import {context, ControlStatus, nist, Severity} from 'inspecjs';
import LRUCache from 'lru-cache';
import {
  Action,
  getModule,
  Module,
  Mutation,
  VuexModule
} from 'vuex-module-decorators';

const MAX_CACHE_ENTRIES = 20;

/** Contains common filters on data from the store. */
export interface Filter {
  // General
  /** Which file these objects came from. Undefined => any */
  fromFile: FileID[];

  // Control specific
  /** What status the controls can have. Undefined => any */
  status?: ControlStatus;

  /** What severity the controls can have. Undefined => any */
  severity?: Severity;

  /** Whether or not to allow/include overlayed controls */
  omitOverlayedControls?: boolean;

  /** A search term string, case insensitive
   * We look for this in
   * - control ID
   * - rule title
   * - severity
   * - status
   * - finding details (from HDF)
   * - code
   */
  searchTerm?: string;

  /** The current state of the Nist Treemap. Used to further filter by nist categories etc. */
  treeFilters?: TreeMapState;

  /** A specific control id */
  controlId?: string;
}

export type TreeMapState = string[]; // Representing the current path spec, from root

/**
 * Facillitates the search functionality
 * @param term The string to search with
 * @param context_control The control to search for term in
 */
function contains_term(
  context_control: context.ContextualizedControl,
  term: string
): boolean {
  const as_hdf = context_control.root.hdf;
  // Get our (non-null) searchable data
  const searchables: string[] = [
    as_hdf.wraps.id,
    as_hdf.wraps.title,
    as_hdf.wraps.code,
    as_hdf.severity,
    as_hdf.status,
    as_hdf.finding_details
  ].filter((s) => s !== null) as string[];

  // See if any contain term
  return searchables.some((s) => s.toLowerCase().includes(term));
}

@Module({
  namespaced: true,
  dynamic: true,
  store: Store,
  name: 'filteredData'
})
export class FilteredData extends VuexModule {
  selectedEvaluationIds: FileID[] = [];
  selectedProfileIds: FileID[] = [];

  @Mutation
  SELECT_EVALUATIONS(files: FileID[]): void {
    this.selectedEvaluationIds = [
      ...new Set([...files, ...this.selectedEvaluationIds])
    ];
  }

  @Mutation
  SELECT_PROFILES(files: FileID[]): void {
    this.selectedProfileIds = [
      ...new Set([...files, ...this.selectedProfileIds])
    ];
  }

  @Mutation
  CLEAR_EVALUATION(removeId: FileID): void {
    this.selectedEvaluationIds = this.selectedEvaluationIds.filter(
      (ids) => ids !== removeId
    );
  }

  @Mutation
  CLEAR_PROFILE(removeId: FileID): void {
    this.selectedProfileIds = this.selectedProfileIds.filter(
      (ids) => ids !== removeId
    );
  }

  @Mutation
  CLEAR_ALL_EVALUATIONS(): void {
    this.selectedEvaluationIds = [];
  }

  @Mutation
  CLEAR_ALL_PROFILES(): void {
    this.selectedProfileIds = [];
  }

  @Action
  public toggleAllEvaluations(): void {
    if (this.allEvaluationsSelected === Trinary.On) {
      this.CLEAR_ALL_EVALUATIONS();
    } else {
      this.SELECT_EVALUATIONS(
        InspecDataModule.allEvaluationFiles.map((v) => v.unique_id)
      );
    }
  }

  @Action
  public toggleAllProfiles(): void {
    if (this.allProfilesSelected === Trinary.On) {
      this.CLEAR_ALL_PROFILES();
    } else {
      this.SELECT_PROFILES(
        InspecDataModule.allProfileFiles.map((v) => v.unique_id)
      );
    }
  }

  @Action
  public select_exclusive_evaluation(fileID: FileID): void {
    this.CLEAR_ALL_EVALUATIONS();
    this.SELECT_EVALUATIONS([fileID]);
  }

  @Action
  public select_exclusive_profile(fileID: FileID): void {
    this.CLEAR_ALL_PROFILES();
    this.SELECT_PROFILES([fileID]);
  }

  @Action
  public toggle_evaluation(fileID: FileID): void {
    if (this.selectedEvaluationIds.includes(fileID)) {
      this.CLEAR_EVALUATION(fileID);
    } else {
      this.SELECT_EVALUATIONS([fileID]);
    }
  }

  @Action
  public toggleProfile(fileID: FileID): void {
    if (this.selectedProfileIds.includes(fileID)) {
      this.CLEAR_PROFILE(fileID);
    } else {
      this.SELECT_PROFILES([fileID]);
    }
  }

  @Action
  public clear_file(fileID: FileID): void {
    this.CLEAR_EVALUATION(fileID);
    this.CLEAR_PROFILE(fileID);
  }

  /**
   * Parameterized getter.
   * Get all evaluations from the specified file ids
   */
  get evaluations(): (
    files: FileID[]
  ) => readonly SourcedContextualizedEvaluation[] {
    return (files: FileID[]) => {
      return InspecDataModule.contextualExecutions.filter((e) =>
        files.includes(e.fromFile.unique_id)
      );
    };
  }

  /**
   * Parameterized getter.
   * Get all profiles from the specified file ids.
   * Filters only based on the file ID
   */
  get profiles(): (
    files: FileID[]
  ) => readonly context.ContextualizedProfile[] {
    return (files: FileID[]) => {
      // Initialize our list to add valid profiles to
      const profiles: context.ContextualizedProfile[] = [];

      // Filter to those that match our filter. In this case that just means come from the right file id
      InspecDataModule.contextualProfiles.forEach((prof) => {
        if (isFromProfileFile(prof)) {
          if (files.includes(prof.fromFile.unique_id)) {
            profiles.push(prof);
          }
        } else {
          // Its a report; go two levels up to get its file
          const ev = prof.sourced_from as SourcedContextualizedEvaluation;
          if (files.includes(ev.fromFile.unique_id)) {
            profiles.push(prof);
          }
        }
      });

      return profiles;
    };
  }

  /* get the currently select evaluations */
  get selectedEvaluations(): string[] {
    const fileIds = [...this.selectedEvaluationIds];
    const files = InspecDataModule.allProfileFiles;

    return fileIds.filter((fileId) =>
      files.every((file) => fileId !== file.unique_id)
    );
  }

  /* get the currently selected profiles */
  get selectedProfiles(): string[] {
    const fileIds = [...this.selectedProfileIds];
    const files = InspecDataModule.allEvaluationFiles;

    return fileIds.filter((fileId) =>
      files.every((file) => fileId !== file.unique_id)
    );
  }

  get selectedFileIds(): FileID[] {
    return [...this.selectedEvaluationIds, ...this.selectedProfileIds];
  }

  // check to see if all profiles are selected
  get allProfilesSelected(): Trinary {
    switch (this.selectedProfiles.length) {
      case 0:
        return Trinary.Off;
      case InspecDataModule.allProfileFiles.length:
        return Trinary.On;
      default:
        return Trinary.Mixed;
    }
  }

  // check to see if all evaluations are selected
  get allEvaluationsSelected(): Trinary {
    switch (this.selectedEvaluations.length) {
      case 0:
        return Trinary.Off;
      case InspecDataModule.allEvaluationFiles.length:
        return Trinary.On;
      default:
        return Trinary.Mixed;
    }
  }

  /**
   * Parameterized getter.
   * Get all controls from all profiles from the specified file id.
   * Utlizes the profiles getter to accelerate the file filter.
   */
  get controls(): (filter: Filter) => readonly context.ContextualizedControl[] {
    /** Cache by filter */
    const localCache: LRUCache<
      string,
      readonly context.ContextualizedControl[]
    > = new LRUCache(MAX_CACHE_ENTRIES);

    return (filter: Filter) => {
      // Generate a hash for cache purposes.
      // If the "searchTerm" string is not null, we don't cache - no need to pollute
      const id: string = filterCacheKey(filter);

      // Check if we have this cached:
      const cached = localCache.get(id);
      if (cached !== undefined) {
        return cached;
      }

      // First get all of the profiles using the same filter
      let controls: readonly context.ContextualizedControl[];
      // Get profiles
      const profiles: readonly context.ContextualizedProfile[] = this.profiles(
        filter.fromFile
      );
      // And all the controls they contain
      controls = profiles.flatMap((profile) => profile.contains);

      // Filter by control id
      if (filter.controlId !== undefined) {
        controls = controls.filter((c) => c.data.id === filter.controlId);
      }

      // Filter by status, if necessary
      if (filter.status !== undefined) {
        controls = controls.filter(
          (control) => control.root.hdf.status === filter.status
        );
      }

      // Filter by severity, if necessary
      if (filter.severity !== undefined) {
        controls = controls.filter(
          (control) => control.root.hdf.severity === filter.severity
        );
      }

      // Filter by overlay
      if (filter.omitOverlayedControls) {
        controls = controls.filter(
          (control) => control.extended_by.length === 0
        );
      }

      // Filter by search term
      if (filter.searchTerm !== undefined) {
        const term = filter.searchTerm.toLowerCase();

        // Filter controls to those that contain search term
        controls = controls.filter((c) => contains_term(c, term));
      }

      // Filter by nist stuff
      if (filter.treeFilters && filter.treeFilters.length > 0) {
        // Construct a nist control to represent the filter
        const control = new nist.NistControl(filter.treeFilters);

        controls = controls.filter((c) => {
          // Get an hdf version so we have the fixed nist tags
          return c.root.hdf.parsed_nist_tags.some((t) => control.contains(t));
        });
      }

      // Freeze and save to cache
      const r = Object.freeze(controls);
      localCache.set(id, r);
      return r;
    };
  }
}

export const FilteredDataModule = getModule(FilteredData);

/**
 * Generates a unique string to represent a filter.
 * Does some minor "acceleration" techniques such as
 * - annihilating empty search terms
 * - defaulting "omitOverlayedControls"
 */
export function filterCacheKey(f: Filter) {
  // fix the search term
  let newSearch: string;
  if (f.searchTerm !== undefined) {
    newSearch = f.searchTerm.trim();
  } else {
    newSearch = '';
  }

  const newFilter: Filter = {
    searchTerm: newSearch,
    omitOverlayedControls: f.omitOverlayedControls || false,
    ...f
  };
  return JSON.stringify(newFilter);
}
