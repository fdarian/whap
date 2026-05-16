# Changesets

This directory contains changeset files that describe changes which should be
released. Learn more at https://github.com/changesets/changesets.

To create a new changeset, run:

  bunx changeset

This will prompt you to select which packages have changed and describe the
changes. The output is a markdown file in this directory.

When you're ready to release, run:

  bun run version

This will consume all changeset files, bump versions, and update changelogs.
Then run:

  bun run release

to publish the updated packages to npm.
