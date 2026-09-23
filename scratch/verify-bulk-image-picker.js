const fs = require('fs');

const html = fs.readFileSync('admin/sarojini-products.html', 'utf8');
const js = fs.readFileSync('admin/js/admin-sarojini-bulk-import.js', 'utf8');

const tests = [
  {
    name: 'Modal Add Gallery has fixed inset-0 overlay',
    passed: html.includes('id="modal-add-gallery-images" style="display: none; position: fixed; inset: 0;')
  },
  {
    name: 'Modal Lightbox has fixed inset-0 overlay',
    passed: html.includes('id="modal-image-lightbox" style="display: none; position: fixed; inset: 0;')
  },
  {
    name: 'Modal Gallery Viewer has fixed inset-0 overlay',
    passed: html.includes('id="modal-bulk-gallery-viewer" style="display: none; position: fixed; inset: 0;')
  },
  {
    name: 'Per-row hidden file input present in staging template',
    passed: js.includes('<input type="file" class="stg-file-input" data-stg-idx="${idx}" accept="image/*" multiple style="display: none;">')
  },
  {
    name: '+ Add Images button triggers native input picker',
    passed: js.includes("const fileInp = previewTbody.querySelector(`.stg-file-input[data-stg-idx=\"${idx}\"]`);") &&
            js.includes("fileInp.click();")
  },
  {
    name: '+ URL button triggers URL modal',
    passed: js.includes("btn-open-url-modal") && js.includes("switchAddGalleryTab('urls')")
  },
  {
    name: 'File selection reads multiple files via FileReader',
    passed: js.includes("reader.readAsDataURL(file)") && js.includes("Array.from(e.target.files || [])")
  },
  {
    name: 'Watermark supplier code detection applied to new images',
    passed: js.includes("window.SarojiniWatermark.detectSupplierCode(dataUrl)")
  },
  {
    name: 'syncStagingRowInputs function implemented and called before re-render',
    passed: js.includes("function syncStagingRowInputs()") &&
            js.includes("syncStagingRowInputs();")
  },
  {
    name: 'Batch import calls syncStagingRowInputs before filtering',
    passed: js.includes("async function executeBatchImport() {\n    syncStagingRowInputs();")
  }
];

let allPassed = true;
tests.forEach((t, i) => {
  if (t.passed) {
    console.log(`PASS [${i + 1}/${tests.length}]: ${t.name}`);
  } else {
    console.error(`FAIL [${i + 1}/${tests.length}]: ${t.name}`);
    allPassed = false;
  }
});

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY! ---');
}

