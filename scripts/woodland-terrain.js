/* Three paper-cut clearings, drawn once and reused by the EXCO renderer.
   The path is a filled, variable-width ribbon with separately cut soil edges.
   It passes through x=200 at each chapter boundary with the same 46px width.
   Fine, deterministic SVG patterns provide fibres without runtime filters,
   external images, animation loops or a repeating graph-paper texture. */
(() => {
  'use strict';

  const palettes = [
    { entry: '#f7f0dd', back: '#d9dec8', middle: '#c2cba9', front: '#e7dfbe', moss: '#9caa83', leaf: '#7c906f' },
    { entry: '#e7dfbe', back: '#e7dfbe', middle: '#d7d9ba', front: '#c7d0b0', moss: '#abb48e', leaf: '#82916d' },
    { entry: '#c7d0b0', back: '#c7d0b0', middle: '#b8c4a8', front: '#667e68', moss: '#9aa987', leaf: '#647f68' }
  ];
  // Each cubic follows the established station layout. In the lookout the
  // first turn goes left of the bear and printer, leaving their clearing open.
  const routes = [
    [[200, 90, 294, 112, 321, 196], [364, 310, 175, 348, 170, 453], [165, 546, 289, 574, 278, 659], [269, 727, 200, 745, 200, 776]],
    [[200, 90, 284, 98, 303, 184], [331, 274, 232, 299, 188, 363], [139, 432, 145, 492, 208, 550], [263, 600, 283, 656, 241, 714], [211, 747, 200, 755, 200, 776]],
    [[200, 100, 188, 186, 150, 251], [119, 304, 124, 365, 187, 414], [247, 459, 296, 528, 280, 598], [262, 679, 200, 721, 200, 776]]
  ];
  const widths = [[-24, 46], [24, 46], [130, 35], [230, 44], [350, 49], [450, 57], [560, 48], [660, 59], [740, 51], [776, 46], [824, 46]];
  const f = number => Number(number.toFixed(2));
  const pair = point => f(point.x) + ' ' + f(point.y);

  function random(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function traceRoute(curves) {
    const points = [{ x: 200, y: -24 }, { x: 200, y: 0 }, { x: 200, y: 24 }];
    let from = points[2];
    curves.forEach(curve => {
      for (let step = 1; step <= 18; step++) {
        const t = step / 18, u = 1 - t;
        points.push({
          x: u * u * u * from.x + 3 * u * u * t * curve[0] + 3 * u * t * t * curve[2] + t * t * t * curve[4],
          y: u * u * u * from.y + 3 * u * u * t * curve[1] + 3 * u * t * t * curve[3] + t * t * t * curve[5]
        });
      }
      from = points[points.length - 1];
    });
    points.push({ x: 200, y: 800 }, { x: 200, y: 824 });
    return points;
  }

  function widthAt(y) {
    for (let i = 1; i < widths.length; i++) {
      if (y <= widths[i][0]) {
        const [a, aw] = widths[i - 1], [b, bw] = widths[i];
        const t = Math.max(0, Math.min(1, (y - a) / (b - a)));
        return aw + (bw - aw) * (t * t * (3 - 2 * t));
      }
    }
    return 46;
  }

  function curveThrough(points) {
    let result = 'L' + pair(points[0]);
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      result += 'Q' + pair(a) + ' ' + pair({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    return result + 'L' + pair(points[points.length - 1]);
  }

  function ribbon(points, extraWidth = 0) {
    const left = [], right = [];
    points.forEach((point, index) => {
      const before = points[Math.max(index - 1, 0)], after = points[Math.min(index + 1, points.length - 1)];
      const dx = after.x - before.x, dy = after.y - before.y, magnitude = Math.hypot(dx, dy) || 1;
      const normal = { x: dy / magnitude, y: -dx / magnitude };
      const edge = point.y > 35 && point.y < 760 ? Math.sin(index * 1.87) * .65 + Math.sin(index * .59) * .4 : 0;
      const half = (widthAt(point.y) + extraWidth) / 2;
      left.push({ x: point.x - normal.x * (half + edge), y: point.y - normal.y * (half + edge) });
      right.push({ x: point.x + normal.x * (half - edge * .7), y: point.y + normal.y * (half - edge * .7) });
    });
    return 'M' + pair(left[0]) + curveThrough(left.slice(1)) + curveThrough(right.reverse()) + 'Z';
  }

  function texture(id, seed, pathPaper) {
    const rand = random(seed);
    let flecks = '', lights = '', fibres = '';
    // Incommensurate tile dimensions and irregular shapes keep the texture
    // quiet and fibrous rather than visibly gridded or evenly dotted.
    for (let i = 0; i < 185; i++) {
      const x = rand() * 173, y = rand() * 193, size = .28 + rand() * .75;
      const grain = 'M' + f(x) + ' ' + f(y) + 'l' + f(size) + ' ' + f(-size * .24) + ' ' + f(size * .39) + ' ' + f(size * .82) + ' ' + f(-size * .95) + ' ' + f(size * .28) + 'Z';
      if (i % 3 === 0) lights += grain; else flecks += grain;
    }
    for (let i = 0; i < 42; i++) {
      const x = rand() * 170, y = rand() * 190, length = 1.4 + rand() * 4.6;
      fibres += 'M' + f(x) + ' ' + f(y) + 'q' + f(length * .4) + ' ' + f(-.35 - rand() * .9) + ' ' + f(length) + ' ' + f(-.7 + rand() * 1.4);
    }
    return '<pattern id="' + id + '" width="173" height="193" patternUnits="userSpaceOnUse"><path d="' + flecks + '" fill="' + (pathPaper ? '#927547' : '#566b4c') + '" opacity=".23"/><path d="' + lights + '" fill="#fff6dc" opacity=".55"/><path d="' + fibres + '" fill="none" stroke="' + (pathPaper ? '#987b51' : '#536848') + '" stroke-width=".48" stroke-linecap="round" opacity=".28"/></pattern>';
  }

  function moss(x, y, size, turn, palette) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + turn + ') scale(' + size + ')"><path d="M-29 4Q-35-5-25-8Q-27-17-14-15Q-8-23 2-17Q12-24 20-13Q32-16 34-5Q42 0 29 8Q19 15 6 10Q-3 16-14 9Q-27 15-29 4Z" fill="' + palette.moss + '"/><path d="M-20 0q6-9 11-5M-4 3q7-10 14-6M17 2q4-6 9-3" fill="none" stroke="' + palette.leaf + '" stroke-width="1.2" stroke-linecap="round" opacity=".5"/><path d="m-14 3 2-1m21 3 2-1m13-8 2-1" fill="none" stroke="#f4eacb" stroke-width="1.6" stroke-linecap="round"/></g>';
  }

  function leafScatter(x, y, scale, rotation, palette) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rotation + ') scale(' + scale + ')"><path d="M0 0Q-18 0-13-13Q0-12 0 0ZM3 5Q9-9 18-5Q20 8 3 5ZM-6 12Q-18 19-23 8Q-11 3-6 12Z" fill="' + palette.leaf + '"/><path d="M-2-2l-8-7M6 3l8-5m-23 13-8-1" stroke="#e9dfbf" stroke-width=".85" stroke-linecap="round"/><path d="M5 18Q4 7-5 4" fill="none" stroke="#8e8054" stroke-width="1.1" stroke-linecap="round"/></g>';
  }

  function pebbles(x, y, turn) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + turn + ')"><path d="M-10 3-8-2-2-4 3 0 2 4Z" fill="#9b9e86"/><path d="m-8-2 6-2 3 2-7 1Z" fill="#c7c8ac"/><path d="m6 7 2-4 5 0 3 3-4 3Z" fill="#bca983"/><path d="m8 3 5 0 1 2-6 0Z" fill="#e6d6ad"/></g>';
  }

  // Keep detailed marks on shoulders and quiet corners, outside the name bands.
  const groundDetails = [
    [[46, 264, .9, -8], [247, 443, .8, 12], [350, 614, .9, -12], [66, 727, .8, 9]],
    [[30, 226, .8, -14], [218, 426, .7, 8], [361, 489, .95, 14], [39, 705, .85, -4]],
    [[41, 289, .9, 14], [236, 205, .65, -6], [336, 430, .8, 12], [61, 724, .95, -9]]
  ];
  const leaves = [
    [[249, 176, .65, 24], [243, 466, .7, 16], [328, 661, .8, -25], [128, 735, .55, 14]],
    [[253, 202, .65, -18], [112, 426, .55, 27], [278, 564, .7, -11], [172, 704, .55, 10]],
    [[126, 93, .55, -25], [86, 335, .7, 17], [260, 423, .6, -23], [217, 685, .7, 14]]
  ];

  function buildScene(index) {
    const palette = palettes[index], id = 'mit-woodland-' + index;
    const points = traceRoute(routes[index]), path = ribbon(points), soil = ribbon(points, 6);
    const back = 'M0 150C31 142 47 132 79 143S123 178 154 181S198 173 225 167S260 151 286 143S336 119 365 135S389 147 400 151V800H0Z';
    const middle = 'M0 354C34 368 62 367 90 349S145 320 177 324S228 332 258 335S317 388 345 381S383 367 400 361V800H0Z';
    const front = 'M0 695C30 677 53 674 81 686S121 717 154 720S190 716 219 710S265 695 287 698S339 686 363 700S389 713 400 716V800H0Z';
    const textureDefinitions = texture(id + '-fibre', 761 + index * 43, false) + texture(id + '-path-fibre', 719 + index * 79, true);
    const scattered = groundDetails[index].map(args => moss(...args, palette)).join('') + leaves[index].map(args => leafScatter(...args, palette)).join('');
    const stones = index === 0 ? [[207, 385, -9], [320, 604, 14], [143, 737, -15]] : index === 1 ? [[244, 320, 19], [198, 604, -12], [307, 677, 8]] : [[99, 270, -17], [221, 486, 13], [295, 666, -5]];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="none" aria-hidden="true" focusable="false" role="presentation" style="overflow:hidden">' +
      '<defs>' + textureDefinitions + '<path id="' + id + '-path" d="' + path + '"/><path id="' + id + '-soil" d="' + soil + '"/></defs>' +
      '<rect width="400" height="800" fill="' + palette.entry + '"/>' +
      '<path d="' + back + '" fill="' + palette.back + '"/>' +
      '<path d="' + middle + '" fill="#657957" opacity=".12" transform="translate(0 2)"/><path d="' + middle + '" fill="' + palette.middle + '"/>' +
      '<path d="' + front + '" fill="#526b50" opacity=".12" transform="translate(0 2)"/><path d="' + front + '" fill="' + palette.front + '"/>' +
      scattered + '<rect width="400" height="800" fill="url(#' + id + '-fibre)"/>' +
      '<use href="#' + id + '-soil" fill="#5b6347" opacity=".15" transform="translate(0 2)"/>' +
      '<use href="#' + id + '-soil" fill="#bea06e"/>' +
      '<use href="#' + id + '-path" fill="#e8d4a1"/>' +
      '<use href="#' + id + '-path" fill="url(#' + id + '-path-fibre)"/>' +
      stones.map(args => pebbles(...args)).join('') +
      '</svg>';
  }

  const scenes = Object.freeze([buildScene(0), buildScene(1), buildScene(2)]);
  window.MIT_WOODLAND_TERRAIN = sceneIndex => scenes[Number.isInteger(sceneIndex) && sceneIndex >= 0 && sceneIndex < scenes.length ? sceneIndex : 0];
})();
