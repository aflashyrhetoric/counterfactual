// One-shot bootstrap: replaces the entire `canvas_state` row in Supabase
// with a single default holding-snapshot node wrapping the holdings from a
// local JSON file. The upsert overwrites the row's `state` column wholesale,
// so whatever this script builds becomes the only source of truth for the
// canvas from that point on.
//
// Usage:
//   node --env-file=.env scripts/import-canvas-state.mjs path/to/holdings.json
//
// Input file shape: an array of holdings —
//   [{ ticker: string, lots: [{ ticker, quantity, purchasePrice }] }]

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { customAlphabet } from 'nanoid';

const CANVAS_STATE_ID = 'default';
const DEFAULT_LABEL = 'Imported Holdings';
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 21);

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Run with --env-file=.env.');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node --env-file=.env scripts/import-canvas-state.mjs path/to/holdings.json');
  process.exit(1);
}

const holdings = JSON.parse(await readFile(inputPath, 'utf-8'));
if (!Array.isArray(holdings)) {
  console.error('Expected the input file to be a JSON array of holdings.');
  process.exit(1);
}

const nodeId = `node_${nanoid()}`;
const state = {
  nodes: [{ id: nodeId, type: 'holding-snapshot', position: { x: 0, y: 0 }, data: {} }],
  edges: [],
  actions: {},
  snapshots: {
    [nodeId]: {
      label: DEFAULT_LABEL,
      date: new Date().toISOString().slice(0, 10),
      settlement_fund: 0,
      holdings,
      marketOpenPrices: null,
    },
  },
};

const supabase = createClient(url, key);
const { error } = await supabase
  .from('canvas_state')
  .upsert({ id: CANVAS_STATE_ID, state, updated_at: new Date().toISOString() });

if (error) {
  console.error('Import failed:', error.message);
  process.exit(1);
}

console.log(`Imported ${holdings.length} holding(s) into a default canvas state.`);
