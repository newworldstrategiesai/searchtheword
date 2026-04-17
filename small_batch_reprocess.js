// Small Batch Reprocess Script - Avoids Timeouts
// Run this in browser console when logged into admin panel

async function smallBatchReprocess() {
  console.log('Starting small batch reprocess (10 documents at a time)...');
  
  try {
    const response = await fetch('/api/admin/backfill-full-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 10,  // Smaller batch to avoid timeouts
        force: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Batch processing results:', data);
    
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
    
    // If we processed documents, suggest running again
    if (updated > 0) {
      console.log('✅ Documents were processed. Run script again to process more documents.');
      console.log('📊 Progress: Keep running until you see "No more documents to process!"');
    } else {
      console.log('🎉 No more documents to process in this batch. All documents have been processed!');
    }
    
  } catch (error) {
    console.error('Error:', error);
    if (error.message.includes('504')) {
      console.log('⏰ Timeout occurred. Try running again with smaller batches or check server load.');
    }
  }
}

// Auto-run function
smallBatchReprocess();

// Make it available to run manually
window.smallBatchReprocess = smallBatchReprocess;
console.log('You can also run: smallBatchReprocess()');
console.log('This processes 10 documents at a time to avoid timeouts.');
