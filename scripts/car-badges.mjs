// Regenerates the backend car badge table
// (src-tauri/crates/mt-sim-iracing/src/car_badges/table.rs) from iRacing's car
// and car class catalogue.
//
//   node scripts/car-badges.mjs <Cars.json> <CarClasses.json>
//
// The two files are iRacing Data API exports (`/data/car/get` and
// `/data/carclass/get`, the JSON the returned link points to). Keep them outside
// the repository: the table holds the only fields the app uses.
//
// What a run does:
// - every car already in the table keeps its badge, reviewed or draft; its
//   name and retired flag follow the catalogue;
// - a car the table does not hold yet is added with a draft badge (below);
// - a car the catalogue no longer lists stays as it is, with a warning.
//
// A draft badge, first rule that gives one:
// 1. the car's own `car_types` tags: a category (`gt3` → GT3, `lmdh` → GTP…)
//    or a multi-make series (`cupcar` → Cup, `supercars` → V8SC…);
// 2. its classes: the badge every badged car of a multi-make class it belongs
//    to agrees on (the Porsche 911 GT3 R (992) has no `gt3` tag, but races in
//    the GT3 classes);
// 3. the short name of a multi-make class it belongs to, when it fits;
// 4. a single-make car: its `car_name_abbreviated`.
// Badges are cut to 6 characters. To draft a car again, delete its row and
// re-run. To review a draft, see the module docs of car_badges.rs.
//
// The run prints the new drafts and the multi-make classes whose cars still
// disagree, so the review starts from that list.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const MAX_BADGE_LENGTH = 6;

const TABLE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src-tauri',
  'crates',
  'mt-sim-iracing',
  'src',
  'car_badges',
  'table.rs'
);

/** `car_types` tag → badge, first match wins: categories, then series. */
const TAG_BADGES = [
  ['gt3', 'GT3'],
  ['gt4', 'GT4'],
  ['gte', 'GTE'],
  ['gtlm', 'GTE'],
  ['gtp', 'GTP'],
  ['lmdh', 'GTP'],
  ['lmp1', 'LMP1'],
  ['lmp2', 'LMP2'],
  ['lmp3', 'LMP3'],
  ['tcr', 'TCR'],
  ['gt1', 'GT1'],
  ['dp', 'DP'],
  ['formula3', 'F3'],
  ['winstoncup', 'Cup87'],
  ['cupcar', 'Cup'],
  ['truck', 'Truck'],
  ['classb', 'NXS'],
  ['nationwide', 'NXS'],
  ['xfinity', 'NXS'],
  ['arca', 'ARCA'],
  ['supercars', 'V8SC'],
  ['v8sc', 'V8SC'],
  ['aussiev8', 'V8SC'],
  ['ss', 'SS'],
  ['stockcarbrasil', 'SCB'],
  ['sfl', 'SFL'],
  ['sf', 'SF'],
  ['formulavee', 'FVee'],
  ['rallycross', 'RX'],
];

/** Prefixes iRacing puts on the short name of an old class. */
const CLASS_NAME_PREFIX = /^\[[A-Z]\]\s*/;

const ROW_PATTERN =
  /^\s*CarBadge::(reviewed|draft)\((-?\d+), ("(?:[^"\\]|\\.)*"), ("(?:[^"\\]|\\.)*")\)(\.retired\(\))?,(.*)$/;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const fitBadge = (badge) => badge.trim().slice(0, MAX_BADGE_LENGTH);

const readTable = () => {
  const source = fs.readFileSync(TABLE_PATH, 'utf8');
  const rows = new Map();

  for (const line of source.split('\n')) {
    const match = ROW_PATTERN.exec(line);

    if (!match && line.includes('CarBadge::')) {
      // Skipping it would re-draft the car and lose a reviewed badge.
      throw new Error(
        `Cannot read this table row, keep one row per line:\n${line}`
      );
    }

    if (!match) {
      continue;
    }

    const [, status, carId, badge, name, retired, comment] = match;

    rows.set(Number(carId), {
      carId: Number(carId),
      badge: JSON.parse(badge),
      name: JSON.parse(name),
      retired: Boolean(retired),
      draft: status === 'draft',
      comment: comment.trim(),
    });
  }

  return rows;
};

const badgeFromTags = (car) => {
  const tags = new Set(car.car_types.map((type) => type.car_type));
  const match = TAG_BADGES.find(([tag]) => tags.has(tag));

  return match ? match[1] : null;
};

const multiMakeClassesOf = (carId, carClasses) =>
  carClasses.filter(
    (carClass) =>
      carClass.cars_in_class.length > 1 &&
      carClass.cars_in_class.some((member) => member.car_id === carId)
  );

/** The one badge the badged classmates of `carId` agree on, else null. */
const badgeFromClassmates = (carId, carClasses, badgeOf) => {
  const candidates = new Set();

  for (const carClass of multiMakeClassesOf(carId, carClasses)) {
    const classmateBadges = new Set(
      carClass.cars_in_class
        .filter((member) => member.car_id !== carId)
        .map((member) => badgeOf(member.car_id))
        .filter(Boolean)
    );

    if (classmateBadges.size === 1) {
      candidates.add([...classmateBadges][0]);
    }
  }

  return candidates.size === 1 ? [...candidates][0] : null;
};

const badgeFromClassName = (carId, carClasses) => {
  const fitting = multiMakeClassesOf(carId, carClasses)
    .map((carClass) =>
      carClass.short_name.replace(CLASS_NAME_PREFIX, '').trim()
    )
    .find((name) => name.length > 0 && name.length <= MAX_BADGE_LENGTH);

  return fitting ?? null;
};

const draftBadges = (newCars, carClasses, rows) => {
  const tagBadges = new Map(
    newCars.map((car) => [car.car_id, badgeFromTags(car)])
  );

  const knownBadge = (carId) =>
    rows.get(carId)?.badge ?? tagBadges.get(carId) ?? null;

  return new Map(
    newCars.map((car) => {
      const badge =
        tagBadges.get(car.car_id) ??
        badgeFromClassmates(car.car_id, carClasses, knownBadge) ??
        badgeFromClassName(car.car_id, carClasses) ??
        (car.car_name_abbreviated || car.car_name);

      return [car.car_id, fitBadge(badge)];
    })
  );
};

const formatRow = (row) => {
  const constructor = row.draft ? 'draft' : 'reviewed';
  const retired = row.retired ? '.retired()' : '';
  const comment = row.comment ? ` ${row.comment}` : '';

  return `    CarBadge::${constructor}(${row.carId}, ${JSON.stringify(row.badge)}, ${JSON.stringify(row.name)})${retired},${comment}`;
};

const writeTable = (rows) => {
  const sorted = [...rows.values()].sort(
    (left, right) => left.carId - right.carId
  );

  const source = [
    '//! Generated by `scripts/car-badges.mjs` — see `super` for how to review a',
    '//! draft. Rows are in `CarID` order; the script keeps every badge it finds.',
    '',
    'use super::CarBadge;',
    '',
    '// One row per line: the script reads the table back line by line.',
    '#[rustfmt::skip]',
    'pub(super) const CAR_BADGES: &[CarBadge] = &[',
    ...sorted.map(formatRow),
    '];',
    '',
  ].join('\n');

  fs.writeFileSync(TABLE_PATH, source);
};

/** Multi-make classes (the hosted all-cars class aside) whose cars carry different badges. */
const disagreeingClasses = (carClasses, rows, catalogueSize) =>
  carClasses
    .filter(
      (carClass) =>
        carClass.cars_in_class.length > 1 &&
        carClass.cars_in_class.length <= catalogueSize / 2
    )
    .map((carClass) => ({
      carClass,
      badges: [
        ...new Set(
          carClass.cars_in_class.map((member) => rows.get(member.car_id)?.badge)
        ),
      ],
    }))
    .filter(({ badges }) => badges.length > 1);

const main = () => {
  const [carsPath, carClassesPath] = process.argv.slice(2);

  if (!carsPath || !carClassesPath) {
    console.error(
      'Usage: node scripts/car-badges.mjs <Cars.json> <CarClasses.json>'
    );
    process.exit(1);
  }

  const cars = readJson(carsPath);
  const carClasses = readJson(carClassesPath);
  const rows = readTable();

  const catalogueIds = new Set(cars.map((car) => car.car_id));
  const newCars = cars.filter((car) => !rows.has(car.car_id));
  const drafts = draftBadges(newCars, carClasses, rows);

  for (const car of cars) {
    const existing = rows.get(car.car_id);

    rows.set(car.car_id, {
      carId: car.car_id,
      badge: existing?.badge ?? drafts.get(car.car_id),
      name: car.car_name,
      retired: car.retired,
      draft: existing?.draft ?? true,
      comment: existing?.comment ?? '',
    });
  }

  writeTable(rows);

  for (const row of rows.values()) {
    if (!catalogueIds.has(row.carId)) {
      console.warn(
        `warning: car ${row.carId} (${row.name}) is not in the catalogue; kept as it is`
      );
    }
  }

  console.log(`${rows.size} cars, ${newCars.length} new drafts:`);

  for (const car of newCars) {
    console.log(`  ${car.car_id}\t${drafts.get(car.car_id)}\t${car.car_name}`);
  }

  console.log('Multi-make classes whose cars disagree:');

  for (const { carClass, badges } of disagreeingClasses(
    carClasses,
    rows,
    cars.length
  )) {
    console.log(
      `  ${carClass.car_class_id}\t${carClass.short_name}\t${badges.join(' / ')}`
    );
  }
};

main();
