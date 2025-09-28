import axios from 'axios';

function parseArgs() {
  const args = process.argv.slice(2);
  let concurrency = 1;
  let requests = 1;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--requests' && args[i + 1]) {
      requests = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { concurrency, requests };
}

function parseDate(d: number) {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
}

async function sendRequest(requestId: number): Promise<void> {
  const start = Date.now();
  console.log(`Request ${requestId} started at ${parseDate(start)}`);
  try {
    await axios.get('http://localhost:3000/');
    const end = Date.now();
    const duration = end - start;
    console.log(`Request ${requestId} ended at ${parseDate(end)}, took ${duration} ms`);
  } catch (error) {
    console.error(`Request ${requestId} failed: ${error}`);
  }
}

async function main() {
  const { concurrency, requests } = parseArgs();
  const totalStart = Date.now();

  for (let batchStart = 1; batchStart <= requests; batchStart += concurrency) {
    const batchEnd = Math.min(batchStart + concurrency - 1, requests);
    const promises: Promise<void>[] = [];

    for (let i = batchStart; i <= batchEnd; i++) {
      promises.push(sendRequest(i));
    }

    await Promise.all(promises);
  }

  const totalEnd = Date.now();
  const totalDuration = totalEnd - totalStart;
  console.log(`Total time: ${totalDuration} ms`);
}

main();