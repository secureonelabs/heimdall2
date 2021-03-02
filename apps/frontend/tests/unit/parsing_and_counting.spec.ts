import {InspecDataModule} from '@/store/data_store';
import {InspecIntakeModule} from '@/store/report_intake';
import {ControlStatusHash, StatusCountModule} from '@/store/status_counts';
import chai from 'chai';
import chai_as_promised from 'chai-as-promised';
import {readFileSync} from 'fs';
import _ from 'lodash';
import {AllRaw} from '../util/fs';
chai.use(chai_as_promised);
const expect = chai.expect;

describe('Parsing', () => {
  it('Report intake can read every raw file in hdf_data', function () {
    const raw = AllRaw();

    const promises = Object.values(raw).map((file_result) => {
      // Do intake
      return InspecIntakeModule.loadText({
        filename: file_result.name,
        text: file_result.content
      });
    });

    // Done!
    return Promise.all(promises.map((p) => expect(p).to.eventually.be.string));
  });

  // Note that the above side effect has LOADED THESE FILES! WE CAN USE THEM IN OTHER TESTS

  it('Counts statuses correctly', function () {
    // Get the exec files
    const exec_files = InspecDataModule.executionFiles;

    // For each, we will filter then count
    exec_files.forEach((file) => {
      // Get the corresponding count file
      const countFilename = `tests/hdf_data/counts/${file.filename}.info.counts`;
      const countFileContent = readFileSync(countFilename, 'utf-8');
      const counts: any = JSON.parse(countFileContent);

      // Get the expected counts
      const expected: ControlStatusHash = {
        Failed: counts.failed.total,
        Passed: counts.passed.total,
        'From Profile': 0,
        'Profile Error': counts.error.total,
        'Not Reviewed': counts.skipped.total,
        'Not Applicable': counts.no_impact.total
      };

      const expectedWithFilename = {
        filename: file.filename,
        ...expected
      };

      // Get the actual
      const actualWithFilename = {
        filename: file.filename,
        ...StatusCountModule.hash({
          omitOverlayedControls: true,
          fromFile: [file.unique_id]
        })
      };

      const strippedActualWithFilename = _.omit(
        actualWithFilename,
        'ErroredOutOf',
        'FailedOutOf',
        'PassedTests',
        'FailedTests',
        'NotApplicableTests',
        'TotalTests',
        'ErroredTests',
        'NotReviewedTests'
      );

      // Compare 'em
      expect(strippedActualWithFilename).to.eql(expectedWithFilename);
    });
  });
});
