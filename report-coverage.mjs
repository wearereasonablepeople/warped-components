import toIstanbul from 'v8-to-istanbul';
import {resolve} from 'path';
import {readdirSync, readFileSync, writeFileSync} from 'fs';
import {randomBytes} from 'crypto';
import report from 'c8/lib/report';

const RFILE = /^file:[/][/]/;

const files = process.argv.slice (2).map (file => resolve (file));
const v8Files = readdirSync (resolve ('coverage/v8'));

const v8s = v8Files.reduce ((v8s, file) => {
  const json = readFileSync (resolve ('coverage/v8', file), 'utf8');
  return v8s.concat (JSON.parse (json));
}, []);

files.forEach (file => {
  const id = randomBytes (4).toString ('hex');
  const relevant = v8s.filter (({url}) => url.replace (RFILE, '') === file);
  const coverage = relevant.reduce ((coverage, {functions}) => {
    return coverage.concat (functions);
  }, []);
  const script = toIstanbul (file);
  script.applyCoverage (coverage);
  const lcov = JSON.stringify (script.toIstanbul ());
  writeFileSync (resolve ('coverage/tmp', id) + '.lcov', lcov, 'utf8');
});

report ({coverageDirectory: resolve ('coverage'), reporter: ['text', 'html']});
