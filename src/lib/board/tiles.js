// The whiteboard's tile formats: one entry per `board_tile:` value an
// assignment can name, and what each one needs.
//
//   layout   how the board lays the tiles out (columns, and the distance from
//            one column's left edge to the next) and how big one tile is
//   fields   what a tile of this format carries beyond the common ones
//   clean    the same, checked again by the server when the tile is added
//
// The common fields (student, title, gallery_text, group, cover, ratio, pages,
// href) are cleaned in cleanElement (src/lib/server/boards.js). The tile is
// drawn by one component per format, picked in Whiteboard.svelte by the
// tile's `variant`.
//
//   cover        the default: the cover, paged through for a multi-page PDF
//   interactive  Assignment 4: the work runs in a frame on click, with the
//                student's prompt in a scrolling box under it
//   spread       the draft proposal: every page of the PDF at once, up to
//                three across, each at its size on paper
//
// A tile stores its format as `variant`. Tiles made before this file have no
// variant, or 'interactive', and read the same as they did.
//
// Universal: imported by the canvas and by the server.

// The text under the work: title, name, group, gallery text and the link.
const TEXT_H = 240;
// The page-turning buttons under a multi-page PDF's cover.
const PAGER_H = 48;
// An interactive tile's prompt box.
const PROMPT_H = 240;

// A cover or interactive tile is as tall as its cover at full width,
// uncropped, plus the text. Without a ratio it gets the old 4:3 box.
const COVER_W = 480;
const coverH = (ratio) => (ratio ? Math.round(COVER_W * ratio) + TEXT_H : 600);

// A spread is every page, up to SPREAD.cols across, each drawn at its size on
// paper: one point of the PDF is SPREAD.scale px on the board, so a letter
// page is 400px wide and an 11x17 one is proportionally larger. A page over
// SPREAD.maxW px wide (a poster) is shrunk to it. A page with no recorded size
// (a tile made before sizes were kept) is drawn 400px wide in the cover's
// proportions.
export const SPREAD = { cols: 3, gap: 12, scale: 400 / 612, maxW: 1200, fallbackW: 400 };

const isSize = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && n > 0 && n <= 20000);

/**
 * Where each page of a spread goes, relative to the tile's top left, and how
 * much room they take. Rows are as tall as their tallest page; a shorter page
 * sits at the top of its row. Shared by the board builder and SpreadTile.
 */
export function spreadLayout({ pages, sizes, ratio }) {
  const count = Math.max(pages.length, 1);
  const cells = [];
  let y = 0;
  let width = 0;
  for (let r = 0; r * SPREAD.cols < count; r++) {
    let x = 0;
    let rowH = 0;
    for (let i = r * SPREAD.cols; i < Math.min(count, (r + 1) * SPREAD.cols); i++) {
      let w = SPREAD.fallbackW;
      let h = w * (ratio ?? 0.75);
      if (isSize(sizes?.[i])) {
        w = sizes[i][0] * SPREAD.scale;
        h = sizes[i][1] * SPREAD.scale;
        if (w > SPREAD.maxW) [w, h] = [SPREAD.maxW, (h * SPREAD.maxW) / w];
      }
      w = Math.round(w);
      h = Math.round(h);
      cells.push({ x, y, w, h });
      x += w + SPREAD.gap;
      rowH = Math.max(rowH, h);
    }
    width = Math.max(width, x - SPREAD.gap);
    y += rowH + SPREAD.gap;
  }
  return { cells, w: width, h: y - SPREAD.gap };
}

export const FORMATS = {
  cover: {
    columns: 4,
    pitch: 720,
    size: ({ ratio, pages }) => ({
      w: COVER_W,
      h: coverH(ratio) + (pages.length > 1 ? PAGER_H : 0)
    }),
    fields: () => ({}),
    clean: () => ({})
  },

  interactive: {
    columns: 4,
    pitch: 720,
    size: ({ ratio, pages, prompt }) => ({
      w: COVER_W,
      h: coverH(ratio) + (pages.length > 1 ? PAGER_H : 0) + (prompt ? PROMPT_H : 0)
    }),
    // The interactive is the hosted site, or else an uploaded HTML file. A
    // submission with neither (the PDF fallback) shows its cover or pages.
    fields: ({ manifest, base, promptPath }) => ({
      live: manifest.link ? manifest.link
        : /\.html?$/i.test(manifest.primary ?? '') ? base + manifest.primary
        : null,
      prompt: promptPath ? base + promptPath : null
    }),
    clean: (raw, { submissionUrl, httpsUrl }) => ({
      live: submissionUrl(raw.live) ?? httpsUrl(raw.live),
      prompt: submissionUrl(raw.prompt)
    })
  },

  spread: {
    columns: 2,
    // Spreads differ in width, so the distance between columns is worked out
    // from the widest tile when the board is built (see board-generate.js).
    pitch: null,
    size: ({ ratio, pages, page_sizes }) => {
      const grid = spreadLayout({ pages, sizes: page_sizes, ratio });
      return { w: Math.max(grid.w, SPREAD.fallbackW), h: grid.h + SPREAD.gap + TEXT_H };
    },
    fields: ({ manifest }) => ({ page_sizes: manifest.page_sizes ?? [] }),
    clean: (raw) => ({
      page_sizes: Array.isArray(raw.page_sizes) && raw.page_sizes.every(isSize) ? raw.page_sizes.slice(0, 20) : []
    })
  }
};

/** The format an assignment's board uses, from its `board_tile:`. */
export const formatOf = (assignment) => (FORMATS[assignment?.board_tile] ? assignment.board_tile : 'cover');

/** The format a tile on the board is drawn as. */
export const variantOf = (el) => (FORMATS[el?.variant] ? el.variant : 'cover');
