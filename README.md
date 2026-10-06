# Solenne Residences — scroll-film website

A luxury real-estate landing page. Scrolling drives one continuous camera flight:
street → arrival court → lobby → private lift → penthouse → sky terrace. Static site,
no build step.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Page markup and all copy |
| `css/style.css` | All styling (colour tokens at the top) |
| `js/film.js` | Scroll → video engine: loads the film, eased seeking, chapters, level counter, lift doors, callouts |
| `js/main.js` | Film chapter config (`FILM`), header, mobile menu, scroll animations, 3D/Plan switch, glass cards, booking form |
| `video/solenne.mp4` | Desktop film, 1920×1072 (24.5 MB) |
| `video/solenne-m.mp4` | Lighter film for small landscape screens (15.7 MB) |
| `video/solenne-p.mp4` | Portrait-cropped film for phones (13.7 MB) |
| `images/` | Poster, gallery and amenity images, `res-*.webp` 3D residence cutaways (transparent WebP, 2 widths each), reduced-motion stills, `og.jpg` share image |
| `vercel.json` | Cache headers for video, images, CSS and JS |

Every film frame is a keyframe, so seeking while scrolling is instant (measured ~4× faster
than a normal encode). All files are under GitHub's 25 MB browser-upload limit.

## Animation

- **Opening:** the loader is a pair of bronze-edged lift doors. The logo draws in letter by letter,
  then the doors part onto the tower, which settles from a slight zoom while the header drops in
  and the headline rises line by line.
- **Scroll:** headings rise line by line, the architecture quote appears word by word, stats count
  up, photos wipe open, the map draws its roads and river and the pin pulses, lists and form
  fields stagger in, and the 3D residence models lift onto their glass cards and float.
- Visitors with "reduce motion" turned on get the same content with no animation.

## Deploy

**GitHub:** new repository → "uploading an existing file" → select everything in this
folder (Ctrl+A) → drag in → wait for all files to finish → Commit.

**Vercel:** vercel.com/new → import the repository → Framework Preset **Other**, no build
command, no output directory → Deploy.

## Preview locally

The film loads with `fetch()`, so open the site through a local server (for example the
VS Code **Live Server** extension), not by double-clicking `index.html`.

## Editing

- **Copy:** chapter text is in the `<article class="chapter">` blocks in `index.html`.
- **Pacing:** in `FILM.chapters` (`js/main.js`), `scroll` is how many screen-heights a
  chapter lasts; `linger` slows the camera mid-chapter while its text is up.
- **Callouts:** `data-t0` / `data-t1` on each `.callout` are the film seconds it shows.
- **Private lift:** the `ascent` chapter has `lift: true` and `hold: [0.3, 0.7]`: the doors
  close over the first 30% of its scroll, the film changes scene only while they are shut,
  and they open over the last 30%.
- **Residence cards:** each card shows a 3D cutaway (`images/res-*.webp`) with a 3D / Plan switch; the
  floor plans are inline SVG inside each `.res__plan`. Prices, sizes and levels are plain text in the cards.

## Placeholders to replace

- Phone `(212) 555-0148`, email `sales@solenne-residences.com`, address `1 Solenne Way, Central District`.
- Prices (`$1.15M`, `$1.85M`, `$3.40M`, "On request"), floor areas, levels and amenity specs.
- **Booking form:** front-end only — it validates and shows a thank-you message but sends
  nothing. Connect it to the client's CRM or a form service (Formspree, HubSpot, Web3Forms…)
  in the `form.addEventListener('submit', …)` block at the end of `js/main.js`.
