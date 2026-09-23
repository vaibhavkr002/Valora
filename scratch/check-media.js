const fs = require('fs');
const readline = require('readline');

async function findStep() {
  const fileStream = fs.createReadStream('C:\\Users\\saanv\\.gemini\\antigravity\\brain\\1d7be616-eeeb-4284-846d-5f390fac34be\\.system_generated\\logs\\transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.includes('"step_index":25094')) {
      const obj = JSON.parse(line);
      console.log('Step 25094 media:', obj.media);
      if (obj.media) {
        console.log('Media items:', JSON.stringify(obj.media, null, 2));
      }
      return;
    }
  }
  console.log('Not found');
}
findStep();

