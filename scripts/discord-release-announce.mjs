import fs from 'node:fs';
import process from 'node:process';

const CHANGELOG_PATH = 'CHANGELOG.md';

// Discord embed limits. The 6000 budget is the sum of every text field in the
// message, so the whole announcement has to fit inside it at once.
const EMBED_TITLE_LIMIT = 256;
const EMBED_DESCRIPTION_LIMIT = 4096;
const EMBED_FIELD_NAME_LIMIT = 256;
const EMBED_FIELD_VALUE_LIMIT = 1024;
const EMBED_FIELD_COUNT_LIMIT = 25;
const EMBED_TOTAL_LIMIT = 6000;
const EMBED_COLOR = 0xf59e0b;

const ELLIPSIS = '…';

const readVersion = () => {
  const tagName = process.env.TAG_NAME ?? '';

  if (!tagName) {
    throw new Error('TAG_NAME is required (e.g. v0.23.0)');
  }

  return tagName.replace(/^v/, '');
};

const extractSection = (changelog, version) => {
  const lines = changelog.split('\n');
  const startIndex = lines.findIndex((line) =>
    line.startsWith(`## [${version}]`)
  );

  if (startIndex === -1) {
    throw new Error(`No CHANGELOG.md section found for version ${version}`);
  }

  const rest = lines.slice(startIndex + 1);
  const endOffset = rest.findIndex((line) => line.startsWith('## ['));
  const body = endOffset === -1 ? rest : rest.slice(0, endOffset);

  return body;
};

const truncate = (text, limit) => {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
};

// A changelog entry reads `- **Headline:** prose`. The announcement keeps the
// headline and drops the prose — the full text is one click away on the release.
const headlineOf = (line) => {
  const bold = line.match(/^-\s+\*\*(.+?)\*\*:?\s*/);

  if (bold) {
    return bold[1].replace(/:$/, '');
  }

  return line.replace(/^-\s+/, '').replace(/\*\*/g, '');
};

const parseGroups = (bodyLines) => {
  const groups = [];
  let current = null;

  for (const line of bodyLines) {
    if (line.startsWith('### ')) {
      current = { name: line.slice(4).trim(), headlines: [] };
      groups.push(current);
      continue;
    }

    if (current && line.startsWith('- ')) {
      current.headlines.push(headlineOf(line.trim()));
    }
  }

  return groups.filter((group) => group.headlines.length > 0);
};

const fieldValueOf = (headlines) => {
  const rendered = [];
  let used = 0;

  for (const [index, headline] of headlines.entries()) {
    const entry = `• ${headline}`;
    const remaining = headlines.length - index;
    const tail = remaining > 1 ? `\n…and ${remaining} more` : '';
    const wouldUse = used + entry.length + 1 + tail.length;

    if (wouldUse > EMBED_FIELD_VALUE_LIMIT) {
      rendered.push(`…and ${remaining} more`);
      break;
    }

    rendered.push(entry);
    used += entry.length + 1;
  }

  return truncate(rendered.join('\n'), EMBED_FIELD_VALUE_LIMIT);
};

const buildEmbed = ({ version, releaseUrl, groups, isPrerelease }) => {
  const title = truncate(
    `Marble Trace ${version}${isPrerelease ? ' (pre-release)' : ''}`,
    EMBED_TITLE_LIMIT
  );
  const description = truncate(
    `[Download and full changelog](${releaseUrl})`,
    EMBED_DESCRIPTION_LIMIT
  );

  const embed = {
    title,
    url: releaseUrl,
    description,
    color: EMBED_COLOR,
    fields: [],
  };

  let budget = EMBED_TOTAL_LIMIT - title.length - description.length;

  for (const group of groups) {
    if (embed.fields.length >= EMBED_FIELD_COUNT_LIMIT) {
      break;
    }

    const name = truncate(group.name, EMBED_FIELD_NAME_LIMIT);
    const value = fieldValueOf(group.headlines);
    const cost = name.length + value.length;

    if (cost > budget) {
      break;
    }

    embed.fields.push({ name, value });
    budget -= cost;
  }

  return embed;
};

const post = async (webhookUrl, embed) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord returned ${response.status}: ${detail}`);
  }
};

const main = async () => {
  const version = readVersion();
  const releaseUrl = process.env.RELEASE_URL ?? '';
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL ?? '';
  const isPrerelease = process.env.IS_PRERELEASE === 'true';
  const dryRun = process.env.DRY_RUN === 'true';

  if (!releaseUrl) {
    throw new Error('RELEASE_URL is required');
  }

  if (!webhookUrl && !dryRun) {
    throw new Error('DISCORD_WEBHOOK_URL is required');
  }

  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const groups = parseGroups(extractSection(changelog, version));

  if (groups.length === 0) {
    throw new Error(`CHANGELOG.md section for ${version} has no entries`);
  }

  const embed = buildEmbed({ version, releaseUrl, groups, isPrerelease });

  if (dryRun) {
    console.log(JSON.stringify({ embeds: [embed] }, null, 2));

    return;
  }

  await post(webhookUrl, embed);
  console.log(`Announced ${version} to Discord`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
