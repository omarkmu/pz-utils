# pz-utils

A collection of various scripts and utilities to support Project Zomboid modding.
These are only related in that I use them for things related to PZ.

## Installation

To install the node.js scripts, use `npm install -g` in the top-level project directory.
This will automatically start a build and add the scripts to the PATH.

## Scripts

### pz-extract-cldr

Extracts [CLDR](https://cldr.unicode.org) data and converts it into a format the can more easily be used.

To see available options, use `pz-extract-cldr --help`.

### pz-ftl-analyze

An analyzer for [Fluent](https://projectfluent.org) translation files.
Analysis assumes the use of special annotation comments that can be handled by my library mod.

To see available options, use `pz-ftl-analyze --help`.
