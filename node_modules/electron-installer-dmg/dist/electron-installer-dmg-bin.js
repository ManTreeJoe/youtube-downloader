#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint no-console:0 no-sync:0 */
const fs = require("fs");
const minimist = require("minimist");
const path = require("path");
const _1 = require(".");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');
const usage = fs.readFileSync(path.resolve(__dirname, '../usage.txt')).toString();
const args = minimist(process.argv.slice(2), {
    boolean: ['overwrite'],
    string: ['out', 'icon', 'icon-size', 'background', 'title', 'format'],
});
const [appPath, name] = args._;
const options = {
    appPath,
    name,
    overwrite: args.overwrite,
    icon: args.icon,
    iconSize: args['icon-size'] ? parseInt(args['icon-size'], 10) : undefined,
    background: args.background,
    title: args.title,
    format: args.format,
    out: args.out,
};
if (args.help || args.h || !options.appPath || !options.name) {
    console.error(usage);
    process.exit(1);
}
if (args.version) {
    console.error(pkg.version);
    process.exit(1);
}
(0, _1.createDMG)(options)
    .then(() => {
    console.log(`Wrote DMG to:\n${args.dmgPath}`);
})
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=electron-installer-dmg-bin.js.map