# pz-utils

A collection of scripts and utilities to support Project Zomboid modding.


## Installation

To install the node.js scripts, use `npm install -g` in the top-level project directory.
This will automatically start a build and add the scripts to the PATH.

To install `zombusted`, run `luarocks --local make zombusted-scm-0.rockspec` in the `lua` directory.

## Scripts

### pz-extract-cldr

Extracts [CLDR](https://cldr.unicode.org) data and converts it into a format the can more easily be used.

To see available options, use `pz-extract-cldr --help`.

### pz-ftl-analyze

An analyzer for [Fluent](https://projectfluent.org) translation files.
Analysis assumes the use of special annotation comments that can be handled by my library mod.

To see available options, use `pz-ftl-analyze --help`.

### zombusted

**zombusted** is a set of Lua scripts that help mock the PZ environment for testing with `busted`.
It also provides utilities for changing the state of the environment.

The mocking is very incomplete.
