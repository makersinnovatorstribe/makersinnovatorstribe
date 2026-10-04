/* Saved woodland paths, in historical order. No live scene is changed here.
   Full backgrounds are deliberately labelled: their paths are baked into the
   illustration and cannot move independently. Standalone paths retain alpha.
   Exact extraction/provenance: assets/images/forest-editor-history/manifest.json.
   Load before the forest editor. The defaults are no path and no creek. */
(() => {
  'use strict';

  const history = 'assets/images/forest-editor-history/';
  const options = [
    {
      id: 'none', category: 'path', kind: 'none', label: 'No path',
      description: 'Keep the woodland floor clear.', width: 0, height: 0
    },
    {
      id: 'forest-blue-tall', category: 'path', kind: 'image',
      label: 'Original blue forest · tall',
      description: 'The original cream trail, with the blue forest and bear workshops baked in.',
      src: 'assets/images/mascots/maker-grove-mobile.webp', width: 724, height: 2172,
      includesGround: true, includesScenery: true
    },
    {
      id: 'forest-blue-wide', category: 'path', kind: 'image',
      label: 'Original blue forest · wide',
      description: 'The landscape version of the first blue woodland, including its broad curved trail.',
      src: 'assets/images/mascots/maker-grove.webp', width: 1536, height: 1024,
      includesGround: true, includesScenery: true
    },
    {
      id: 'forest-painted-tall', category: 'path', kind: 'image',
      label: 'Painted green forest · tall',
      description: 'The shaded green forest version. Trees, bear workshops and the pale trail are one image.',
      src: 'assets/images/mascots/maker-grove-mobile-natural.webp', width: 724, height: 2171,
      includesGround: true, includesScenery: true
    },
    {
      id: 'forest-painted-wide', category: 'path', kind: 'image',
      label: 'Painted green forest · wide',
      description: 'The landscape green woodland version, including the complete setting and trail.',
      src: 'assets/images/mascots/maker-grove-natural.webp', width: 1536, height: 1024,
      includesGround: true, includesScenery: true
    },
    {
      id: 'forest-cutout-tall', category: 'path', kind: 'image',
      label: 'Bear workshops & trail · tall',
      description: 'The earlier transparent forest cutout. The pale trail is joined to the trees and bear workshops.',
      src: 'assets/images/exco-world/forest-mid-mobile.webp', width: 724, height: 2172,
      includesScenery: true
    },
    {
      id: 'forest-cutout-wide', category: 'path', kind: 'image',
      label: 'Bear workshops & trail · wide',
      description: 'The landscape transparent cutout, with the original winding route and bear workshops.',
      src: 'assets/images/exco-world/forest-mid.webp', width: 1536, height: 1024,
      includesScenery: true
    },
    {
      id: 'paper-trail-treehouse', category: 'path', kind: 'image',
      label: 'Earlier paper trail · treehouse',
      description: 'The original first clearing trail: warm paper, a narrow soil edge and a few small stones.',
      src: history + 'path-01.svg', width: 400, height: 800
    },
    {
      id: 'paper-trail-camp', category: 'path', kind: 'image',
      label: 'Earlier paper trail · camp',
      description: 'The original middle clearing trail, faithfully recovered from the saved renderer.',
      src: history + 'path-02.svg', width: 400, height: 800
    },
    {
      id: 'paper-trail-lookout', category: 'path', kind: 'image',
      label: 'Earlier paper trail · lookout',
      description: 'The original lower clearing trail, with its leftward opening bend.',
      src: history + 'path-03.svg', width: 400, height: 800
    },
    {
      id: 'paper-trail-joined', category: 'path', kind: 'image',
      label: 'Earlier paper trail · full route',
      description: 'All three original paper trails joined in their original order, without the ground panels.',
      src: history + 'path-04.svg', width: 400, height: 2400
    },
    {
      id: 'paper-terrain-joined', category: 'path', kind: 'image',
      label: 'Earlier paper landscape',
      description: 'The original three paper clearings, with their sage ground layers and full winding route.',
      src: history + 'path-05.svg', width: 400, height: 2400,
      includesGround: true
    },
    {
      id: 'earthy-ground-stream', category: 'path', kind: 'image',
      label: 'Earthy ground & stream',
      description: 'The first continuous mossy floor. Its clay trail, creek and stepping stones are baked together.',
      src: history + 'ground-earthy-stream.webp', width: 724, height: 2172,
      includesGround: true, includesCreek: true
    },
    {
      id: 'sage-ground-trail', category: 'path', kind: 'image',
      label: 'Light sage ground & trail',
      description: 'The lighter continuous sage floor, with a soft straw trail and scattered woodland plants.',
      src: 'assets/images/atelier-v6/woodland-ground.webp', width: 724, height: 2172,
      includesGround: true
    },
    {
      id: 'straw-cutout', category: 'path', kind: 'image',
      label: 'Straw paper cutout',
      description: 'The earlier standalone straw path, with an upper-left branch and softly uneven paper edges.',
      src: 'assets/images/woodland-v8/path-only.webp', width: 724, height: 2172
    },
    {
      id: 'textured-clay', category: 'path', kind: 'image',
      label: 'Textured clay path',
      description: 'The dusty tan standalone trail, with gravel edges, tiny leaves and an upper-left branch.',
      src: 'assets/images/woodland-v9/path-detailed.webp', width: 724, height: 2172
    },
    // Keep the latest design last within the path category for easy comparison.
    {
      id: 'simple-paper-latest', category: 'path', kind: 'image',
      label: 'Latest simple paper-cut',
      description: 'The most recent smooth sand-coloured paper trail, with a fine edge and an upper-left branch.',
      src: 'assets/images/woodland-v10/path-paper.svg', width: 820, height: 2400
    },
    {
      id: 'creek-none', category: 'creek', kind: 'none', label: 'No creek',
      description: 'Keep the woodland floor dry.', width: 0, height: 0
    },
    {
      id: 'creek-gravel', category: 'creek', kind: 'image',
      label: 'Gravel-bank creek',
      description: 'The earlier textured slate-blue creek, with reeds, pebble banks and three stepping stones.',
      src: 'assets/images/woodland-v9/creek-crossing.webp', width: 1086, height: 362
    },
    {
      id: 'creek-paper', category: 'creek', kind: 'image',
      label: 'Simple paper creek',
      description: 'The latest flat blue paper stream, with thin current lines and three grey stepping stones.',
      src: 'assets/images/woodland-v10/creek-paper.svg', width: 1200, height: 320
    }
  ];

  window.MIT_FOREST_PATH_OPTIONS = Object.freeze(options.map(option => Object.freeze({
    ...option,
    ...(option.kind === 'image' ? { thumbnail: history + 'thumbs/' + option.id + '.webp' } : {})
  })));
})();
