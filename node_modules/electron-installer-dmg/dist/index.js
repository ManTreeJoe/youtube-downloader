"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDMG = void 0;
const debug_1 = require("debug");
const fs_1 = require("fs");
const path = require("path");
const debug = (0, debug_1.default)('electron-installer-dmg');
async function build(spec, dmgPath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appdmg = require('appdmg');
    debug('DMG spec is:\n', spec);
    debug('creating dmg...');
    return await new Promise((resolve, reject) => {
        appdmg({
            basepath: process.cwd(),
            target: dmgPath,
            specification: spec,
        }).on('progress', (info) => {
            if (info.type === 'step-begin') {
                debug('appdmg [%d/%d]: %s...', info.current, info.total, info.title);
            }
        }).on('finish', async () => {
            debug('appdmg finished!');
            resolve();
        }).on('error', (err) => {
            debug('appdmg errored!', err);
            reject(err);
        });
    });
}
const createDMG = async (opts) => {
    const defaultSpecContents = [
        {
            x: 448,
            y: 344,
            type: 'link',
            path: '/Applications',
        },
        {
            x: 192,
            y: 344,
            type: 'file',
            path: path.resolve(process.cwd(), opts.appPath),
        },
    ];
    const specContents = opts.contents ? (typeof opts.contents === 'function' ? opts.contents(opts) : opts.contents) : defaultSpecContents;
    const spec = Object.assign({ title: opts.title || opts.name, format: opts.format || 'UDZO', contents: specContents }, opts.additionalDMGOptions);
    if (process.platform !== 'darwin') {
        throw new Error('Must be run on OSX');
    }
    if (!opts.background) {
        spec.background = path.resolve(__dirname, '../resources/mac/background.png');
    }
    else {
        spec.background = path.resolve(opts.background);
    }
    if (!opts.icon) {
        spec.icon = path.resolve(__dirname, '../resources/mac/electron.icns');
    }
    else {
        spec.icon = path.resolve(opts.icon);
    }
    spec['icon-size'] = opts.iconSize || 80;
    if (!opts.appPath || typeof opts.appPath !== 'string') {
        throw new Error('opts.appPath must be defined as a string');
    }
    let dmgPath;
    let configuredOut = 'out' in opts ? opts.out : undefined;
    if (!configuredOut && !('dmgPath' in opts)) {
        configuredOut = process.cwd();
    }
    if ('out' in opts && 'dmgPath' in opts) {
        throw new Error('Only one of opts.dmgPath or opts.out must be defined as a string');
    }
    else if (configuredOut) {
        if (typeof configuredOut !== 'string') {
            throw new Error(`Expected opts.out to be a string but it was "${typeof configuredOut}"`);
        }
        dmgPath = path.resolve(configuredOut, `${opts.name}.dmg`);
    }
    else if ('dmgPath' in opts) {
        if (typeof opts.dmgPath !== 'string') {
            throw new Error(`Expected opts.dmgPath to be a string but it was "${typeof opts.dmgPath}"`);
        }
        dmgPath = opts.dmgPath;
    }
    else {
        throw new Error('Either opts.dmgPath or opts.out must be defined as a string');
    }
    await fs_1.promises.mkdir(path.dirname(dmgPath), { recursive: true });
    if ((0, fs_1.existsSync)(dmgPath)) {
        if (!opts.overwrite) {
            debug('DMG already exists at `%s` and overwrite is false', dmgPath);
            const msg = `DMG already exists.  Run electron-installer-dmg again with \
\`--overwrite\` or remove the file and rerun. ${dmgPath}`;
            throw new Error(msg);
        }
        else {
            debug('DMG already exists at `%s`.  Removing...', dmgPath);
            await fs_1.promises.unlink(dmgPath);
        }
    }
    return build(spec, dmgPath);
};
exports.createDMG = createDMG;
//# sourceMappingURL=index.js.map