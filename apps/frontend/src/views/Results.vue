<template>
  <BaseView :title="currTitle">
    <!-- Topbar content - give it a search bar -->
    <template #topbar-content>
      <v-text-field
        v-show="showSearchMobile || !$vuetify.breakpoint.xs"
        ref="search"
        v-model="searchTerm"
        flat
        hide-details
        solo
        prepend-inner-icon="mdi-magnify"
        label="Search"
        clearable
        :class="$vuetify.breakpoint.xs ? 'overtake-bar mx-2' : 'mx-2'"
        @click:clear="clearSearch()"
        @blur="showSearchMobile = false"
      />
      <v-btn v-if="$vuetify.breakpoint.xs" class="mr-2" @click="showSearch">
        <v-icon>mdi-magnify</v-icon>
      </v-btn>
      <v-btn :disabled="!canClear" @click="clear">
        <span class="d-none d-md-inline pr-2"> Clear </span>
        <v-icon>mdi-filter-remove</v-icon>
      </v-btn>
      <UploadButton />
      <div class="text-center">
        <v-menu>
          <template #activator="{on, attrs}">
            <v-btn v-bind="attrs" class="mr-2" v-on="on">
              <span class="d-none d-md-inline mr-2"> Export </span>
              <v-icon> mdi-file-export </v-icon>
            </v-btn>
          </template>
          <v-list class="py-0">
            <v-list-item class="px-0">
              <ExportCaat :filter="allFilter" />
            </v-list-item>
            <v-list-item class="px-0">
              <ExportNist :filter="allFilter" />
            </v-list-item>
            <v-list-item class="px-0">
              <ExportJson />
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </template>

    <!-- The main content: cards, etc -->
    <template #main-content>
      <v-container fluid grid-list-md pa-2>
        <!-- Evaluation Info -->
        <v-row>
          <v-col v-if="filteFilter.length > 3">
            <v-slide-group v-model="evalInfo" show-arrows>
              <v-slide-item
                v-for="(file, i) in filteFilter"
                :key="i"
                v-slot="{toggle}"
                class="mx-2"
              >
                <v-card
                  :width="infoWidth"
                  data-cy="profileInfo"
                  @click="toggle"
                >
                  <EvaluationInfo :filte-filter="file" />
                  <v-card-subtitle style="text-align: right">
                    Profile Info ↓
                  </v-card-subtitle>
                </v-card>
              </v-slide-item>
            </v-slide-group>
            <ProfileData
              v-if="evalInfo != null"
              class="my-4 mx-10"
              :selected_prof="
                rootProfiles[profIds.indexOf(filteFilter[evalInfo])]
              "
            />
          </v-col>
          <v-col
            v-for="(file, i) in filteFilter"
            v-else
            :key="i"
            :cols="12 / filteFilter.length"
          >
            <v-card data-cy="profileInfo" @click="toggleProf(i)">
              <EvaluationInfo :filte-filter="file" />
              <v-card-subtitle style="text-align: right">
                Profile Info ↓
              </v-card-subtitle>
            </v-card>
          </v-col>
          <ProfileData
            v-if="evalInfo != null && filteFilter.length <= 3"
            class="my-4 mx-10"
            :selected_prof="
              rootProfiles[profIds.indexOf(filteFilter[evalInfo])]
            "
          />
        </v-row>
        <!-- Count Cards -->
        <StatusCardRow
          :filter="allFilter"
          @show-errors="statusFilter = 'Profile Error'"
        />
        <!-- Compliance Cards -->
        <v-row justify="space-around">
          <v-col xs="4">
            <v-card class="fill-height">
              <v-card-title class="justify-center">Status Counts</v-card-title>
              <v-card-actions class="justify-center">
                <StatusChart v-model="statusFilter" :filter="allFilter" />
              </v-card-actions>
            </v-card>
          </v-col>
          <v-col xs="4">
            <v-card class="fill-height">
              <v-card-title class="justify-center"
                >Severity Counts</v-card-title
              >
              <v-card-actions class="justify-center">
                <SeverityChart v-model="severityFilter" :filter="allFilter" />
              </v-card-actions>
            </v-card>
          </v-col>
          <v-col xs="4">
            <v-card class="fill-height">
              <v-card-title class="justify-center"
                >Compliance Level</v-card-title
              >
              <v-card-actions class="justify-center">
                <ComplianceChart :filter="allFilter" />
              </v-card-actions>
              <v-card-text style="text-align: center"
                >[Passed/(Passed + Failed + Not Reviewed + Profile Error) *
                100]</v-card-text
              >
            </v-card>
          </v-col>
        </v-row>

        <!-- TreeMap and Partition Map -->
        <v-row>
          <v-col xs-12>
            <v-card elevation="2">
              <v-card-title>TreeMap</v-card-title>
              <v-card-text>
                <Treemap
                  v-model="treeFilters"
                  :filter="treeMapFullFilter"
                  :selected_control.sync="controlSelection"
                />
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- DataTable -->
        <v-row>
          <v-col xs-12>
            <v-card elevation="2">
              <ControlTable
                ref="controlTable"
                :filter="allFilter"
                :show-impact="isResultView"
              />
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </template>

    <!-- Everything-is-filtered snackbar -->
    <v-snackbar
      v-model="filterSnackbar"
      class="mt-11"
      style="z-index: 2"
      :timeout="-1"
      color="warning"
      top
    >
      <span v-if="filteFilter.length" class="subtitle-2">
        All results are filtered out. Use the
        <v-icon>mdi-filter-remove</v-icon> button in the top right to clear
        filters and show all.
      </span>
      <span v-else-if="noFiles" class="subtitle-2">
        No files are currently loaded. Press the <strong>LOAD</strong>
        <v-icon class="mx-1"> mdi-cloud-upload</v-icon> button above to load
        some.
      </span>
      <span v-else class="subtitle-2">
        No files are currently enabled for viewing. Open the
        <v-icon class="mx-1">mdi-menu</v-icon> sidebar menu, and ensure that the
        file(s) you wish to view are
        <v-icon class="mx-1">mdi-checkbox-marked</v-icon> checked.
      </span>
    </v-snackbar>
  </BaseView>
</template>

<script lang="ts">
import Vue from 'vue';
import Component from 'vue-class-component';
import BaseView from '@/views/BaseView.vue';

import StatusCardRow from '@/components/cards/StatusCardRow.vue';
import ControlTable from '@/components/cards/controltable/ControlTable.vue';
import Treemap from '@/components/cards/treemap/Treemap.vue';
import StatusChart from '@/components/cards/StatusChart.vue';
import SeverityChart from '@/components/cards/SeverityChart.vue';
import ComplianceChart from '@/components/cards/ComplianceChart.vue';
import UploadButton from '@/components/generic/UploadButton.vue';

import ExportCaat from '@/components/global/ExportCaat.vue';
import ExportNist from '@/components/global/ExportNist.vue';
import ExportJson from '@/components/global/ExportJson.vue';
import EvaluationInfo from '@/components/cards/EvaluationInfo.vue';

import {FilteredDataModule, Filter, TreeMapState} from '@/store/data_filters';
import {ControlStatus, Severity} from 'inspecjs';
import {FileID, SourcedContextualizedEvaluation} from '@/store/report_intake';
import {InspecDataModule, isFromProfileFile} from '@/store/data_store';

import ProfileData from '@/components/cards/ProfileData.vue';
import {context} from 'inspecjs';

import {ServerModule} from '@/store/server';
import {capitalize} from 'lodash';

@Component({
  components: {
    BaseView,
    StatusCardRow,
    Treemap,
    ControlTable,
    StatusChart,
    SeverityChart,
    ComplianceChart,
    ExportCaat,
    ExportNist,
    ExportJson,
    EvaluationInfo,
    ProfileData,
    UploadButton
  }
})
export default class Results extends Vue {
  $refs!: Vue['$refs'] & {
    search: HTMLInputElement;
  };
  /**
   * The currently selected severity, as modeled by the severity chart
   */
  severityFilter: Severity | null = null;

  /**
   * The currently selected status, as modeled by the status chart
   */
  statusFilter: ControlStatus | null = null;

  /**
   * The current state of the treemap as modeled by the treemap.
   * Once can reliably expect that if a "deep" selection is not null, then its parent should also be not-null.
   */
  treeFilters: TreeMapState = [];
  controlSelection: string | null = null;

  /**
   * The current search term, as modeled by the search bar
   * Never empty - should in that case be null
   */
  searchTerm = '';

  /** Model for if all-filtered snackbar should be showing */
  filterSnackbar = false;

  evalInfo: number | null = null;

  /** Determines if we should make the search bar colapseable */
  showSearchMobile: boolean = false;

  /**
   * The currently selected file, if one exists.
   * Controlled by router.
   */
  get filteFilter(): FileID[] {
    if (this.isResultView)
      return FilteredDataModule.selectedEvaluations;
    else return FilteredDataModule.selectedProfiles;
  }

  /**
   * Returns true if we're showing results
   */

  get isResultView(): boolean {
    return this.currentRouteName === 'results';
  }

  // Returns true if no files are uploaded
  get noFiles(): boolean {
    return InspecDataModule.allFiles.length === 0;
  }

  /**
   * Handles focusing on the search bar
   */
  showSearch(): void {
    this.showSearchMobile = true;
    this.$nextTick(() => {
      this.$refs.search.focus();
    });
  }

  /**
   * The filter for charts. Contains all of our filter stuff
   */
  get allFilter(): Filter {
    return {
      status: this.statusFilter || undefined,
      severity: this.severityFilter || undefined,
      fromFile: this.filteFilter,
      treeFilters: this.treeFilters,
      searchTerm: this.searchTerm || '',
      omitOverlayedControls: true,
      controlId: this.controlSelection || undefined
    };
  }

  /**
   * The filter for treemap. Omits its own stuff
   */
  get treeMapFullFilter(): Filter {
    return {
      status: this.statusFilter || undefined,
      severity: this.severityFilter || undefined,
      fromFile: this.filteFilter,
      searchTerm: this.searchTerm || '',
      omitOverlayedControls: true
    };
  }

  /**
   * Clear all filters
   */
  clear() {
    this.filterSnackbar = false;
    this.severityFilter = null;
    this.statusFilter = null;
    this.controlSelection = null;
    this.searchTerm = '';
    this.treeFilters = [];
  }

  clearSearch() {
    this.searchTerm = '';
  }

  /**
   * Returns true if we can currently clear.
   * Essentially, just controls whether the button is available
   */
  get canClear(): boolean {
    // Return if any params not null/empty
    let result: boolean;
    if (
      this.severityFilter ||
      this.statusFilter ||
      this.searchTerm !== '' ||
      this.treeFilters.length
    ) {
      result = true;
    } else {
      result = false;
    }

    // Logic to check: are any files actually visible?
    if (FilteredDataModule.controls(this.allFilter).length === 0) {
      this.filterSnackbar = true;
    } else {
      this.filterSnackbar = false;
    }

    // Finally, return our result
    return result;
  }

  /**
   * The title to override with
   */
  get currTitle(): string {
    let returnText = `${capitalize(this.currentRouteName.slice(0, -1))} View`;
    if (this.filteFilter.length == 1) {
      let file = InspecDataModule.allFiles.find(
        (f) => f.unique_id === this.filteFilter[0]
      );
      if (file) {
        returnText += ` (${file.filename} selected)`;
      }
    } else {
      returnText += ` (${this.filteFilter.length} ${this.currentRouteName} selected)`;
    }
    return returnText;
  }

  get currentRouteName(): string {
    return this.$router.currentRoute.path.substring(1);
  }

  //changes width of eval info if it is in server mode and needs more room for tags
  get infoWidth(): number {
    if (ServerModule.serverMode) {
      return 500;
    }
    return 300;
  }

  /** Flat representation of all profiles that ought to be visible  */
  get visibleProfiles(): Readonly<context.ContextualizedProfile[]> {
    return FilteredDataModule.profiles(this.allFilter.fromFile);
  }

  get rootProfiles(): context.ContextualizedProfile[] {
    // Strip to roots
    let profiles = this.visibleProfiles.filter(
      (p) => p.extended_by.length === 0
    );
    return profiles;
  }

  //gets profile ids for the profData component to display corresponding info
  get profIds(): FileID[] {
    let ids = [];
    for (let prof of this.rootProfiles) {
      if (!isFromProfileFile(prof)) {
        ids.push(
          (prof.sourced_from as SourcedContextualizedEvaluation).fromFile
            .unique_id
        );
      } else {
        ids.push(prof.fromFile.unique_id);
      }
    }
    return ids;
  }

  //basically a v-model for the eval info cards when there is no slide group
  toggleProf(index: number) {
    if (index == this.evalInfo) {
      this.evalInfo = null;
    } else {
      this.evalInfo = index;
    }
  }
}
</script>

<style scoped>
.glow {
  box-shadow: 0px 0px 8px 6px #5a5;
}
.overtake-bar {
  width: 96%;
  position: absolute;
  left: 0px;
  top: 4px;
  z-index: 5;
}
</style>
