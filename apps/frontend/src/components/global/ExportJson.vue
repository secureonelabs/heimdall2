<template>
  <v-tooltip top>
    <template #activator="{on}">
      <LinkItem
        key="exportJson"
        text="Export as JSON"
        icon="mdi-json"
        @click="exportJson()"
        v-on="on"
      />
    </template>
    <span>JSON Download</span>
  </v-tooltip>
</template>

<script lang="ts">
import Vue from 'vue';
import Component from 'vue-class-component';
import {saveAs} from 'file-saver';
import LinkItem from '@/components/global/sidebaritems/IconLinkItem.vue';

import {isFromProfileFile} from '@/store/data_store';
import {FilteredDataModule} from '@/store/data_filters';
import {ZipFile} from 'yazl';
import concat from 'concat-stream';

type FileData = {
  name: string;
  contents: string;
};

@Component({
  components: {
    LinkItem
  }
})
export default class ExportJSON extends Vue {
  populateFiles(): FileData[] {
    let ids = FilteredDataModule.selectedFileIds;
    let fileData = new Array<FileData>();
    for (let evaluation of FilteredDataModule.evaluations(ids)) {
      fileData.push({
        name: this.cleanupFilename(evaluation.fromFile.filename),
        contents: JSON.stringify(evaluation.data)
      });
    }
    for (let prof of FilteredDataModule.profiles(ids)) {
      if (isFromProfileFile(prof)) {
        fileData.push({
          name: prof.fromFile.filename,
          contents: JSON.stringify(prof.data)
        });
      }
    }
    return fileData;
  }
  //exports .zip of jsons if multiple are selected, if one is selected it will export that .json file
  exportJson() {
    let files = this.populateFiles();
    if (files.length < 1) {
      return;
    } else if (files.length === 1) {
      //will only ever loop once
      for (let file of files) {
        let blob = new Blob([file.contents], {
          type: 'application/json'
        });
        saveAs(blob, file.name);
      }
    } else {
      let zipfile = new ZipFile();
      for (let file of files) {
        let buffer = Buffer.from(file.contents);
        zipfile.addBuffer(buffer, file.name);
      }
      // call end() after all the files have been added
      zipfile.outputStream.pipe(
        concat({encoding: 'uint8array'}, (b: Uint8Array) => {
          saveAs(new Blob([b]), 'exported_jsons.zip');
        })
      );
      zipfile.end();
    }
  }
  cleanupFilename(filename: string): string {
    filename = filename.replace(/\s+/g, '_');
    if (filename.substring(filename.length - 6) != '.json') {
      filename = filename + '.json';
    }
    return filename;
  }
}
</script>
