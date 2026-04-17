// Force Reprocess All Documents Script
// Run this in browser console when logged into admin panel

async function forceReprocessAll() {
  console.log('Starting force reprocess of all Google Drive documents...');
  
  try {
    const response = await fetch('/api/admin/backfill-full-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 40,
        force: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Processing results:', data);
    
    const { results } = data;
    const updated = results.filter(r => r.status === 'updated').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    
    if (errors > 0) {
      console.log('Errors:', results.filter(r => r.status === 'error'));
    }
    
    // If we processed documents, run again to get more
    if (updated > 0) {
      console.log('Documents were processed. Run the script again to process more documents.');
    } else {
      console.log('No more documents to process. All documents have been processed!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Auto-run the function
forceReprocessAll();

// Also make it available to run manually
window.forceReprocessAll = forceReprocessAll;
console.log('You can also run: forceReprocessAll()');
