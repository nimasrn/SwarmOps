import { writeFileSync } from 'node:fs'
import { artboard } from './lib.mjs'
import { Home, Machines, MachineDetail, ContainerDetail } from './screens-fleet.mjs'
import { Apps, AppDetail, Deploy, DeployRelease, Platform } from './screens-deliver.mjs'
import { Gateway, Routes, Runs } from './screens-ops.mjs'
import { Core, Agents, FirstRun } from './screens-control.mjs'
import { Map as IAMap, Model } from './screens-map.mjs'

const ARTBOARDS = [
  ['Main', IAMap, 1520, 1240, 'page-1'],
  ['Model', Model, 1440, 1100, 'page-1'],
  ['FirstRun', FirstRun, 1440, 980, 'page-1'],

  ['Home', Home, 1440, 1120, 'page-2'],
  ['Machines', Machines, 1440, 1040, 'page-2'],
  ['MachineDetail', MachineDetail, 1440, 1100, 'page-2'],

  ['ContainerDetail', ContainerDetail, 1440, 1080, 'page-2'],
  ['Apps', Apps, 1440, 900, 'page-2'],
  ['AppDetail', AppDetail, 1440, 1150, 'page-2'],

  ['Deploy', Deploy, 1440, 1140, 'page-2'],
  ['DeployRelease', DeployRelease, 1440, 1060, 'page-2'],
  ['Platform', Platform, 1440, 1090, 'page-2'],

  ['Gateway', Gateway, 1440, 1160, 'page-2'],
  ['Routes', Routes, 1440, 1000, 'page-2'],
  ['Runs', Runs, 1440, 1320, 'page-2'],

  ['Core', Core, 1440, 1260, 'page-2'],
  ['Agents', Agents, 1440, 1000, 'page-2'],
]

/* Page 1 is the argument; page 2 is the console. They are separable sets and
   reading one does not require scrolling past the other. */
const POSITIONS = {
  Main: [0, 0], Model: [1640, 0], FirstRun: [3200, 0],
}

const COLS = [0, 1560, 3120]
const page2 = ARTBOARDS.filter(([, , , , p]) => p === 'page-2')
let y = 0
for (let i = 0; i < page2.length; i += 3) {
  const row = page2.slice(i, i + 3)
  row.forEach(([name], j) => { POSITIONS[name] = [COLS[j], y] })
  y += Math.max(...row.map(([, , , h]) => h)) + 140
}

for (const [name, html] of ARTBOARDS) {
  writeFileSync(`${name}.dc.html`, artboard(html))
}

const canvas = {
  pages: [
    { id: 'page-1', name: 'The shape' },
    { id: 'page-2', name: 'The screens' },
  ],
  artboards: ARTBOARDS.map(([name, , w, h, page]) => ({
    file: `${name}.dc.html`, x: POSITIONS[name][0], y: POSITIONS[name][1], w, h, page,
  })),
  annotations: [
    {
      id: 'note-shape', x: 0, y: -130, w: 900, page: 'page-1',
      text: 'Start here. The map is the argument for six areas instead of eight; the model is what actually talks to what; first run is the whole install.',
    },
    {
      id: 'note-screens', x: 0, y: -130, w: 900, page: 'page-2',
      text: 'Fourteen screens at 1440 wide, drawn in the real console vocabulary — nim-ui console style, malachite colourway, measured off the running app.',
    },
    {
      id: 'note-metrics', x: 3120, y: -80, w: 420, page: 'page-2',
      text: 'A machine, a container, an application and the gateway each carry their own charts. That is what replaces the Observe area.',
    },
  ],
  launch: { view: 'canvas', page: 'page-1' },
}

writeFileSync('canvas.json', `${JSON.stringify(canvas, null, 2)}\n`)
console.log(`wrote ${ARTBOARDS.length} artboards + canvas.json`)
