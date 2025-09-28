import axios from 'axios';
import Table from 'cli-table3';

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

async function sendRequest(requestId: number): Promise<{ id: number, startTime: string, endTime: string, duration: number } | null> {
  const start = Date.now();
  const startTime = parseDate(start);
  console.log(`Request ${requestId} started at ${startTime}`);
  try {
    await axios.get('http://localhost:3000/');
    const end = Date.now();
    const endTime = parseDate(end);
    const duration = end - start;
    console.log(`Request ${requestId} ended at ${endTime}, took ${duration} ms`);
    return { id: requestId, startTime, endTime, duration };
  } catch (error) {
    console.error(`Request ${requestId} failed: ${error}`);
    return null;
  }
}

async function main() {
  const { concurrency, requests } = parseArgs();
  const totalStart = Date.now();
  const results: { id: number, startTime: string, endTime: string, duration: number }[] = [];

  for (let batchStart = 1; batchStart <= requests; batchStart += concurrency) {
    const batchEnd = Math.min(batchStart + concurrency - 1, requests);
    const promises: Promise<{ id: number, startTime: string, endTime: string, duration: number } | null>[] = [];

    for (let i = batchStart; i <= batchEnd; i++) {
      promises.push(sendRequest(i));
    }

    const batchResults = await Promise.all(promises);
    for (const result of batchResults) {
      if (result) results.push(result);
    }
  }

  const table = new Table({
    head: ['Request', 'Start Time', 'End Time', 'Duration (ms)']
  });

  for (const result of results) {
    table.push([result.id, result.startTime, result.endTime, result.duration]);
  }

  console.log(table.toString());

  const totalEnd = Date.now();
  const totalDuration = totalEnd - totalStart;
  console.log(`Total time: ${totalDuration} ms`);
}

main();