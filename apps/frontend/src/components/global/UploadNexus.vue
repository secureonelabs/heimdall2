<template>
  <div>
    <Modal
      :visible="visible"
      :persistent="persistent"
      @close-modal="$emit('close-modal')"
    >
      <v-banner v-if="warningBanner" icon="mdi-alert" color="warning">
        {{ warningBanner }}
      </v-banner>
      <v-tabs
        :vertical="$vuetify.breakpoint.mdAndUp"
        active
        :value="activeTab"
        color="primary-visible"
        show-arrows
        @change="selectedTab"
      >
        <v-tabs-slider />
        <!-- Define our tabs -->
        <v-tab id="select-tab-local" href="#uploadtab-local">Local Files</v-tab>

        <v-tab
          v-if="serverMode"
          id="select-tab-database"
          href="#uploadtab-database"
          >Database</v-tab
        >

        <v-tab id="select-tab-s3" href="#uploadtab-s3">S3 Bucket</v-tab>

        <v-tab id="select-tab-splunk" href="#uploadtab-splunk">Splunk</v-tab>

        <v-spacer />
        <v-divider />
        <v-tab id="select-tab-sample" href="#uploadtab-sample">Samples</v-tab>

        <!-- Include those components -->
        <v-tab-item value="uploadtab-local">
          <FileReader @got-files="gotFiles" />
        </v-tab-item>

        <v-tab-item v-if="serverMode" value="uploadtab-database">
          <DatabaseReader :refresh="visible" @got-files="gotFiles" />
        </v-tab-item>

        <v-tab-item value="uploadtab-sample">
          <SampleList @got-files="gotFiles" />
        </v-tab-item>

        <v-tab-item value="uploadtab-s3">
          <S3Reader @got-files="gotFiles" />
        </v-tab-item>

        <v-tab-item value="uploadtab-splunk">
          <SplunkReader @got-files="gotFiles" />
        </v-tab-item>
      </v-tabs>
      <HelpFooter />
    </Modal>
  </div>
</template>

<script lang="ts">
import Component, {mixins} from 'vue-class-component';
import {FileID} from '@/store/report_intake';
import Modal from '@/components/global/Modal.vue';
import FileReader from '@/components/global/upload_tabs/FileReader.vue';
import HelpFooter from '@/components/global/upload_tabs/HelpFooter.vue';
import S3Reader from '@/components/global/upload_tabs/aws/S3Reader.vue';
import SplunkReader from '@/components/global/upload_tabs/splunk/SplunkReader.vue';
import DatabaseReader from '@/components/global/upload_tabs/DatabaseReader.vue';
import SampleList from '@/components/global/upload_tabs/SampleList.vue';
import {LocalStorageVal} from '@/utilities/helper_util';
import {SnackbarModule} from '@/store/snackbar';
import ServerMixin from '@/mixins/ServerMixin';
import RouteMixin from '@/mixins/RouteMixin';
import {Prop} from 'vue-property-decorator';
import {ServerModule} from '@/store/server';
import {FilteredDataModule} from '@/store/data_filters';

const localTab = new LocalStorageVal<string>('nexus_curr_tab');

/**
 * Multiplexes all of our file upload components
 * Emits "got-files" with a list of the unique_ids of the loaded files, wherever they come from
 */
@Component({
  components: {
    Modal,
    DatabaseReader,
    FileReader,
    HelpFooter,
    S3Reader,
    SplunkReader,
    SampleList
  }
})
export default class UploadNexus extends mixins(ServerMixin, RouteMixin) {
  @Prop({default: true}) readonly visible!: boolean;
  @Prop({default: false}) readonly persistent!: boolean;

  activeTab: string = localTab.get_default('uploadtab-local');

  // Handles change in tab
  selectedTab(newTab: string) {
    this.activeTab = newTab;
    SnackbarModule.visibility(false);
    localTab.set(newTab);
  }

  get warningBanner(): string {
    return ServerModule.banner;
  }

  // Event passthrough
  gotFiles(files: FileID[]) {
    this.$emit('got-files', files);

    let numEvaluations = FilteredDataModule.selectedEvaluationIds.filter(
      (eva) => files.includes(eva)
    ).length;
    let numProfiles = FilteredDataModule.selectedProfileIds.filter((prof) =>
      files.includes(prof)
    ).length;

    if (numEvaluations > numProfiles) {
      // Only navigate the user to the results page if they are not
      // already on the compare page.
      if ('/compare' !== this.current_route)
        this.navigateUnlessActive('/results');
    } else {
      this.navigateUnlessActive('/profiles');
    }
  }
}
</script>

<style lang="scss" scoped>
.theme--dark.v-tabs {
  background: var(--v-secondary-lighten1);
}
</style>
