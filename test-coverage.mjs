import {Session} from 'inspector';
import {resolve, isAbsolute} from 'path';
import {writeFileSync} from 'fs';
import {randomBytes} from 'crypto';
import onExit from 'signal-exit';

const id = randomBytes (4).toString ('hex');
const session = new Session ();

session.connect ();
session.post ('Profiler.enable');
session.post ('Runtime.enable');
session.post (
  'Profiler.startPreciseCoverage',
  {callCount: true, detailed: true}
);

onExit (reportCoverage, {alwaysLast: true});

function reportCoverage() {
  session.post ('Profiler.takePreciseCoverage', processV8Coverage);
}

function processV8Coverage(err, res) {
  try {
    if (err) { throw err; }
    const outfile = resolve ('coverage/v8', id) + '.json';
    const filteredResult = res.result.filter (({url}) => (
      [url.replace ('file://', '')]
      .every (url => isAbsolute (url) && !url.includes ('/node_modules/'))
    ));
    writeFileSync (outfile, JSON.stringify (filteredResult), 'utf8');
  } catch (e) {
    console.warn ('Failed to collect code coverage: ', e.message || e);
  }
}
